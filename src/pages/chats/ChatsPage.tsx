import {
  useEffect,
  useState,
  useSyncExternalStore,
  useCallback,
  type FormEvent,
} from 'react';
import { Menu } from '@base-ui/react/menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import type { GreenApi } from '@/shared/api';
import { useSession } from '@/shared/auth';
import { Button, Icon, Input } from '@/shared/ui';
import {
  addChat,
  chatsQuery,
  historyKey,
} from '@/pages/chats/api/chat-queries';
import { useNotifications } from '@/pages/chats/api/notifications';
import { hydrateDrafts } from '@/pages/chats/model/drafts';
import type { Conversation } from '@/pages/chats/model/messages';
import { ChatRow } from '@/pages/chats/ui/ChatRow';
import { ChatThread } from '@/pages/chats/ui/ChatThread';
import styles from '@/pages/chats/ui/chats.module.css';

export function ChatsPage({ api }: { api: GreenApi }) {
  const { chatId } = useParams();
  const [phone, setPhone] = useState('');
  const queryClient = useQueryClient();
  const { logout } = useSession();
  const navigate = useNavigate();
  const chats = useQuery(chatsQuery(api));
  const notifications = useNotifications(api);

  const subscribe = useCallback(
    (callback: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryKey[0] === 'history' && event.type === 'updated') {
          callback();
        }
      }),
    [queryClient],
  );

  const snapshot = useCallback(
    () =>
      JSON.stringify(
        Object.fromEntries(
          (chats.data ?? []).map((chat) => [
            chat.chatId,
            queryClient
              .getQueryData<Conversation>(historyKey(api, chat.chatId))
              ?.messages.at(-1)?.timestamp ?? 0,
          ]),
        ),
      ),
    [api, chats.data, queryClient],
  );

  const timestamps: Record<string, number> = JSON.parse(
    useSyncExternalStore(subscribe, snapshot),
  );

  useEffect(() => {
    void hydrateDrafts();
  }, []);

  const search = useMutation({
    mutationFn: async () => {
      const digits = phone.replace(/[\s()+-]/g, '');

      if (!/^\d{7,15}$/.test(digits)) {
        throw new Error(
          'Введите номер в международном формате, например +7 999 123-45-67.',
        );
      }

      const account = await api.checkAccount(Number(digits));

      if (!account?.exist || !account.chatId) {
        throw new Error(
          'Аккаунт Telegram с этим номером не найден или номер скрыт.',
        );
      }

      return account.chatId;
    },
    onSuccess: (id) => {
      if (api.signal.aborted) {
        return;
      }

      addChat(queryClient, api, { chatId: id, name: phone, type: 'user' });
      setPhone('');
      navigate(`/chats/${encodeURIComponent(id)}`);
    },
  });

  function find(event: FormEvent) {
    event.preventDefault();

    if (!search.isPending) {
      search.mutate();
    }
  }

  function exit() {
    logout();
    void queryClient.cancelQueries();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  const sorted = [...(chats.data ?? [])].sort((a, b) => {
    return (
      (timestamps[b.chatId] ?? 0) - (timestamps[a.chatId] ?? 0) ||
      a.name.localeCompare(b.name, 'ru')
    );
  });

  return (
    <main className={`${styles.layout} ${chatId ? styles.chatOpen : ''}`}>
      <aside className={styles.sidebar} aria-label="Чаты">
        <header className={styles.sidebarHeader}>
          <Menu.Root>
            <Menu.Trigger className={styles.iconButton} aria-label="Меню">
              <Icon name="menu" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={8}>
                <Menu.Popup className={styles.menu}>
                  <div className={styles.menuLabel}>
                    Инстанс {api.idInstance}
                  </div>
                  <Menu.Item
                    className={styles.menuItem}
                    onClick={() => void chats.refetch()}
                  >
                    <Icon name="chat" size={20} />
                    Обновить чаты
                  </Menu.Item>
                  <Menu.Item className={styles.menuItem} onClick={exit}>
                    <Icon name="logout" size={20} />
                    Выйти
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <form className={styles.search} onSubmit={find}>
            <Input
              aria-label="Номер телефона"
              type="tel"
              placeholder="Номер телефона"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={search.isPending}
            />
            <Button
              type="submit"
              className={styles.searchButton}
              aria-label="Найти чат"
              disabled={!phone.trim() || search.isPending}
            >
              <Icon name="search" size={20} />
            </Button>
          </form>
        </header>
        <div className={styles.sidebarCaption}>
          <span>Личные сообщения</span>
          <span
            className={
              notifications.isError ? styles.offlineDot : styles.onlineDot
            }
            title={
              notifications.isError
                ? 'Нет связи. Повторяем подключение…'
                : 'Получение уведомлений включено'
            }
            aria-label={
              notifications.isError
                ? 'Нет связи'
                : 'Получение уведомлений включено'
            }
          />
        </div>
        {notifications.isError && (
          <p className={styles.connectionError} role="status">
            Нет связи. Повторяем подключение…
          </p>
        )}
        <nav className={styles.chatList} aria-label="Список чатов">
          {chats.isPending && (
            <p className={styles.emptySidebar} role="status">
              Загрузка чатов…
            </p>
          )}
          {chats.isError && (
            <div className={styles.emptySidebar}>
              <p>Не удалось загрузить чаты</p>
              <Button onClick={() => void chats.refetch()}>Повторить</Button>
            </div>
          )}
          {chats.isSuccess && !sorted.length && (
            <div className={styles.emptySidebar}>
              <Icon name="chat" size={40} />
              <h2>Начните общение</h2>
              <p>
                Введите номер телефона сверху,
                <br />
                чтобы открыть первый чат.
              </p>
            </div>
          )}
          {sorted.map((chat) => (
            <ChatRow key={chat.chatId} api={api} chat={chat} />
          ))}
        </nav>
      </aside>
      <div className={styles.mainPanel}>
        {chatId ? (
          <ChatThread
            key={chatId}
            api={api}
            chatId={chatId}
            chat={chats.data?.find((chat) => chat.chatId === chatId)}
          />
        ) : (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>
              <Icon name="chat" size={40} />
            </div>
            <h1>Ваши сообщения — здесь</h1>
            <p>
              Выберите чат или найдите собеседника
              <br />
              по номеру телефона.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
