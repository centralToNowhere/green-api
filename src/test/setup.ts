import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';

beforeAll(() => {
  vi.stubEnv('VITE_GREEN_API_URL', 'https://test.green-api.invalid');
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  localStorage.clear();
});

afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});
