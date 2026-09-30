import { test, expect, type Page } from '@playwright/test';

const timestamp = 1750000000;

async function mockApi(page: Page) {
  const queue: unknown[] = [];
  let sends = 0;
  let rejectSend = false;

  const contacts = [
    { chatId: '100', name: 'Анна Смирнова', type: 'user' },
    { chatId: '200', name: 'Михаил Петров', type: 'user' },
    { chatId: '-1', name: 'Группа', type: 'group' },
  ];

  await page.route('https://test.green-api.invalid/**', async (route) => {
    const request = route.request();
    const method = new URL(request.url()).pathname.split('/')[2];
    const body = request.postDataJSON();
    let result: unknown = null;

    if (method === 'getChats') {
      result = contacts;
    }

    if (method === 'getContactInfo') {
      result = {
        chatId: body.chatId,
        name:
          contacts.find((chat) => chat.chatId === body.chatId)?.name ??
          'Новый контакт',
        chatType: 'user',
        lastSeen: 1750000000,
      };
    }

    if (method === 'getChatHistory') {
      result = [
        {
          idMessage: `${body.chatId}-1`,
          chatId: body.chatId,
          type: 'incoming',
          typeMessage: 'textMessage',
          textMessage:
            body.chatId === '100'
              ? 'Привет! Как проходит твой день?'
              : 'До встречи завтра!',
          timestamp,
        },
        {
          idMessage: `${body.chatId}-2`,
          chatId: body.chatId,
          type: 'outgoing',
          typeMessage: 'textMessage',
          textMessage: 'Всё отлично, спасибо! Скоро напишу.',
          timestamp: timestamp + 60,
          statusMessage: 'read',
        },
      ];
    }

    if (method === 'checkAccount') {
      result =
        body.phoneNumber === 79990000000
          ? { exist: false }
          : { exist: true, chatId: '300' };
    }

    if (method === 'sendMessage') {
      sends++;

      if (rejectSend) {
        await route.fulfill({ status: 500, json: {} });

        return;
      }

      result = { idMessage: `sent-${sends}` };
    }

    if (method === 'receiveNotification') {
      result = queue[0] ?? null;
    }

    if (method === 'deleteNotification') {
      queue.shift();
      result = { result: true };
    }

    await route.fulfill({ json: result });
  });

  return {
    queue,
    rejectSend: () => {
      rejectSend = true;
    },
    sends: () => sends,
  };
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('ID инстанса').fill('123');
  await page.getByLabel('Токен инстанса').fill('token');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Список чатов' }),
  ).toBeVisible();
}

test('desktop: send, receive in a closed chat, deduplicate, search and logout', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  const api = await mockApi(page);

  await login(page);
  await expect(page.getByRole('link', { name: /Группа/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Анна Смирнова/ }).click();
  await expect(
    page
      .getByRole('article')
      .filter({ hasText: 'Привет! Как проходит твой день?' }),
  ).toBeVisible();

  const editor = page.getByRole('textbox', { name: 'Сообщение', exact: true });

  await editor.fill('Проверка отправки');
  await editor.press('Enter');
  await expect(
    page.getByRole('article').filter({ hasText: 'Проверка отправки' }),
  ).toHaveCount(1);

  await expect(editor).toHaveValue('');
  api.queue.push({
    receiptId: 1,
    body: {
      typeWebhook: 'outgoingAPIMessageReceived',
      idMessage: 'sent-1',
      timestamp: Math.floor(Date.now() / 1000),
      senderData: { chatId: '100', chatType: 'user' },
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: 'Проверка отправки' },
      },
    },
  });

  await expect.poll(() => api.queue.length, { timeout: 12000 }).toBe(0);
  await expect(
    page.getByRole('article').filter({ hasText: 'Проверка отправки' }),
  ).toHaveCount(1);

  api.queue.push({
    receiptId: 2,
    body: {
      typeWebhook: 'incomingMessageReceived',
      idMessage: 'new-200',
      timestamp: Math.floor(Date.now() / 1000) + 1,
      senderData: {
        chatId: '200',
        chatType: 'user',
        chatName: 'Михаил Петров',
      },
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: 'Увидимся через час' },
      },
    },
  });

  await expect(page.getByRole('link', { name: /Михаил Петров/ })).toContainText(
    'Увидимся через час',
    { timeout: 12000 },
  );

  await expect(
    page.getByRole('navigation').getByRole('link').first(),
  ).toContainText('Михаил Петров');

  await page.getByRole('link', { name: /Михаил Петров/ }).click();
  await expect(
    page.getByRole('article').filter({ hasText: 'Увидимся через час' }),
  ).toBeVisible();

  await page.screenshot({ path: 'test-results/desktop-chat.png' });
  await page
    .getByRole('textbox', { name: 'Номер телефона' })
    .fill('+7 999 123-45-67');

  await page.getByRole('button', { name: 'Найти чат' }).click();
  await expect(page).toHaveURL(/chats\/300$/);
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/login$/);
  expect(
    await page.evaluate(() => sessionStorage.getItem('green-telegram-session')),
  ).toBeNull();

  expect(errors).toEqual([]);
});

