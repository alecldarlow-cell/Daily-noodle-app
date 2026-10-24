import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** React Query for the app: refetch on returning to the app, as the site does on resume. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 2, staleTime: 5 * 60_000, gcTime: 24 * 60 * 60_000 },
    },
  });
}

export function QueryProvider({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [qc] = useState(() => client ?? createQueryClient());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) =>
      focusManager.setFocused(s === 'active'),
    );
    return () => sub.remove();
  }, []);
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
