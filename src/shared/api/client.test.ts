import { afterEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, apiPath, host } from '@/test/server';
import { apiHost, GreenApi } from '@/shared/api/client';
const apis: GreenApi[] = [];

function createApi() {
  const api = new GreenApi(
    { idInstance: '123', apiTokenInstance: 'token' },
    host,
  );

  apis.push(api);

  return api;
}

afterEach(() => {
  apis.forEach((api) => api.close());
});

it('does not expose the token or response body in errors', async () => {
  server.use(
    http.get(
      `${apiPath}/getChats/token`,
      () => new HttpResponse('secret-token', { status: 401 }),
    ),
  );

  await expect(createApi().getChats()).rejects.toThrow('Доступ отклонён');
});

it('handles an empty notification response', async () => {
  server.use(
    http.get(
      `${apiPath}/receiveNotification/token`,
      () => new HttpResponse(null, { status: 200 }),
    ),
  );

  expect(await createApi().receive()).toBeNull();
});

it('cancels requests after logout', async () => {
  const api = createApi();

  api.close();
  await expect(api.sendMessage('100', 'test')).rejects.toMatchObject({
    name: 'AbortError',
  });
});

it('requires explicit API configuration', () => {
  vi.stubEnv('VITE_GREEN_API_URL', '');
  expect(apiHost).toThrow('VITE_GREEN_API_URL');
  vi.stubEnv('VITE_GREEN_API_URL', host);
});

it('spaces history requests and prioritizes the opened chat', async () => {
  const order: string[] = [];
  const times: number[] = [];

  server.use(
    http.post(`${apiPath}/getChatHistory/token`, async ({ request }) => {
      const { chatId } = (await request.json()) as { chatId: string };

      order.push(chatId);
      times.push(Date.now());

      return HttpResponse.json([]);
    }),
  );

  const api = createApi();
  const first = api.getHistory('100');
  const background = api.getHistory('200');
  const active = api.getHistory('300');

  api.prioritize('300');
  await Promise.all([first, background, active]);
  expect(order[0]).toBe('300');
  expect(times[1] - times[0]).toBeGreaterThanOrEqual(1000);
  expect(times[2] - times[1]).toBeGreaterThanOrEqual(1000);
}, 6000);
