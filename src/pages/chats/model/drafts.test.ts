import { expect, it } from 'vitest';
import { runInAction } from 'mobx';
import { create } from 'mobx-persist';
import { DraftStore } from '@/pages/chats/model/drafts';

it('persists and restores drafts using only instance and chat', async () => {
  const storage = new Map<string, string>();

  const adapter = {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
  };

  const hydrate = create({ storage: adapter });
  const first = new DraftStore();

  await hydrate('drafts', first);
  runInAction(() => {
    first.ready = true;
  });

  first.set('123', '100', 'Первый');
  first.set('123', '200', 'Второй');
  first.set('456', '100', 'Другой инстанс');
  const restored = new DraftStore();

  await hydrate('drafts', restored);
  expect(restored.get('123', '100')).toBe('Первый');
  expect(restored.get('123', '200')).toBe('Второй');
  expect(restored.get('456', '100')).toBe('Другой инстанс');
  expect(Object.keys(restored.drafts)).toEqual([
    '["123","100"]',
    '["123","200"]',
    '["456","100"]',
  ]);
});

it('does not erase edits typed while sending', () => {
  const store = new DraftStore();

  runInAction(() => {
    store.ready = true;
  });

  store.set('1', '2', 'Новое сообщение');
  store.clearSent('1', '2', 'Отправленное сообщение');
  expect(store.get('1', '2')).toBe('Новое сообщение');
  store.clearSent('1', '2', 'Новое сообщение');
  expect(store.get('1', '2')).toBe('');
});

it('blocks editing until hydration finishes', () => {
  const store = new DraftStore();

  store.set('1', '2', 'Не перезаписывать сохранённый текст');
  expect(store.get('1', '2')).toBe('');
});
