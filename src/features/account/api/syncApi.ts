import type { SupabaseClient } from '@supabase/supabase-js';

/** A document with the revision it was stored at (sync_pull_rev) or merged from (sync_push_rev). */
export interface RevDoc {
  doc: Record<string, unknown>;
  rev: number;
}

/** sync_push_rev's answer: every document stored, or nothing stored and the keys that changed. */
export type PushRevResult =
  | { ok: true; revs: Record<string, number> }
  | { ok: false; conflicts: Record<string, { doc: Record<string, unknown> | null; rev: number }> };

/**
 * The sync functions (dailynoodle toolchain/sql/2026-10-25-sync.sql, and the revision pair
 * from 2026-10-29-sync-revision.sql, live since 29 Oct 2026).
 */
export interface SyncApi {
  pull(): Promise<Record<string, unknown>>;
  push(saves: Record<string, unknown>): Promise<number>;
  forget(): Promise<boolean>;
  pullRev(): Promise<Record<string, RevDoc>>;
  pushRev(saves: Record<string, RevDoc>): Promise<PushRevResult>;
}

export class SyncError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** The database hasn't got the revision functions (PostgREST PGRST202, Postgres 42883). */
export function missingFunction(e: unknown): boolean {
  if (!(e instanceof SyncError)) return false;
  return (
    e.code === 'PGRST202' ||
    e.code === '42883' ||
    /could not find the function|function .* does not exist/i.test(e.message)
  );
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function syncApi(client: SupabaseClient): SyncApi {
  const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    const { data, error } = await client.rpc(fn, args ?? {});
    if (error) throw new SyncError(error.message || 'sync_failed', error.code);
    return data as T;
  };
  return {
    pull: () => call<Record<string, unknown>>('sync_pull').then((d) => (isObj(d) ? d : {})),
    push: (saves) => call<number>('sync_push', { p_saves: saves }),
    forget: () => call<boolean>('sync_forget'),
    pullRev: () =>
      call<unknown>('sync_pull_rev').then((d) => {
        const out: Record<string, RevDoc> = {};
        if (isObj(d))
          for (const [k, v] of Object.entries(d))
            if (isObj(v) && isObj(v.doc)) out[k] = { doc: v.doc, rev: Number(v.rev) || 0 };
        return out;
      }),
    pushRev: (saves) =>
      call<unknown>('sync_push_rev', { p_saves: saves }).then((r) =>
        isObj(r) && r.ok === true
          ? { ok: true, revs: (isObj(r.revs) ? r.revs : {}) as Record<string, number> }
          : {
              ok: false,
              conflicts: (isObj(r) && isObj(r.conflicts) ? r.conflicts : {}) as Record<
                string,
                { doc: Record<string, unknown> | null; rev: number }
              >,
            },
      ),
  };
}
