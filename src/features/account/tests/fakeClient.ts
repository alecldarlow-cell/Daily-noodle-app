/* A stand-in Supabase client for the account tests: auth events and the three sync functions. */
import type { SupabaseClient } from '@supabase/supabase-js';

type Listener = (event: string, session: unknown) => void;

export function fakeClient(
  opts: { email?: string | null; remote?: Record<string, unknown>; fail?: string } = {},
) {
  let session: unknown = opts.email ? { user: { email: opts.email }, access_token: 'a' } : null;
  const listeners = new Set<Listener>();
  const remote: Record<string, unknown> = { ...(opts.remote ?? {}) };
  const calls: { fn: string; args: unknown }[] = [];
  const emit = (e: string) => listeners.forEach((fn) => fn(e, session));
  const client = {
    auth: {
      getSession: jest.fn(async () => ({ data: { session } })),
      onAuthStateChange: jest.fn((fn: Listener) => {
        listeners.add(fn);
        return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } };
      }),
      signInWithOtp: jest.fn(async () => ({ error: opts.fail ? { message: opts.fail } : null })),
      setSession: jest.fn(async ({ access_token }: { access_token: string }) => {
        if (access_token === 'bad') return { error: { message: 'Invalid token' } };
        session = { user: { email: 'alec@example.com' }, access_token };
        emit('SIGNED_IN');
        return { error: null };
      }),
      signOut: jest.fn(async () => {
        session = null;
        emit('SIGNED_OUT');
        return { error: null };
      }),
    },
    rpc: jest.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (opts.fail) return { data: null, error: { message: opts.fail } };
      if (fn === 'sync_pull') return { data: { ...remote }, error: null };
      if (fn === 'sync_push') {
        Object.assign(remote, args.p_saves as object);
        return { data: Object.keys(args.p_saves as object).length, error: null };
      }
      if (fn === 'sync_forget') {
        for (const k of Object.keys(remote)) delete remote[k];
        return { data: true, error: null };
      }
      return { data: null, error: { message: 'unknown' } };
    }),
  };
  return { client: client as unknown as SupabaseClient, raw: client, remote, calls, emit };
}

export function memoryStorage(init: Record<string, unknown> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCachedStorage } = require('@/shared/storage') as typeof import('@/shared/storage');
  const store = createCachedStorage({
    getAllKeys: async () => [],
    multiGet: async () => [],
    setItem: async () => {},
  });
  for (const [k, v] of Object.entries(init))
    store.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  return store;
}
