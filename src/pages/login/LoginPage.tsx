import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { GreenApi } from '@/shared/api';
import { useSession } from '@/shared/auth';
import { Button, Input, TelegramLogo } from '@/shared/ui';
import styles from '@/pages/login/login.module.css';

export function LoginPage() {
  const [idInstance, setId] = useState('');
  const [apiTokenInstance, setToken] = useState('');
  const session = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const login = useMutation({
    mutationFn: async () => {
      const credentials = {
        idInstance: idInstance.trim(),
        apiTokenInstance: apiTokenInstance.trim(),
      };

      const api = new GreenApi(credentials);

      try {
        const chats = await api.getChats();

        session.login(credentials, api);
        queryClient.setQueryData(['chats', api.idInstance], chats);
      } catch (error) {
        api.close();
        throw error;
      }
    },
    onSuccess: () => navigate('/chats', { replace: true }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    if (!login.isPending) {
      login.mutate();
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.logo}>
          <TelegramLogo />
        </div>
        <h1 id="login-title">Telegram</h1>
        <p className={styles.description}>
          Введите данные инстанса GREEN-API,
          <br />
          чтобы начать общение.
        </p>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label htmlFor="instance">ID инстанса</label>
            <Input
              id="instance"
              name="idInstance"
              inputMode="numeric"
              pattern="[0-9]+"
              autoComplete="username"
              value={idInstance}
              onChange={(event) => setId(event.target.value)}
              required
              disabled={login.isPending}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="token">Токен инстанса</label>
            <Input
              id="token"
              name="apiTokenInstance"
              type="password"
              autoComplete="current-password"
              value={apiTokenInstance}
              onChange={(event) => setToken(event.target.value)}
              required
              disabled={login.isPending}
            />
          </div>
          <p className={styles.hint}>Вход сохранится до закрытия вкладки</p>
          <Button
            className={styles.submit}
            type="submit"
            disabled={
              login.isPending || !idInstance.trim() || !apiTokenInstance.trim()
            }
          >
            {login.isPending ? 'Подключение…' : 'Войти'}
          </Button>
          {login.isError && (
            <p className={styles.error} role="alert">
              {login.error.message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
