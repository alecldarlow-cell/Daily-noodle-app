import {
  overallRun,
  playedState,
  RUN_RESULT_KEYS,
  RUN_STREAK_KEYS,
  saveKey,
  type PlayedState,
  type PuzzleType,
  type SaveDoc,
  type TodayItem,
} from '@noodle/core';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { appStorage, useStoredDocs, type CachedStorage } from '@/shared/storage';

import {
  fileOf,
  heldElsewhere,
  isKept,
  PROGRESS_TYPES,
  progressKey,
  PUZZLE_CACHE_PREFIX,
  roundOf,
  type ProgressType,
  type Round,
} from './rounds';

const KEYS = [...RUN_RESULT_KEYS, ...RUN_STREAK_KEYS, ...PROGRESS_TYPES.map(progressKey)];

const slotKey = (type: PuzzleType) =>
  (PROGRESS_TYPES as readonly string[]).includes(type) ? progressKey(type as ProgressType) : '';

/**
 * Each puzzle's played state from the player's saves, the overall run, each puzzle's round
 * waiting part-way (`rounds`, shown as Continue), and `held`: which other puzzle's round
 * starting this one would replace.
 */
export function usePlayed(
  items: readonly Pick<TodayItem, 'type' | 'id'>[],
  day: string,
  store: CachedStorage = appStorage,
): {
  byId: Record<string, PlayedState | null>;
  run: number;
  rounds: Record<string, Round | null>;
  held: (type: PuzzleType, id: string) => string | null;
} {
  const docs = useStoredDocs(KEYS, store);
  return useMemo(() => {
    const byId: Record<string, PlayedState | null> = {};
    const rounds: Record<string, Round | null> = {};
    for (const it of items) {
      const site = docs[saveKey(it.type)];
      const slot = docs[slotKey(it.type)];
      const round = roundOf(it.type, it.id, site, slot);
      rounds[it.id] = round;
      // A grid round kept in the app's slot is "in progress" as the site's own saves are.
      byId[it.id] =
        playedState(it.type, it.id, site as SaveDoc | null) ?? (round ? { done: false } : null);
    }
    const held = (type: PuzzleType, id: string) =>
      heldElsewhere(type, id, docs[saveKey(type)], docs[slotKey(type)]);
    return { byId, run: overallRun(docs, Date.parse(`${day}T12:00:00Z`)), rounds, held };
  }, [items, docs, day]);
}

/**
 * Which of `paths` are downloaded on this phone (opened before, so they play offline), as
 * a set of paths; only worked out while `on` (offline), and empty otherwise.
 */
export function useKept(
  paths: readonly string[],
  on: boolean,
  store: CachedStorage = appStorage,
): ReadonlySet<string> {
  const keys = useMemo(
    () => (on ? paths.map((p) => PUZZLE_CACHE_PREFIX + fileOf(p)) : []),
    [paths, on],
  );
  const subscribe = useCallback(
    (fn: () => void) => {
      const offs = keys.map((k) => store.subscribe(k, fn));
      return () => offs.forEach((off) => off());
    },
    [store, keys],
  );
  const snapshot = useSyncExternalStore(subscribe, () =>
    keys.map((k) => (isKept(store.getItem(k)) ? '1' : '0')).join(''),
  );
  return useMemo(() => {
    const out = new Set<string>();
    if (on) paths.forEach((p, i) => snapshot[i] === '1' && out.add(p));
    return out;
  }, [paths, on, snapshot]);
}
