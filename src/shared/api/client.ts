export interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
}

export interface Chat {
  chatId: string;
  name: string;
  type: string;
  phoneNumber?: number;
  username?: string;
}

export interface Contact {
  chatId: string;
  name: string;
  contactName?: string;
  avatar?: string;
  lastSeen?: number;
  chatType?: string;
}

export interface HistoryMessage {
  idMessage: string;
  chatId: string;
  timestamp: number;
  type: 'incoming' | 'outgoing';
  typeMessage: string;
  textMessage?: string;
  statusMessage?: string;
  extendedTextMessage?: { text?: string };
}

export interface Notification {
  receiptId: number;
  body: {
    typeWebhook: string;
    timestamp?: number;
    idMessage?: string;
    chatId?: string;
    status?: string;
    senderData?: {
      chatId: string;
      chatType?: string;
      chatName?: string;
      senderName?: string;
    };
    messageData?: {
      typeMessage: string;
      textMessageData?: { textMessage: string };
      extendedTextMessageData?: { text: string };
    };
  };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function apiHost() {
  const value = import.meta.env.VITE_GREEN_API_URL?.trim();

  if (!value) {
    throw new Error(
      'Укажите VITE_GREEN_API_URL в .env и перезапустите приложение.',
    );
  }

  try {
    const url = new URL(value);

    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }

    return value.replace(/\/+$/, '');
  } catch {
    throw new Error('Некорректный адрес сервера в VITE_GREEN_API_URL.');
  }
}

interface Job {
  priority: () => number;
  run: () => Promise<void>;
  reject: (reason: unknown) => void;
  signal: AbortSignal;
}

// A single lane per method prevents bursts, including retries and background preloads.
class RequestLane {
  private jobs: Job[] = [];
  private running = false;
  private nextStart = 0;
  private interval: number;
  constructor(interval: number) {
    this.interval = interval;
  }

  enqueue<T>(
    task: () => Promise<T>,
    signal: AbortSignal,
    priority: () => number = () => 0,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.jobs.push({
        priority,
        signal,
        reject,
        run: async () => {
          try {
            resolve(await task());
          } catch (error) {
            reject(error);
          }
        },
      });

      this.jobs.sort((a, b) => b.priority() - a.priority());
      void this.drain();
    });
  }

  private async drain() {
    if (this.running) {
      return;
    }

    this.running = true;

    while (this.jobs.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, this.nextStart - Date.now())),
      );

      this.jobs.sort((a, b) => b.priority() - a.priority());
      const job = this.jobs.shift()!;

      if (job.signal.aborted) {
        job.reject(new DOMException('Aborted', 'AbortError'));
        continue;
      }

      this.nextStart = Date.now() + this.interval;
      await job.run();
    }

    this.running = false;
  }
}

export class GreenApi {
  private credentials: Credentials;
  private host: string;
  private lifetime = new AbortController();
  private historyLane = new RequestLane(1100);
  private contactLane = new RequestLane(200);
  private chatsLane = new RequestLane(1100);
  private activeChat?: string;

  constructor(credentials: Credentials, host = apiHost()) {
    this.credentials = credentials;
    this.host = host;
  }

  get idInstance() {
    return this.credentials.idInstance;
  }
  get signal() {
    return this.lifetime.signal;
  }
  close() {
    this.lifetime.abort();
  }
  prioritize(chatId?: string) {
    this.activeChat = chatId;
  }

  private async request<T>(
    method: string,
    body?: unknown,
    options: { signal?: AbortSignal; verb?: string; suffix?: string } = {},
  ): Promise<T> {
    const { idInstance, apiTokenInstance } = this.credentials;

    const signal = AbortSignal.any([
      this.signal,
      ...(options.signal ? [options.signal] : []),
      AbortSignal.timeout(25000),
    ]);

    const url = `${this.host}/waInstance${encodeURIComponent(idInstance)}/${method}/${encodeURIComponent(apiTokenInstance)}${options.suffix ?? ''}`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: options.verb ?? (body === undefined ? 'GET' : 'POST'),
        headers:
          body === undefined
            ? undefined
            : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch {
      if (this.signal.aborted || options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      throw new Error(
        'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
      );
    }

    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? 'Доступ отклонён. Проверьте ID инстанса и токен.'
          : response.status === 429
            ? 'Слишком много запросов. Подождите и повторите попытку.'
            : `Сервер не выполнил запрос (код ${response.status}). Попробуйте ещё раз.`;

      throw new ApiError(response.status, message);
    }

    const text = await response.text();

    if (!text.trim()) {
      return null as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Сервер вернул некорректный ответ.');
    }
  }

  getChats(signal?: AbortSignal) {
    return this.chatsLane.enqueue(async () => {
      const chats = await this.request<Chat[]>('getChats', undefined, {
        signal,
      });

      if (!Array.isArray(chats)) {
        throw new Error('Не удалось прочитать список чатов.');
      }

      return chats;
    }, signal ?? this.signal);
  }

  getContact(chatId: string, signal?: AbortSignal) {
    return this.contactLane.enqueue(
      () => this.request<Contact>('getContactInfo', { chatId }, { signal }),
      signal ?? this.signal,
      () => (chatId === this.activeChat ? 1 : 0),
    );
  }
  getHistory(chatId: string, signal?: AbortSignal) {
    return this.historyLane.enqueue(
      async () => {
        const messages = await this.request<HistoryMessage[]>(
          'getChatHistory',
          { chatId, count: 100 },
          { signal },
        );

        if (!Array.isArray(messages)) {
          throw new Error('Не удалось прочитать историю чата.');
        }

        return messages;
      },
      signal ?? this.signal,
      () => (chatId === this.activeChat ? 1 : 0),
    );
  }
  checkAccount(phoneNumber: number) {
    return this.request<{ exist: boolean; chatId: string }>('checkAccount', {
      phoneNumber,
    });
  }
  sendMessage(chatId: string, message: string) {
    return this.request<{ idMessage: string }>('sendMessage', {
      chatId,
      message,
    });
  }
  receive(signal?: AbortSignal) {
    return this.request<Notification | null>('receiveNotification', undefined, {
      signal,
      suffix: '?receiveTimeout=5',
    });
  }
  deleteNotification(receiptId: number, signal?: AbortSignal) {
    return this.request<{ result: boolean }>('deleteNotification', undefined, {
      signal,
      verb: 'DELETE',
      suffix: `/${receiptId}`,
    });
  }
}
