import {
  readStats,
  RUN_RESULT_KEYS,
  RUN_STREAK_KEYS,
  statsSummary,
  statsYearCard,
  type KV,
  type StatsMode,
  type StatsSummary,
  type YearCard,
} from '@noodle/core';
import { useMemo } from 'react';

import { useFeedLite } from '@/shared/feed';
import { appStorage, useStoredDocs, type CachedStorage } from '@/shared/storage';

const KEYS = [...RUN_RESULT_KEYS, ...RUN_STREAK_KEYS];

/**
 * Your stats, from this phone's saves only (6 Nov 2026, Alec: free, no sign-in), with each
 * puzzle's date from the cached feed-lite so plays split into on the day and catch-ups.
 * Read-only: nothing is stored; `hasDates` is false until the list has loaded.
 */
export function useStats(
  today: string,
  mode: StatsMode,
  store: CachedStorage = appStorage,
): { summary: StatsSummary; all: StatsSummary; year: YearCard | null; hasDates: boolean } {
  const docs = useStoredDocs(KEYS, store);
  const feed = useFeedLite(store);
  const items = feed.data?.items;
  return useMemo(() => {
    const kv: KV = {
      getItem: (k) => (docs[k] == null ? null : JSON.stringify(docs[k])),
      setItem: () => undefined,
    };
    const saved = readStats(kv);
    let dates: Record<string, string> | null = null;
    if (items?.length) {
      dates = {};
      for (const it of items) dates[it.id] = it.date;
    }
    const all = statsSummary(saved, { today, dates });
    return {
      all,
      summary: mode === 'all' ? all : statsSummary(saved, { today, dates, mode }),
      year: statsYearCard(saved, { today, dates }),
      hasDates: !!dates,
    };
  }, [docs, items, today, mode]);
}
