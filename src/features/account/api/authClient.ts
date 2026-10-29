/**
 * Sign-in for sync (WP7): Supabase Auth email links, with the session kept in the
 * phone's secure store. Separate from the leagues client, which stays anonymous as
 * the website's is. Off unless the build sets EXPO_PUBLIC_SYNC=1 (the sync schema must
 * be live and Supabase Auth must allow the app's link first; see the site's SITE.md).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';

import { BUILD_ENV } from '@/shared/env';

import { chunkedStorage } from './sessionStorage';

export function syncEnabled(
  env: Readonly<Record<string, string | undefined>> = BUILD_ENV,
): boolean {
  return (
    env.EXPO_PUBLIC_SYNC === '1' &&
    !!env.EXPO_PUBLIC_SUPABASE_URL &&
    !!env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );
}

let client: SupabaseClient | null | undefined;

type AutoRefresh = Pick<SupabaseClient['auth'], 'startAutoRefresh' | 'stopAutoRefresh'>;

/**
 * Hardening G3, as Supabase's React Native guide does: off a browser, supabase-js can't
 * tell when the app is in front, so the sign-in token would keep refreshing in the
 * background. Refresh runs only while the app is active: started now if it is, then
 * started on each return to the front and stopped on leaving it. Returns the unsubscribe.
 */
export function refreshWhileActive(
  auth: AutoRefresh,
  appState: Pick<typeof AppState, 'currentState' | 'addEventListener'> = AppState,
): () => void {
  const apply = (s: AppStateStatus | string | null | undefined) => {
    void (s === 'active' ? auth.startAutoRefresh() : auth.stopAutoRefresh()).catch(() => {});
  };
  apply(appState.currentState);
  const sub = appState.addEventListener('change', apply);
  return () => sub.remove();
}

/** The signed-in client, made on first use; null when sync is off in this build. */
export function authClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = syncEnabled()
    ? createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            storage: chunkedStorage(),
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        },
      )
    : null;
  // Once, for the app's one client (never unsubscribed: it lives as long as the app).
  if (client) refreshWhileActive(client.auth);
  return client;
}

/** For tests. */
export function setAuthClient(c: SupabaseClient | null | undefined): void {
  client = c;
}
