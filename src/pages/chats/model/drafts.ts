import { makeAutoObservable, runInAction } from 'mobx';
import { create, persist } from 'mobx-persist';
import { notifyError } from '@/shared/ui';

export class DraftStore {
  drafts: Record<string, string> = {};
  ready = false;
  constructor() {
    makeAutoObservable(this);
    persist({ drafts: { type: 'object' } })(this);
  }
  key(instance: string, chatId: string) {
    return JSON.stringify([instance, chatId]);
  }
  get(instance: string, chatId: string) {
    return this.drafts[this.key(instance, chatId)] ?? '';
  }
  set(instance: string, chatId: string, text: string) {
    if (!this.ready) {
      return;
    }

    const key = this.key(instance, chatId);

    if (text) {
      this.drafts[key] = text;
    } else {
      delete this.drafts[key];
    }
  }
  clearSent(instance: string, chatId: string, sentText: string) {
    if (this.get(instance, chatId) === sentText) {
      this.set(instance, chatId, '');
    }
  }
}

export const drafts = new DraftStore();
let hydration: Promise<void> | undefined;

export function hydrateDrafts() {
  if (!hydration) {
    // The adapter handles quota/private-mode failures without an unhandled rejection.
    const storage = {
      async getItem(key: string) {
        try {
          const raw = localStorage.getItem(key);

          if (!raw) {
            return null;
          }

          const parsed = JSON.parse(raw);

          if (
            !parsed ||
            typeof parsed.drafts !== 'object' ||
            Array.isArray(parsed.drafts) ||
            !parsed.drafts
          ) {
            throw new Error();
          }

          const valid = Object.fromEntries(
            Object.entries(parsed.drafts).filter(([key, value]) => {
              try {
                const pair = JSON.parse(key);

                return (
                  Array.isArray(pair) &&
                  pair.length === 2 &&
                  pair.every((item) => typeof item === 'string') &&
                  typeof value === 'string'
                );
              } catch {
                return false;
              }
            }),
          );

          return JSON.stringify({ drafts: valid });
        } catch {
          notifyError(
            new Error(
              'Не удалось восстановить черновики. Новые сообщения можно вводить.',
            ),
          );

          return null;
        }
      },
      async setItem(key: string, value: string) {
        try {
          localStorage.setItem(key, value);
        } catch {
          notifyError(new Error('Не удалось сохранить черновики в браузере.'));
        }
      },
    };

    hydration = create({ storage, jsonify: true })(
      'green-telegram-drafts',
      drafts,
    )
      .then(() => {
        runInAction(() => {
          drafts.ready = true;
        });
      })
      .catch(() => {
        runInAction(() => {
          drafts.ready = true;
        });

        notifyError(new Error('Не удалось восстановить черновики.'));
      });
  }

  return hydration;
}
