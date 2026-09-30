import type { HistoryMessage, Notification } from '../../../shared/api';

export interface Message {
  id: string;
  chatId: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  text: string;
  status?: string;
}
export interface Conversation {
  messages: Message[];
  statuses: Record<string, string>;
}
export const emptyConversation: Conversation = { messages: [], statuses: {} };

export function historyMessages(rows: HistoryMessage[]): Message[] {
  return rows.flatMap((row) => {
    const text =
      row.typeMessage === 'textMessage'
        ? row.textMessage
        : row.typeMessage === 'extendedTextMessage'
          ? (row.extendedTextMessage?.text ?? row.textMessage)
          : undefined;

    return typeof text === 'string'
      ? [
          {
            id: row.idMessage,
            chatId: row.chatId,
            timestamp: row.timestamp,
            direction: row.type,
            text,
            status: row.statusMessage,
          },
        ]
      : [];
  });
}

function latestStatus(old?: string, next?: string) {
  if (!next) {
    return old;
  }

  if (old === 'read') {
    return old;
  }

  if (next === 'failed' || next === 'noAccount') {
    return next;
  }

  const rank: Record<string, number> = {
    queued: 0,
    sent: 1,
    delivered: 2,
    read: 3,
  };

  return (rank[old ?? ''] ?? -1) > (rank[next] ?? -1) ? old : next;
}

export function mergeConversation(
  previous: Conversation | undefined,
  incoming: Conversation,
): Conversation {
  const statuses = { ...previous?.statuses };

  for (const [id, status] of Object.entries(incoming.statuses)) {
    statuses[id] = latestStatus(statuses[id], status)!;
  }

  const messages = new Map(
    previous?.messages.map((message) => [message.id, message]),
  );

  for (const message of incoming.messages) {
    const old = messages.get(message.id);

    messages.set(message.id, {
      ...old,
      ...message,
      status: latestStatus(old?.status, message.status),
    });
  }

  return {
    statuses,
    messages: [...messages.values()]
      .map((message) => ({
        ...message,
        status: latestStatus(message.status, statuses[message.id]),
      }))
      .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)),
  };
}

export function notificationMessage(
  body: Notification['body'],
): Message | null {
  if (
    ![
      'incomingMessageReceived',
      'outgoingMessageReceived',
      'outgoingAPIMessageReceived',
    ].includes(body.typeWebhook)
  ) {
    return null;
  }

  const sender = body.senderData;

  if (
    !sender ||
    (sender.chatType && sender.chatType !== 'user') ||
    sender.chatId.startsWith('-')
  ) {
    return null;
  }

  const text =
    body.messageData?.typeMessage === 'textMessage'
      ? body.messageData.textMessageData?.textMessage
      : body.messageData?.typeMessage === 'extendedTextMessage'
        ? body.messageData.extendedTextMessageData?.text
        : undefined;

  if (
    typeof text !== 'string' ||
    !body.idMessage ||
    typeof body.timestamp !== 'number'
  ) {
    return null;
  }

  return {
    id: body.idMessage,
    chatId: sender.chatId,
    timestamp: body.timestamp,
    direction:
      body.typeWebhook === 'incomingMessageReceived' ? 'incoming' : 'outgoing',
    text,
  };
}

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('ru', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp * 1000);
}

export function formatDay(timestamp: number) {
  return new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(timestamp * 1000);
}

export function lastSeen(timestamp?: number) {
  return timestamp
    ? `был(а) ${new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(timestamp * 1000)}`
    : 'время посещения скрыто';
}
