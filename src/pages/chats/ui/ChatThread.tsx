import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { Chat, GreenApi } from '../../../shared/api';
import { Avatar, Button, Icon } from '../../../shared/ui';
import { contactQuery, historyQuery } from '../api/chat-queries';
import {
  emptyConversation,
  formatDay,
  formatTime,
  lastSeen,
} from '../model/messages';
import { MessageEditor } from './MessageEditor';
import styles from './chats.module.css';

export function ChatThread({
  api,
  chatId,
  chat,
}: {
  api: GreenApi;
  chatId: string;
  chat?: Chat;
}) {
  const contact = useQuery({
    ...contactQuery(api, chatId),
    refetchInterval: 60000,
  });

  // const personal = chat?.type === 'user' || contact.data?.chatType === 'user';
  const personal = true;

  const history = useQuery({
    ...historyQuery(api, chatId),
    enabled: personal,
    refetchOnMount: 'always',
  });

  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const initial = useRef(true);
  const messages = history.data?.messages ?? emptyConversation.messages;

  const name =
    contact.data?.contactName || contact.data?.name || chat?.name || chatId;

  useEffect(() => {
    api.prioritize(chatId);

    return () => api.prioritize();
  }, [api, chatId]);

  useLayoutEffect(() => {
    if (scroller.current && (nearBottom.current || initial.current)) {
      scroller.current.scrollTop = scroller.current.scrollHeight;

      if (messages.length) {
        initial.current = false;
      }
    }
  }, [messages]);

  function scrollToBottom() {
    nearBottom.current = true;
    requestAnimationFrame(() => {
      if (scroller.current) {
        scroller.current.scrollTop = scroller.current.scrollHeight;
      }
    });
  }

  return (
    <section className={styles.thread} aria-label={`Переписка с ${name}`}>
      <header className={styles.threadHeader}>
        <Link className={styles.back} to="/chats" aria-label="Назад к чатам">
          <Icon name="back" />
        </Link>
        <Avatar name={name} src={contact.data?.avatar} small />
        <div className={styles.contactHeading}>
          <h1>{name}</h1>
          <p>
            {contact.isPending
              ? 'Загрузка контакта…'
              : contact.isError
                ? 'Статус недоступен'
                : lastSeen(contact.data?.lastSeen)}
          </p>
        </div>
        {contact.isError && (
          <Button
            className={styles.subtleButton}
            onClick={() => void contact.refetch()}
          >
            Повторить
          </Button>
        )}
      </header>
      <div
        className={styles.history}
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget;

          nearBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            100;
        }}
      >
        <div className={styles.messageList}>
          {!personal && !contact.isPending && !contact.isError && (
            <p className={styles.centerPill}>
              Поддерживаются только личные чаты
            </p>
          )}
          {(contact.isPending || (personal && history.isPending)) && (
            <p className={styles.centerPill} role="status">
              Загрузка переписки…
            </p>
          )}
          {history.isError && (
            <div className={styles.inlineError}>
              <p>Не удалось загрузить историю</p>
              <Button onClick={() => void history.refetch()}>Повторить</Button>
            </div>
          )}
          {personal && history.isSuccess && messages.length === 0 && (
            <p className={styles.centerPill}>
              Пока нет текстовых сообщений. Начните общение!
            </p>
          )}
          {messages.map((message, index) => {
            const date = formatDay(message.timestamp);

            const showDate =
              index === 0 || date !== formatDay(messages[index - 1].timestamp);

            const failed =
              message.status === 'failed' || message.status === 'noAccount';

            return (
              <Fragment key={message.id}>
                {showDate && <div className={styles.dateSeparator}>{date}</div>}
                <article
                  className={`${styles.message} ${message.direction === 'outgoing' ? styles.outgoing : styles.incoming}`}
                  aria-label={
                    message.direction === 'outgoing'
                      ? 'Исходящее сообщение'
                      : 'Входящее сообщение'
                  }
                >
                  <div className={styles.messageText}>{message.text}</div>
                  <div className={styles.messageMeta}>
                    <time
                      dateTime={new Date(
                        message.timestamp * 1000,
                      ).toISOString()}
                    >
                      {formatTime(message.timestamp)}
                    </time>
                    {message.direction === 'outgoing' && (
                      <span
                        className={
                          failed
                            ? styles.failedStatus
                            : message.status === 'read'
                              ? styles.readStatus
                              : ''
                        }
                        aria-label={
                          failed
                            ? 'Не доставлено'
                            : message.status === 'read'
                              ? 'Прочитано'
                              : message.status === 'delivered'
                                ? 'Доставлено'
                                : 'В очереди'
                        }
                        title={
                          failed
                            ? 'Не доставлено'
                            : message.status === 'read'
                              ? 'Прочитано'
                              : message.status === 'delivered'
                                ? 'Доставлено'
                                : 'В очереди'
                        }
                      >
                        {failed
                          ? '!'
                          : ['delivered', 'read'].includes(message.status ?? '')
                            ? '✓✓'
                            : '✓'}
                      </span>
                    )}
                  </div>
                </article>
              </Fragment>
            );
          })}
        </div>
      </div>
      {personal && (
        <MessageEditor
          key={chatId}
          api={api}
          chatId={chatId}
          onSent={scrollToBottom}
        />
      )}
    </section>
  );
}
