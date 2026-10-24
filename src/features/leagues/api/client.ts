/**
 * The one way the app reaches the leagues backend: Supabase's `rpc` with the public anon
 * key, as the website's dn-board.js does (ADR-001). URL and key come from the build's
 * environment (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`; see
 * .env.example). Without them every call fails with `not_configured`, so a test can
 * never reach the live project by accident.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { BoardError } from './errors';

export type Rpc = <T>(fn: string, args: Record<string, unknown>) => Promise<T>;

/** An rpc over a Supabase client: the function's data, or a BoardError with its reason. */
export function rpcOver(client: SupabaseClient | null): Rpc {
  return async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    if (!client) throw new BoardError('not_configured');
    let res: { data: unknown; error: { message?: string } | null };
    try {
      res = await client.rpc(fn, args);
    } catch {
      throw new BoardError('error');
    }
    // A raised exception's text is its reason (`raise exception 'no_league'`).
    if (res.error) throw new BoardError(res.error.message || 'error');
    return res.data as T;
  };
}

/** A client for the board functions only: no sessions, nothing kept on the phone. */
export function boardClient(url?: string, key?: string, fetchImpl?: typeof fetch) {
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  });
}

let live: Rpc | null = null;

/** The app's rpc, made on first use from the build's environment. */
export const rpc: Rpc = (fn, args) => {
  live ??= rpcOver(
    boardClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  );
  return live(fn, args);
};
