import { useEffect, useRef } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { GreenApi, Notification } from '@/shared/api';
import { notifyError } from '@/shared/ui';
import { notificationMessage } from '@/pages/chats/model/messages';
import { addChat, updateConversation } from '@/pages/chats/api/chat-queries';

export function applyNotification(
  client: QueryClient,
  api: GreenApi,
  notification: Notification,
) {
  const body = notification.body;

  if (!body || typeof body !== 'object') {
    return;
  }

  const message = notificationMessage(body);

  if (message) {
    addChat(client, api, {
      chatId: message.chatId,
      name:
        body.senderData?.chatName ||
        body.senderData?.senderName ||
        message.chatId,
      type: 'user',
    });

    updateConversation(client, api, message.chatId, {
      messages: [message],
      statuses: {},
    });
  } else if (
    body.typeWebhook === 'outgoingMessageStatus' &&
    body.chatId &&
    !body.chatId.startsWith('-') &&
    body.idMessage &&
    body.status
  ) {
    updateConversation(client, api, body.chatId, {
      messages: [],
      statuses: { [body.idMessage]: body.status },
    });

    if (body.status === 'failed' || body.status === 'noAccount') {
      notifyError(
        new Error(
          'Сообщение не доставлено. Проверьте номер получателя и попробуйте отправить его снова.',
        ),
      );
    }
  }
}

export function useNotifications(api: GreenApi) {
  const client = useQueryClient();
  const outageReported = useRef(false);

  const { mutateAsync: acknowledge } = useMutation({
    meta: { silent: true },
    mutationFn: async ({
      receiptId,
      signal,
    }: {
      receiptId: number;
      signal: AbortSignal;
    }) => {
      const result = await api.deleteNotification(receiptId, signal);

      if (!result?.result) {
        throw new Error(
          'Не удалось подтвердить получение уведомления. Повторим автоматически.',
        );
      }
    },
  });

  const query = useQuery({
    meta: { silent: true },
    queryKey: ['notifications', api.idInstance],
    queryFn: async ({ signal }) => {
      const notification = await api.receive(signal);

      signal.throwIfAborted();

      if (notification) {
        applyNotification(client, api, notification);
        await acknowledge({ receiptId: notification.receiptId, signal });
      }

      return Date.now();
    },
    refetchInterval: (query) => {
      if (query.state.status === 'error') {
        return 5000;
      }

      return 100;
    },
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    gcTime: 0,
  });

  useEffect(() => {
    if (query.isError && !outageReported.current) {
      notifyError(query.error);
      outageReported.current = true;
    } else if (query.isSuccess) {
      outageReported.current = false;
    }
  }, [query.isError, query.isSuccess, query.error]);

  return query;
}
