import { afterEach, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { SessionProvider } from '@/shared/auth';
import { ToastProvider } from '@/shared/ui';
import { server, apiPath } from '@/test/server';
import { AppRoutes } from '@/app/App';
import { createQueryClient } from '@/app/query-client';
const clients: ReturnType<typeof createQueryClient>[] = [];

afterEach(async () => {
  for (const client of clients) {
    await client.cancelQueries();
    client.clear();
  }
});

function mount(path = '/login') {
  const client = createQueryClient();

  client.setDefaultOptions({
    queries: { retry: false },
    mutations: { retry: false },
  });

  clients.push(client);

  return render(
    <ToastProvider>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </SessionProvider>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

it('logs in, persists the tab session, and logs out', async () => {
  const user = userEvent.setup();

  mount();
  await user.type(screen.getByLabelText('ID инстанса'), '123');
  await user.type(screen.getByLabelText('Токен инстанса'), 'token');
  await user.click(screen.getByRole('button', { name: 'Войти' }));
  expect(
    await screen.findByRole('navigation', { name: 'Список чатов' }),
  ).toBeInTheDocument();

  expect(JSON.parse(sessionStorage.getItem('green-telegram-session')!)).toEqual(
    { idInstance: '123', apiTokenInstance: 'token' },
  );

  await user.click(screen.getByRole('button', { name: 'Меню' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Выйти' }));
  expect(await screen.findByLabelText('ID инстанса')).toBeInTheDocument();
  expect(sessionStorage.getItem('green-telegram-session')).toBeNull();
});

it('restores the session and keeps failed sends as drafts', async () => {
  sessionStorage.setItem(
    'green-telegram-session',
    JSON.stringify({ idInstance: '123', apiTokenInstance: 'token' }),
  );

  server.use(
    http.post(
      `${apiPath}/sendMessage/token`,
      () => new HttpResponse(null, { status: 500 }),
    ),
  );

  const user = userEvent.setup();

  mount('/chats/100');
  const editor = await screen.findByRole('textbox', { name: 'Сообщение' });

  await waitFor(() => expect(editor).toBeEnabled());
  await user.type(editor, 'Сохранить при ошибке');
  await user.click(screen.getByRole('button', { name: 'Отправить сообщение' }));
  expect(
    await screen.findByText(/Сообщение не отправлено/),
  ).toBeInTheDocument();

  expect(editor).toHaveValue('Сохранить при ошибке');
});

it('shows an empty chat list and reports an unknown phone number', async () => {
  sessionStorage.setItem(
    'green-telegram-session',
    JSON.stringify({ idInstance: '123', apiTokenInstance: 'token' }),
  );

  server.use(
    http.get(`${apiPath}/getChats/token`, () => HttpResponse.json([])),
    http.post(`${apiPath}/checkAccount/token`, () =>
      HttpResponse.json({ exist: false }),
    ),
  );

  const user = userEvent.setup();

  mount('/chats');
  expect(
    await screen.findByRole('heading', { name: 'Начните общение' }),
  ).toBeInTheDocument();

  await user.type(
    screen.getByRole('textbox', { name: 'Номер телефона' }),
    '+7 999 123-45-67',
  );

  await user.click(screen.getByRole('button', { name: 'Найти чат' }));
  expect(
    await screen.findByText(/Аккаунт Telegram с этим номером не найден/),
  ).toBeInTheDocument();
});
