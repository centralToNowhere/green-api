import { lazy, Suspense, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { SessionProvider, useSession } from '../shared/auth';
import { ToastProvider } from '../shared/ui';
import { LoginPage } from '../pages/login';
const ChatsPage = lazy(() =>
  import('../pages/chats').then((module) => ({ default: module.ChatsPage })),
);

import { createQueryClient } from './query-client';

export function AppRoutes() {
  const { api } = useSession();

  return (
    <Suspense
      fallback={
        <div role="status" style={{ padding: 24 }}>
          Загрузка…
        </div>
      }
    >
      <Routes>
        <Route
          path="/login"
          element={api ? <Navigate to="/chats" replace /> : <LoginPage />}
        />
        <Route
          path="/chats/:chatId?"
          element={
            api ? (
              <ChatsPage key={api.idInstance} api={api} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={api ? '/chats' : '/login'} replace />}
        />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const [client] = useState(createQueryClient);

  return (
    <ToastProvider>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SessionProvider>
      </QueryClientProvider>
    </ToastProvider>
  );
}
