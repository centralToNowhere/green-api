import { Toast } from '@base-ui/react/toast';
export const manager = Toast.createToastManager();
const recent = new Map<string, number>();

export function notifyError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return;
  }

  const message =
    error instanceof Error ? error.message : 'Не удалось выполнить действие.';

  const now = Date.now();

  if (now - (recent.get(message) ?? 0) < 10000) {
    return;
  }

  for (const [key, time] of recent) {
    if (now - time > 10000) {
      recent.delete(key);
    }
  }

  recent.set(message, now);
  manager.add({
    title: 'Не удалось выполнить действие',
    description: message,
    type: 'error',
  });
}
