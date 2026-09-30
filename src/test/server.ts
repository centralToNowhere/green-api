import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
export const host = 'https://test.green-api.invalid';
export const apiPath = `${host}/waInstance123`;
export const server = setupServer(
  http.get(`${apiPath}/getChats/token`, () =>
    HttpResponse.json([
      { chatId: '100', name: 'Анна', type: 'user' },
      { chatId: '-10', name: 'Группа', type: 'group' },
    ]),
  ),
  http.post(`${apiPath}/getContactInfo/token`, async ({ request }) => {
    const { chatId } = (await request.json()) as { chatId: string };

    return HttpResponse.json({
      chatId,
      name: chatId === '100' ? 'Анна' : 'Борис',
      chatType: 'user',
      lastSeen: 0,
    });
  }),
  http.post(`${apiPath}/getChatHistory/token`, async ({ request }) => {
    const { chatId } = (await request.json()) as { chatId: string };

    return HttpResponse.json([
      {
        idMessage: 'old',
        chatId,
        type: 'incoming',
        typeMessage: 'textMessage',
        textMessage: 'Привет!',
        timestamp: 1750000000,
      },
    ]);
  }),
  http.get(`${apiPath}/receiveNotification/token`, () =>
    HttpResponse.json(null),
  ),
  http.delete(`${apiPath}/deleteNotification/token/:receipt`, () =>
    HttpResponse.json({ result: true }),
  ),
  http.post(`${apiPath}/checkAccount/token`, () =>
    HttpResponse.json({ exist: true, chatId: '200' }),
  ),
  http.post(`${apiPath}/sendMessage/token`, () =>
    HttpResponse.json({ idMessage: 'sent' }),
  ),
);
