import { useState, type ReactNode } from 'react';
import { SessionContext } from '@/shared/auth/session-context';
import { notifyError } from '@/shared/ui';
import { GreenApi, type Credentials } from '@/shared/api';

const storageKey = 'green-telegram-session';

function restore(): GreenApi | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');

    if (
      typeof value?.idInstance === 'string' &&
      /^\d+$/.test(value.idInstance) &&
      typeof value.apiTokenInstance === 'string' &&
      value.apiTokenInstance.trim()
    ) {
      return new GreenApi(value);
    }
  } catch {
    /* Missing configuration or invalid storage returns to the login screen. */
  }

  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState(restore);

  function login(credentials: Credentials, connectedApi: GreenApi) {
    sessionStorage.setItem(storageKey, JSON.stringify(credentials));
    api?.close();
    setApi(connectedApi);
  }

  function logout() {
    api?.close();

    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      notifyError(
        new Error(
          'Не удалось очистить данные вкладки. Закройте её для завершения сессии.',
        ),
      );
    }

    setApi(null);
  }

  return (
    <SessionContext.Provider value={{ api, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
