import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
  type DefaultOptions,
  type Query,
} from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * When the connection comes back (R6): a query whose last load failed loads again at once,
 * even if its data is still fresh, so Today and Archive fill in without a tap; the rest
 * refresh only if stale, as React Query does by default.
 */
export function refetchOnReconnect(q: Query): boolean | 'always' {
  return q.state.status === 'error' || q.state.fetchFailureCount > 0 ? 'always' : true;
}

/**
 * How every query and mutation treats the network. `networkMode: 'always'` keeps loads
 * running (and failing, so the screens can say "You're offline") whatever the phone's
 * network status says; the status is used only to reload when the connection returns.
 */
export const NETWORK_DEFAULTS = {
  queries: { networkMode: 'always', refetchOnReconnect },
  mutations: { networkMode: 'always' },
} as const satisfies DefaultOptions;

/** React Query for the app: refetch on returning to the app, as the site does on resume. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...NETWORK_DEFAULTS.queries,
        retry: 2,
        staleTime: 5 * 60_000,
        gcTime: 24 * 60 * 60_000,
      },
      mutations: NETWORK_DEFAULTS.mutations,
    },
  });
}

/** Online unless the phone says it has no connection (an unknown state counts as online). */
export const isOnline = (s: Pick<NetInfoState, 'isConnected'>) => s.isConnected !== false;

/**
 * React Query's network status from the phone's (NetInfo, ADR-008), as TanStack's React
 * Native guide does it. Returns the unsubscribe.
 */
export function followNetwork(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((s) => setOnline(isOnline(s))),
  );
  return () => onlineManager.setEventListener(() => undefined);
}

export function QueryProvider({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [qc] = useState(() => client ?? createQueryClient());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) =>
      focusManager.setFocused(s === 'active'),
    );
    const stop = followNetwork();
    return () => {
      sub.remove();
      stop();
    };
  }, []);
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
