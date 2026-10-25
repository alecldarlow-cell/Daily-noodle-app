/**
 * Sign-in for sync (WP7): Supabase Auth email links, with the session kept in the
 * phone's secure store. Separate from the leagues client, which stays anonymous as
 * the website's is. Off unless the build sets EXPO_PUBLIC_SYNC=1 (the sync schema must
 * be live and Supabase Auth must allow the app's link first; see the site's SITE.md).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
  return client;
}

/** For tests. */
export function setAuthClient(c: SupabaseClient | null | undefined): void {
  client = c;
}
