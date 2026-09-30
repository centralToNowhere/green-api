import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { GreenApi } from '../../../shared/api';
import { Button, Icon } from '../../../shared/ui';
import { drafts, hydrateDrafts } from '../model/drafts';
import { updateConversation } from '../api/chat-queries';
import styles from './chats.module.css';

export const MessageEditor = observer(function messageEditor({
  api,
  chatId,
  onSent,
}: {
  api: GreenApi;
  chatId: string;
  onSent: () => void;
}) {
  'use no memo';
  const queryClient = useQueryClient();

  const sending =
    useIsMutating({ mutationKey: ['send', api.idInstance, chatId] }) > 0;

  const input = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const text = drafts.get(api.idInstance, chatId);

  useEffect(() => {
    void hydrateDrafts();
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (input.current) {
      input.current.style.height = 'auto';
      input.current.style.height = `${Math.min(input.current.scrollHeight, 160)}px`;
    }
  }, [text]);

  const send = useMutation({
    mutationKey: ['send', api.idInstance, chatId],
    mutationFn: async (message: string) => {
      const response = await api.sendMessage(chatId, message);

      if (!response?.idMessage) {
        throw new Error(
          'Сервер не подтвердил отправку. Проверьте историю перед повторной попыткой.',
        );
      }

      return response;
    },
    onSuccess: (response, sentText) => {
      if (api.signal.aborted) {
        return;
      }

      updateConversation(queryClient, api, chatId, {
        messages: [
          {
            id: response.idMessage,
            chatId,
            text: sentText,
            direction: 'outgoing',
            timestamp: Math.floor(Date.now() / 1000),
            status: 'queued',
          },
        ],
        statuses: {},
      });

      drafts.clearSent(api.idInstance, chatId, sentText);

      if (mounted.current) {
        onSent();
        input.current?.focus();
      }
    },
    onSettled: () => {
      lock.current = false;
    },
  });

  function submit() {
    if (
      !text.trim() ||
      text.length > 4096 ||
      lock.current ||
      sending ||
      !drafts.ready
    ) {
      return;
    }

    lock.current = true;
    send.mutate(text);
  }

  return (
    <div className={styles.messageEditorArea}>
      {send.isError && (
        <p className={styles.sendError} role="status">
          Сообщение не отправлено. Текст сохранён — можно повторить отправку.
        </p>
      )}
      <form
        className={styles.messageEditor}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={input}
          aria-label="Сообщение"
          placeholder={
            drafts.ready ? 'Написать сообщение…' : 'Восстановление черновика…'
          }
          value={text}
          disabled={!drafts.ready}
          maxLength={4096}
          rows={1}
          onChange={(event) =>
            drafts.set(api.idInstance, chatId, event.target.value)
          }
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="submit"
          className={styles.sendButton}
          aria-label="Отправить сообщение"
          disabled={!text.trim() || sending || !drafts.ready}
        >
          <Icon name="send" />
        </Button>
      </form>
    </div>
  );
});
