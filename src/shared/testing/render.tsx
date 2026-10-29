/* Test helpers: render inside the app's providers with a quiet query client. */
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { NETWORK_DEFAULTS, QueryProvider } from '@/shared/query';

export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { ...NETWORK_DEFAULTS.queries, retry: false, gcTime: Infinity },
      mutations: NETWORK_DEFAULTS.mutations,
    },
  });
}

export async function renderWithProviders(
  ui: ReactElement,
  client: QueryClient = testQueryClient(),
) {
  const result = await render(<QueryProvider client={client}>{ui}</QueryProvider>);
  return { client, ...result };
}

/** A fetch mock answering by path, as the site would. */
export function mockSite(routes: Record<string, unknown | (() => unknown)>) {
  const fn = jest.fn(async (url: string) => {
    const path = String(url).replace('https://dailynoodle.co.uk/', '');
    if (!(path in routes)) return { ok: false, status: 404, json: async () => ({}) };
    const body = routes[path];
    const value = typeof body === 'function' ? (body as () => unknown)() : body;
    if (value instanceof Error) throw value;
    return { ok: true, status: 200, json: async () => value };
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}
