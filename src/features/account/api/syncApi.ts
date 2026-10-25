import type { SupabaseClient } from '@supabase/supabase-js';

/** The three sync functions (dailynoodle toolchain/sql/2026-10-25-sync.sql). */
export interface SyncApi {
  pull(): Promise<Record<string, unknown>>;
  push(saves: Record<string, unknown>): Promise<number>;
  forget(): Promise<boolean>;
}

export class SyncError extends Error {}

export function syncApi(client: SupabaseClient): SyncApi {
  const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    const { data, error } = await client.rpc(fn, args ?? {});
    if (error) throw new SyncError(error.message || 'sync_failed');
    return data as T;
  };
  return {
    pull: () =>
      call<Record<string, unknown>>('sync_pull').then((d) => (d && typeof d === 'object' ? d : {})),
    push: (saves) => call<number>('sync_push', { p_saves: saves }),
    forget: () => call<boolean>('sync_forget'),
  };
}
