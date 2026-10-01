import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router';
import { observer } from 'mobx-react-lite';
import type { Chat, GreenApi } from '@/shared/api';
import { Avatar } from '@/shared/ui';
import { contactQuery, historyQuery } from '@/pages/chats/api/chat-queries';
import { drafts } from '@/pages/chats/model/drafts';
import { formatTime, lastSeen } from '@/pages/chats/model/messages';
import styles from '@/pages/chats/ui/chats.module.css';

export const ChatRow = observer(function ChatRow({
  api,
  chat,
}: {
  api: GreenApi;
  chat: Chat;
}) {
  'use no memo';
  const contact = useQuery({
    ...contactQuery(api, chat.chatId),
    enabled: false,
  });

  const history = useQuery({
    ...historyQuery(api, chat.chatId),
    enabled: false,
  });

  const latest = history.data?.messages.at(-1);
  const draft = drafts.get(api.idInstance, chat.chatId);

  const name =
    contact.data?.contactName || contact.data?.name || chat.name || chat.chatId;

  return (
    <NavLink
      to={`/chats/${encodeURIComponent(chat.chatId)}`}
      className={({ isActive }) =>
        `${styles.chatRow} ${isActive ? styles.activeChat : ''}`
      }
    >
      <Avatar name={name} src={contact.data?.avatar} />
      <div className={styles.chatDetails}>
        <div className={styles.chatTop}>
          <span className={styles.chatName}>{name}</span>
          {latest && (
            <time className={styles.chatTime}>
              {formatTime(latest.timestamp)}
            </time>
          )}
        </div>
        <p className={styles.preview}>
          {draft ? (
            <>
              <span className={styles.draftLabel}>Черновик: </span>
              {draft}
            </>
          ) : latest ? (
            `${latest.direction === 'outgoing' ? 'Вы: ' : ''}${latest.text}`
          ) : history.isError ? (
            'История недоступна'
          ) : history.isPending ? (
            'Загрузка сообщений…'
          ) : (
            'Нет текстовых сообщений'
          )}
        </p>
        <p className={styles.lastSeen}>
          {contact.isError
            ? 'Контакт недоступен'
            : contact.data
              ? lastSeen(contact.data.lastSeen)
              : 'Загрузка контакта…'}
        </p>
      </div>
    </NavLink>
  );
});
