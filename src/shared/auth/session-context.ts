import { createContext, useContext } from 'react';
import type { GreenApi, Credentials } from '../api';
export const SessionContext = createContext<{
  api: GreenApi | null;
  login: (credentials: Credentials, api: GreenApi) => void;
  logout: () => void;
} | null>(null);

export function useSession() {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error('SessionProvider is required');
  }

  return session;
}
