import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api';
import { notifyError } from '@/shared/ui';

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!query.meta?.silent) {
          notifyError(error);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.silent) {
          notifyError(error);
        }
      },
    }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        gcTime: Infinity,
        retry: (count, error) =>
          count < 1 &&
          !(
            error instanceof ApiError && [401, 403, 429].includes(error.status)
          ),
        retryDelay: 2000,
      },
      mutations: { retry: false },
    },
  });
}
