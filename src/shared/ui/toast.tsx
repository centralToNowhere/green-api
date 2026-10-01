import { Toast } from '@base-ui/react/toast';
import type { ReactNode } from 'react';
import { Icon } from '@/shared/ui/icons';
import styles from '@/shared/ui/ui.module.css';

import { manager } from '@/shared/ui/toast-manager';

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      <Toast.Viewport className={styles.toastViewport}>
        {toasts.map((toast) => (
          <Toast.Root key={toast.id} toast={toast} className={styles.toast}>
            <Toast.Content>
              <Toast.Title className={styles.toastTitle} />
              <Toast.Description className={styles.toastDescription} />
            </Toast.Content>
            <Toast.Close
              className={styles.toastClose}
              aria-label="Закрыть уведомление"
            >
              <Icon name="close" size={18} />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={manager} timeout={6000} limit={3}>
      {children}
      <ToastList />
    </Toast.Provider>
  );
}
