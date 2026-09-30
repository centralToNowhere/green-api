import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Chat, GreenApi } from '../../../shared/api';
import {
  historyMessages,
  mergeConversation,
  type Conversation,
} from '../model/messages';

export const chatKey = (api: GreenApi) => ['chats', api.idInstance] as const;
export const contactKey = (api: GreenApi, chatId: string) =>
  ['contact', api.idInstance, chatId] as const;
export const historyKey = (api: GreenApi, chatId: string) =>
  ['history', api.idInstance, chatId] as const;

export function chatsQuery(api: GreenApi) {
  return queryOptions({
    queryKey: chatKey(api),
    queryFn: ({ signal }) => api.getChats(signal),
    staleTime: 60000,
    structuralSharing: (old, next) => {
      const byId = new Map(
        (old as Chat[] | undefined)?.map((chat) => [chat.chatId, chat]),
      );

      for (const chat of next as Chat[]) {
        byId.set(chat.chatId, chat);
      }

      return [...byId.values()];
    },
  });
}

export function contactQuery(api: GreenApi, chatId: string) {
  return queryOptions({
    queryKey: contactKey(api, chatId),
    queryFn: ({ signal }) => api.getContact(chatId, signal),
    staleTime: 60000,
  });
}

export function historyQuery(api: GreenApi, chatId: string) {
  return queryOptions({
    queryKey: historyKey(api, chatId),
    queryFn: async ({ signal }): Promise<Conversation> => ({
      messages: historyMessages(await api.getHistory(chatId, signal)),
      statuses: {},
    }),
    staleTime: 30000,
    structuralSharing: (old, next) =>
      mergeConversation(old as Conversation | undefined, next as Conversation),
  });
}

export function addChat(client: QueryClient, api: GreenApi, chat: Chat) {
  client.setQueryData<Chat[]>(chatKey(api), (old) => {
    if (old?.some((item) => item.chatId === chat.chatId)) {
      return old;
    }

    return [...(old ?? []), chat];
  });
}

export function updateConversation(
  client: QueryClient,
  api: GreenApi,
  chatId: string,
  change: Conversation,
) {
  client.setQueryData<Conversation>(historyKey(api, chatId), (old) =>
    mergeConversation(old, change),
  );
}
