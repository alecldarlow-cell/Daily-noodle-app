import {
  overallRun,
  playedState,
  RUN_RESULT_KEYS,
  RUN_STREAK_KEYS,
  saveKey,
  type PlayedState,
  type SaveDoc,
  type TodayItem,
} from '@noodle/core';
import { useMemo } from 'react';

import { appStorage, useStoredDocs, type CachedStorage } from '@/shared/storage';

const KEYS = [...RUN_RESULT_KEYS, ...RUN_STREAK_KEYS];

/** Each puzzle's played state from the player's saves, and the overall run. */
export function usePlayed(
  items: readonly Pick<TodayItem, 'type' | 'id'>[],
  day: string,
  store: CachedStorage = appStorage,
): { byId: Record<string, PlayedState | null>; run: number } {
  const docs = useStoredDocs(KEYS, store);
  return useMemo(() => {
    const byId: Record<string, PlayedState | null> = {};
    for (const it of items)
      byId[it.id] = playedState(it.type, it.id, docs[saveKey(it.type)] as SaveDoc | null);
    return { byId, run: overallRun(docs, Date.parse(`${day}T12:00:00Z`)) };
  }, [items, docs, day]);
}
