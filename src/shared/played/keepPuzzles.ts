import { getJson } from '@/shared/net';
import type { CachedStorage } from '@/shared/storage';

import {
  fileOf,
  isKept,
  isPuzzleData,
  PROGRESS_TYPES,
  progressKey,
  PUZZLE_CACHE_PREFIX,
} from './rounds';

/**
 * How much kept puzzle data a phone holds. Android's saves live in a 6 MB database
 * (AsyncStorage's limit) with the results and streaks, which must always have room.
 */
export const KEPT_BUDGET = 2_000_000;

const CUR_KEYS = ['digi-link-v1', 'digi-borders-v1', 'digi-reckon-v1', 'digi-tally-v1'];

function parsed(store: CachedStorage, key: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(store.getItem(key) ?? 'null');
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The puzzle ids with a round waiting: their data stays, so they resume with no signal. */
function heldIds(store: CachedStorage): Set<string> {
  const ids = new Set<string>();
  const add = (x: unknown) => typeof x === 'string' && ids.add(x);
  for (const t of PROGRESS_TYPES) add(parsed(store, progressKey(t))?.id);
  for (const k of CUR_KEYS) add((parsed(store, k)?.cur as { id?: unknown } | undefined)?.id);
  const days = parsed(store, 'digi-tangle-v1')?.days as
    | Record<string, { state?: unknown }>
    | undefined;
  for (const [id, d] of Object.entries(days ?? {}))
    if (d?.state === 'playing' || d?.state === 'suspended') add(id);
  return ids;
}

/**
 * Takes the oldest kept puzzles off the phone (by the date in their file name) until the kept
 * data is within `budget`. A puzzle that's gone just downloads again when it's opened. Never
 * `protect`ed paths, or a puzzle with a round waiting.
 */
export function trimPuzzles(
  store: CachedStorage,
  protect: readonly string[] = [],
  budget: number = KEPT_BUDGET,
): number {
  const keep = new Set(protect.map((p) => PUZZLE_CACHE_PREFIX + fileOf(p)));
  const kept = store.keys().filter((k) => k.startsWith(PUZZLE_CACHE_PREFIX));
  let size = kept.reduce((n, k) => n + (store.getItem(k)?.length ?? 0), 0);
  if (size <= budget) return 0;
  const held = heldIds(store);
  let removed = 0;
  for (const k of kept.sort()) {
    if (size <= budget) break;
    if (keep.has(k)) continue;
    const raw = store.getItem(k) ?? '';
    const id = parsed(store, k)?.id;
    if (typeof id === 'string' && held.has(id)) continue;
    store.removeItem(k);
    size -= raw.length;
    removed += 1;
  }
  return removed;
}

/**
 * Downloads today's puzzles so they all play with no signal, as the website's offline worker
 * does, then trims the oldest. A puzzle that fails waits for the next launch.
 */
export async function keepToday(paths: readonly string[], store: CachedStorage): Promise<void> {
  for (const path of paths) {
    const file = fileOf(path);
    const key = PUZZLE_CACHE_PREFIX + file;
    if (isKept(store.getItem(key))) continue;
    try {
      const j = await getJson<unknown>(`reports/${encodeURIComponent(file)}.json`);
      if (isPuzzleData(j)) store.setItem(key, JSON.stringify(j));
    } catch {
      // No signal: it downloads when it's opened, or at the next launch.
    }
  }
  trimPuzzles(store, paths);
}
