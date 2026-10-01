import { describe, expect, it } from 'vitest';
import {
  historyMessages,
  mergeConversation,
  notificationMessage,
  lastSeen,
  type Message,
} from '@/pages/chats/model/messages';
const message: Message = {
  id: '1',
  chatId: '100',
  timestamp: 10,
  direction: 'outgoing',
  text: 'Текст',
  status: 'queued',
};

describe('message reconciliation', () => {
  it('preserves a live message when an older history request completes', () => {
    const result = mergeConversation(
      { messages: [{ ...message, id: 'live', timestamp: 20 }], statuses: {} },
      { messages: [message], statuses: {} },
    );

    expect(result.messages.map((item) => item.id)).toEqual(['1', 'live']);
  });

  it('deduplicates API sends, webhook echoes and repeated receipts', () => {
    const state = { messages: [message], statuses: {} };

    expect(mergeConversation(state, state).messages).toHaveLength(1);
  });

  it('keeps a read status when a stale history or send response arrives', () => {
    const result = mergeConversation(
      { messages: [{ ...message, status: 'read' }], statuses: {} },
      { messages: [message], statuses: {} },
    );

    expect(result.messages[0].status).toBe('read');
  });

  it('retains a delivery status arriving before the message itself', () => {
    const result = mergeConversation(
      { messages: [], statuses: { '1': 'failed' } },
      { messages: [message], statuses: {} },
    );

    expect(result.messages[0].status).toBe('failed');
  });

  it('normalizes plain text and excludes media', () => {
    expect(
      historyMessages([
        {
          idMessage: '1',
          chatId: '100',
          timestamp: 1,
          type: 'incoming',
          typeMessage: 'textMessage',
          textMessage: '<b>hello</b>',
        },
        {
          idMessage: '2',
          chatId: '100',
          timestamp: 2,
          type: 'incoming',
          typeMessage: 'imageMessage',
        },
      ]),
    ).toEqual([
      {
        id: '1',
        chatId: '100',
        timestamp: 1,
        direction: 'incoming',
        text: '<b>hello</b>',
        status: undefined,
      },
    ]);
  });

  it('supports text with URLs but skips group messages', () => {
    const body = {
      typeWebhook: 'incomingMessageReceived',
      idMessage: '1',
      timestamp: 1,
      senderData: { chatId: '100', chatType: 'user' },
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'https://example.com' },
      },
    };

    expect(notificationMessage(body)?.text).toBe('https://example.com');
    expect(
      notificationMessage({
        ...body,
        senderData: { chatId: '-10', chatType: 'group' },
      }),
    ).toBeNull();
  });

  it('does not turn a hidden lastSeen into a date', () => {
    expect(lastSeen(0)).toBe('время посещения скрыто');
  });
});
