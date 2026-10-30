/* A stand-in Supabase client for the account tests: auth events, the sync functions and their revisions. */
import type { SupabaseClient } from '@supabase/supabase-js';

type Listener = (event: string, session: unknown) => void;

export function fakeClient(
  opts: {
    email?: string | null;
    remote?: Record<string, unknown>;
    fail?: string;
    /** A database without the revision functions (before 29 Oct 2026). */
    legacy?: boolean;
    /** Run before each sync_push_rev is decided (another device writing in between). */
    beforePushRev?: (remote: Record<string, unknown>, bump: (k: string) => void) => void;
  } = {},
) {
  let session: unknown = opts.email ? { user: { email: opts.email }, access_token: 'a' } : null;
  const listeners = new Set<Listener>();
  const remote: Record<string, unknown> = { ...(opts.remote ?? {}) };
  const calls: { fn: string; args: unknown }[] = [];
  // Revisions as sync.saves keeps them: every stored key starts at 1; each write takes the next.
  const revs: Record<string, number> = {};
  let seq = 1;
  for (const k of Object.keys(remote)) revs[k] = 1;
  const bump = (k: string) => {
    revs[k] = ++seq;
  };
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
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
        for (const [k, v] of Object.entries(args.p_saves as Record<string, unknown>)) {
          if (!same(remote[k], v)) bump(k);
          remote[k] = v;
        }
        return { data: Object.keys(args.p_saves as object).length, error: null };
      }
      if (fn === 'sync_forget') {
        for (const k of Object.keys(remote)) {
          delete remote[k];
          delete revs[k];
        }
        return { data: true, error: null };
      }
      if ((fn === 'sync_pull_rev' || fn === 'sync_push_rev') && opts.legacy)
        return {
          data: null,
          error: { code: 'PGRST202', message: `Could not find the function public.${fn}` },
        };
      if (fn === 'sync_pull_rev') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(remote)) out[k] = { doc: v, rev: revs[k] ?? 1 };
        return { data: out, error: null };
      }
      if (fn === 'sync_push_rev') {
        opts.beforePushRev?.(remote, bump);
        const saves = args.p_saves as Record<string, { doc: unknown; rev: number }>;
        const conflicts: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(saves)) {
          const have = k in remote ? (revs[k] ?? 1) : 0;
          if (have !== (v.rev || 0)) conflicts[k] = { doc: remote[k] ?? null, rev: have };
        }
        if (Object.keys(conflicts).length) return { data: { ok: false, conflicts }, error: null };
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(saves)) {
          if (!same(remote[k], v.doc)) bump(k);
          remote[k] = v.doc;
          out[k] = revs[k]!;
        }
        return { data: { ok: true, revs: out }, error: null };
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
