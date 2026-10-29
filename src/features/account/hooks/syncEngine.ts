import { BOARD_KEY, importMove, keptPids, type KV, type MovePayload } from '@noodle/core';

import { missingFunction, type RevDoc, type SyncApi } from '../api/syncApi';

/** What sync carries: the eight daily types' saves and streaks, and the league identity. */
export const SYNC_KEY = /^digi-(mini|doku|sweep|path|link|tangle|borders|reckon)-(v1|streak)$/;
/** App-only: when this phone last synced, for the Account screen. */
export const LAST_SYNC_KEY = 'noodle-app-sync';
/** Pull, merge and push again at most this many times when another device wrote in between. */
export const TRIES = 3;

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

function local(kv: KV & { keys(): string[] }): Record<string, Doc> {
  const out: Record<string, Doc> = {};
  for (const k of kv.keys()) {
    if (!SYNC_KEY.test(k) && k !== BOARD_KEY) continue;
    try {
      const v: unknown = JSON.parse(kv.getItem(k) ?? 'null');
      if (isObj(v)) out[k] = v;
    } catch {
      /* an unreadable save stays on the phone */
    }
  }
  return out;
}

/** Key order doesn't matter: the same document read back from the server is the same. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (!isObj(v)) return v;
  const out: Doc = {};
  for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
  return out;
}
export const same = (a: unknown, b: unknown) =>
  JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/**
 * Merge the account's documents into this phone by the personal-link rules (first result
 * kept, better streak wins; a different league player is asked about, never adopted
 * silently), and return what this phone now holds for the account. While the phone hasn't
 * chosen between its own league player and the account's, or chose to keep its own
 * (remembered, plan R4), the account keeps the player it had.
 */
function mergeIn(
  kv: KV & { keys(): string[] },
  remote: Record<string, Doc>,
  now: () => number,
): Record<string, Doc> {
  const d: Record<string, string> = {};
  for (const [k, v] of Object.entries(remote))
    if (SYNC_KEY.test(k) && isObj(v)) d[k] = JSON.stringify(v);
  const board = remote[BOARD_KEY] as { pid?: unknown } | undefined;
  const here = local(kv)[BOARD_KEY] as { pid?: unknown } | undefined;
  const kept = typeof board?.pid === 'string' && keptPids(kv).includes(board.pid);
  const other = isObj(board) && !kept && !(here?.pid && here.pid === board.pid) ? board : undefined;
  importMove(kv, { v: 1, d, b: other as MovePayload['b'] }, now);
  const mine = local(kv);
  if ((mine[BOARD_KEY] as { pend?: unknown } | undefined)?.pend || (kept && isObj(board)))
    delete mine[BOARD_KEY];
  return mine;
}

/** A puzzle the account already has a result for keeps the account's (the first one stored). */
const UNION = ['done', 'days', 'found'];
function forAccount(mine: Doc, theirs: Doc | undefined): Doc {
  if (!isObj(theirs)) return mine;
  const out: Doc = { ...mine };
  for (const k of UNION)
    if (isObj(mine[k]) && isObj(theirs[k])) out[k] = { ...(mine[k] as Doc), ...(theirs[k] as Doc) };
  return out;
}

export class SyncBusyError extends Error {
  constructor() {
    super(
      'Sync couldn’t finish: another device was syncing. Your results are safe here. Try again.',
    );
  }
}

/**
 * One sync, as the website's dn-sync.js (29 Oct 2026, plan R3): pull the account's documents
 * with their revisions, merge them into this phone, then push only what changed, each with
 * the revision it was merged from. If another phone or browser wrote in between, the server
 * stores nothing; pull, merge and try again (up to TRIES times), never dropping a result
 * here. A database without the revision functions gets the old pull-merge-push.
 */
export async function runSync(
  kv: KV & { keys(): string[] },
  api: SyncApi,
  now: () => number = Date.now,
): Promise<{ pulled: number; pushed: number }> {
  let res: { pulled: number; pushed: number };
  try {
    res = await syncRev(kv, api, now);
  } catch (e) {
    if (!missingFunction(e)) throw e;
    res = await syncOld(kv, api, now);
  }
  kv.setItem(LAST_SYNC_KEY, JSON.stringify({ at: now() }));
  return res;
}

async function syncRev(
  kv: KV & { keys(): string[] },
  api: SyncApi,
  now: () => number,
): Promise<{ pulled: number; pushed: number }> {
  for (let n = 1; n <= TRIES; n++) {
    const pulled = await api.pullRev();
    const remote: Record<string, Doc> = {};
    for (const [k, v] of Object.entries(pulled)) remote[k] = v.doc;
    const out = mergeIn(kv, remote, now);
    const saves: Record<string, RevDoc> = {};
    for (const [k, v] of Object.entries(out)) {
      const doc = forAccount(v, remote[k]);
      if (isObj(remote[k]) && same(doc, remote[k])) continue; // the account has it already
      saves[k] = { doc, rev: pulled[k]?.rev ?? 0 };
    }
    const count = Object.keys(saves).length;
    if (!count) return { pulled: Object.keys(pulled).length, pushed: 0 };
    const r = await api.pushRev(saves);
    if (r.ok) return { pulled: Object.keys(pulled).length, pushed: count };
  }
  throw new SyncBusyError();
}

async function syncOld(
  kv: KV & { keys(): string[] },
  api: SyncApi,
  now: () => number,
): Promise<{ pulled: number; pushed: number }> {
  const remote = await api.pull();
  const docs: Record<string, Doc> = {};
  for (const [k, v] of Object.entries(remote)) if (isObj(v)) docs[k] = v;
  const mine = mergeIn(kv, docs, now);
  const pushed = Object.keys(mine).length ? await api.push(mine) : 0;
  return { pulled: Object.keys(remote).length, pushed };
}