test('mobile: single panel navigation and draft recovery across reload and chats', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await login(page);
  await page.getByRole('link', { name: /Анна Смирнова/ }).click();
  const editor = page.getByRole('textbox', { name: 'Сообщение', exact: true });

  await editor.fill('Черновик Анне');
  await editor.press('Shift+Enter');
  await editor.pressSequentially('Вторая строка');
  await page.reload();
  await expect(editor).toHaveValue('Черновик Анне\nВторая строка');
  await expect(
    page.getByRole('navigation', { name: 'Список чатов' }),
  ).not.toBeVisible();

  await page.screenshot({ path: 'test-results/mobile-chat.png' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page.getByRole('link', { name: 'Назад к чатам' }).click();
  await page.getByRole('link', { name: /Михаил Петров/ }).click();
  await expect(editor).toHaveValue('');
  await editor.fill('Другой черновик');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('green-telegram-drafts')!),
  );

  expect(saved.drafts['["123","100"]']).toBe('Черновик Анне\nВторая строка');
  expect(saved.drafts['["123","200"]']).toBe('Другой черновик');
});

test('failures: retain a draft, avoid auto-resending, report an unknown phone', async ({
  page,
}) => {
  const api = await mockApi(page);

  api.rejectSend();
  await login(page);
  await page.getByRole('link', { name: /Анна Смирнова/ }).click();
  const editor = page.getByRole('textbox', { name: 'Сообщение', exact: true });

  await editor.fill('Не потерять этот текст');
  await editor.press('Enter');
  await expect(
    page.getByText(
      'Сообщение не отправлено. Текст сохранён — можно повторить отправку.',
    ),
  ).toBeVisible();

  await expect(editor).toHaveValue('Не потерять этот текст');
  expect(api.sends()).toBe(1);
  await page
    .getByRole('textbox', { name: 'Номер телефона' })
    .fill('79990000000');

  await page.getByRole('button', { name: 'Найти чат' }).click();
  await expect(
    page.getByText(
      'Аккаунт Telegram с этим номером не найден или номер скрыт.',
    ),
  ).toBeVisible();
});

test('login: visual reference and required fields', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/login');
  await expect(
    page.getByRole('button', { name: 'Войти', exact: true }),
  ).toBeDisabled();

  await page.screenshot({ path: 'test-results/login.png' });
});

test('an in-flight send stays locked across chat switches and preserves new edits', async ({
  page,
}) => {
  await mockApi(page);

  let release: () => void = () => {};

  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route('**/sendMessage/**', async (route) => {
    await waiting;
    await route.fulfill({ json: { idMessage: 'delayed-send' } });
  });

  try {
    await login(page);
    await page.getByRole('link', { name: /Анна Смирнова/ }).click();
    const editor = page.getByRole('textbox', {
      name: 'Сообщение',
      exact: true,
    });

    await editor.fill('Первое сообщение');
    await editor.press('Enter');
    await page.getByRole('link', { name: /Михаил Петров/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Михаил Петров' }),
    ).toBeVisible();

    await page.getByRole('link', { name: /Анна Смирнова/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Анна Смирнова' }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Отправить сообщение' }),
    ).toBeDisabled();

    await editor.fill('Следующее сообщение');
    await expect(editor).toHaveValue('Следующее сообщение');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('green-telegram-drafts')!).drafts[
              '["123","100"]'
            ],
        ),
      )
      .toBe('Следующее сообщение');

    release();
    await expect(
      page.getByRole('article').filter({ hasText: 'Первое сообщение' }),
    ).toHaveCount(1);

    await expect(editor).toHaveValue('Следующее сообщение');
    await expect(
      page.getByRole('button', { name: 'Отправить сообщение' }),
    ).toBeEnabled();
  } finally {
    release();
  }
});

test('a contact failure does not block another chat or the conversation', async ({
  page,
}) => {
  await mockApi(page);
  await page.route('**/getContactInfo/**', async (route) => {
    const { chatId } = route.request().postDataJSON();

    if (chatId === '100') {
      await route.fulfill({ status: 500, json: {} });
    } else {
      await route.fallback();
    }
  });

  await login(page);
  await page.getByRole('link', { name: /Анна Смирнова/ }).click();
  await expect(
    page
      .getByRole('article')
      .filter({ hasText: 'Привет! Как проходит твой день?' }),
  ).toBeVisible();

  await expect(page.getByText('Статус недоступен')).toBeVisible();
  await page.getByRole('link', { name: /Михаил Петров/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Михаил Петров' }),
  ).toBeVisible();

  await expect(
    page.getByRole('textbox', { name: 'Сообщение', exact: true }),
  ).toBeEnabled();
});
