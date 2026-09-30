import { afterEach, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { GreenApi, type Notification, type Chat } from '../../../shared/api';
import { server, apiPath, host } from '../../../test/server';
import { applyNotification, useNotifications } from './notifications';
import { chatKey, historyKey } from './chat-queries';
import type { Conversation } from '../model/messages';

const api = new GreenApi(
  { idInstance: '123', apiTokenInstance: 'token' },
  host,
);

const clients: QueryClient[] = [];

function client() {
  const value = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  clients.push(value);

  return value;
}

afterEach(async () => {
  for (const item of clients) {
    await item.cancelQueries();
    item.clear();
  }
});

const notification: Notification = {
  receiptId: 1,
  body: {
    typeWebhook: 'incomingMessageReceived',
    timestamp: 20,
    idMessage: 'new',
    senderData: { chatId: '200', chatType: 'user', chatName: 'Борис' },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: 'Новое сообщение' },
    },
  },
};

it('updates a closed chat and inserts an unknown sender without duplicates', () => {
  const cache = client();

  applyNotification(cache, api, notification);
  applyNotification(cache, api, notification);
  expect(cache.getQueryData<Chat[]>(chatKey(api))).toHaveLength(1);
  expect(
    cache.getQueryData<Conversation>(historyKey(api, '200'))?.messages,
  ).toHaveLength(1);
});

it('retries receipt confirmation without duplicating processed messages', async () => {
  let attempts = 0;

  server.use(
    http.get(`${apiPath}/receiveNotification/token`, () =>
      HttpResponse.json(notification),
    ),
    http.delete(`${apiPath}/deleteNotification/token/1`, () => {
      attempts++;

      return attempts === 1
        ? new HttpResponse(null, { status: 500 })
        : HttpResponse.json({ result: true });
    }),
  );

  const cache = client();

  const { result } = renderHook(() => useNotifications(api), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    ),
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  await result.current.refetch();
  expect(attempts).toBe(2);
  expect(
    cache.getQueryData<Conversation>(historyKey(api, '200'))?.messages,
  ).toHaveLength(1);
});

it('acknowledges unsupported events so the queue can advance', async () => {
  let deleted = false;

  server.use(
    http.get(`${apiPath}/receiveNotification/token`, () =>
      HttpResponse.json({
        receiptId: 2,
        body: { typeWebhook: 'stateInstanceChanged' },
      }),
    ),
    http.delete(`${apiPath}/deleteNotification/token/2`, () => {
      deleted = true;

      return HttpResponse.json({ result: true });
    }),
  );

  const cache = client();

  renderHook(() => useNotifications(api), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    ),
  });

  await waitFor(() => expect(deleted).toBe(true));
  expect(cache.getQueryData(chatKey(api))).toBeUndefined();
});
