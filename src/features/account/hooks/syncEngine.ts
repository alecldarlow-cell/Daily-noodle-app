import { BOARD_KEY, importMove, type KV, type MovePayload } from '@noodle/core';

import type { SyncApi } from '../api/syncApi';

/** What sync carries: the eight daily types' saves and streaks, and the league identity. */
export const SYNC_KEY = /^digi-(mini|doku|sweep|path|link|tangle|borders|reckon)-(v1|streak)$/;
/** App-only: when this phone last synced, for the Account screen. */
export const LAST_SYNC_KEY = 'noodle-app-sync';

function local(kv: KV & { keys(): string[] }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of kv.keys()) {
    if (!SYNC_KEY.test(k) && k !== BOARD_KEY) continue;
    try {
      const v: unknown = JSON.parse(kv.getItem(k) ?? 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = v;
    } catch {
      /* an unreadable save stays on the phone */
    }
  }
  return out;
}

/**
 * One sync: pull what the account holds, merge it into this phone by the personal-link
 * rules (first result kept, better streak wins; a different league player is asked
 * about, never adopted silently), then push the merged documents back. The website's
 * dn-sync.js does exactly the same. Pulling first
 * every time means two phones never overwrite each other's results.
 */
export async function runSync(
  kv: KV & { keys(): string[] },
  api: SyncApi,
  now: () => number = Date.now,
): Promise<{ pulled: number; pushed: number }> {
  const remote = await api.pull();
  const d: Record<string, string> = {};
  for (const [k, v] of Object.entries(remote))
    if (SYNC_KEY.test(k) && v && typeof v === 'object') d[k] = JSON.stringify(v);
  // League identity: only another player's needs the import's adopt-or-ask rule; the
  // same player's leagues come from the server anyway (and adopting would mark a move).
  const board = remote[BOARD_KEY] as { pid?: unknown } | undefined;
  const here = local(kv)[BOARD_KEY] as { pid?: unknown } | undefined;
  const other =
    board && typeof board === 'object' && !(here?.pid && here.pid === board.pid)
      ? board
      : undefined;
  importMove(kv, { v: 1, d, b: other as MovePayload['b'] }, now);
  const mine = local(kv);
  // While this phone hasn't chosen between its own league player and the account's,
  // the account keeps the one it had.
  if ((mine[BOARD_KEY] as { pend?: unknown } | undefined)?.pend) delete mine[BOARD_KEY];
  const pushed = Object.keys(mine).length ? await api.push(mine) : 0;
  kv.setItem(LAST_SYNC_KEY, JSON.stringify({ at: now() }));
  return { pulled: Object.keys(remote).length, pushed };
}
