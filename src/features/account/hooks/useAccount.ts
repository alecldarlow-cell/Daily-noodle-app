import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { appStorage, type CachedStorage } from '@/shared/storage';

import { authClient } from '../api/authClient';
import { missingFunction, syncApi } from '../api/syncApi';
import { AccountError, authMessage } from './authErrors';
import { readAuthLink } from './authLink';
import { LAST_SYNC_KEY, runSync } from './syncEngine';

/** Where the email link sends the player back to: this app's auth path. */
function redirectUrl(): string {
  return 'dailynoodle://auth';
}

export type AccountState =
  | { kind: 'off' }
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; email: string; session: Session };

/** The account's state, following Supabase's sign-in events. */
export function useAccount(client: SupabaseClient | null = authClient()): AccountState {
  const [state, setState] = useState<AccountState>(() =>
    client ? { kind: 'loading' } : { kind: 'off' },
  );
  useEffect(() => {
    if (!client) return;
    const set = (s: Session | null) =>
      setState(
        s ? { kind: 'signed-in', email: s.user.email ?? '', session: s } : { kind: 'signed-out' },
      );
    void client.auth.getSession().then(({ data }) => set(data.session));
    const { data } = client.auth.onAuthStateChange((_e, s) => set(s));
    return () => data.subscription.unsubscribe();
  }, [client]);
  return state;
}

/** Send the sign-in link. Throws the house's words for why when Supabase refuses. */
export async function sendLink(
  email: string,
  client: SupabaseClient | null = authClient(),
): Promise<void> {
  if (!client) throw new AccountError('Sign-in isn’t available in this build.');
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl() },
  });
  if (error) throw new AccountError(authMessage(error.message));
}

/**
 * Finish signing in from the link the email opened. Returns the house's words for what
 * went wrong (never Supabase's own text), or null.
 */
export async function completeLink(
  url: string,
  client: SupabaseClient | null = authClient(),
): Promise<string | null> {
  const link = readAuthLink(url);
  if (!link) return 'That link isn’t a sign-in link.';
  if (!link.ok) return authMessage(link.error);
  if (!client) return 'Sign-in isn’t available in this build.';
  const { error } = await client.auth.setSession({
    access_token: link.access_token,
    refresh_token: link.refresh_token,
  });
  return error ? authMessage(error.message) : null;
}

/** Sync now, when signed in. Resolves false when not signed in or sync is off. */
export async function syncNow(
  store: CachedStorage = appStorage,
  client: SupabaseClient | null = authClient(),
): Promise<boolean> {
  if (!client) return false;
  const { data } = await client.auth.getSession();
  if (!data.session) return false;
  await runSync(store, syncApi(client));
  return true;
}

/** Sign out on this phone. The account's saved copy stays, for the next sign-in. */
export async function signOut(client: SupabaseClient | null = authClient()): Promise<void> {
  await client?.auth.signOut();
}

/** Delete everything the account holds, then sign out. This phone keeps its own saves. */
export async function deleteSynced(client: SupabaseClient | null = authClient()): Promise<void> {
  if (!client) return;
  await syncApi(client).forget();
  await client.auth.signOut();
}

/** Shown when the database hasn't got account_delete yet: the email request still works. */
export const DELETE_NOT_YET =
  'Deleting your account from the app isn’t switched on yet. Ask us by email instead.';

/**
 * Delete my account (#188): sync first, so the account holds this phone's league id, then
 * account_delete (the caller's own account only; league results stay as "Former player"),
 * then sign out on this phone. The phone keeps its own results. Throws the house's words.
 */
export async function deleteAccount(
  store: CachedStorage = appStorage,
  client: SupabaseClient | null = authClient(),
): Promise<void> {
  if (!client) throw new AccountError('Sign-in isn’t available in this build.');
  const { data } = await client.auth.getSession();
  if (!data.session) throw new AccountError('Sign in again to delete your account.');
  const api = syncApi(client);
  try {
    await runSync(store, api);
  } catch {
    // A failed sync doesn't stop the delete: the account's last copy is used.
  }
  try {
    await api.deleteAccount();
  } catch (e) {
    if (missingFunction(e)) throw new AccountError(DELETE_NOT_YET);
    throw e;
  }
  // The account is gone, so only this phone's session is cleared (no server call).
  await client.auth.signOut({ scope: 'local' });
}

/** When this phone last synced, as epoch milliseconds, or null. */
export function lastSync(store: CachedStorage = appStorage): number | null {
  try {
    const v = JSON.parse(store.getItem(LAST_SYNC_KEY) ?? 'null') as { at?: unknown } | null;
    return v && typeof v.at === 'number' ? v.at : null;
  } catch {
    return null;
  }
}
