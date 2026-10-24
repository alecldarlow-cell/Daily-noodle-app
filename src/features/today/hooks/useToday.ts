import { acceptToday, londonDay, type TodayList } from '@noodle/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { appStorage, type CachedStorage } from '@/shared/storage';
import { useLondonDay } from '@/shared/time';

import { fetchToday } from '../api/fetchToday';
import type { TodayStatus } from '../types';

/** App-only key: the last list accepted for its day, so today works offline. */
export const LAST_TODAY_KEY = 'noodle-app-today';

/** The site's list exists but is dated another day (its nightly build hasn't run yet). */
export class NotTodayYet extends Error {
  constructor(readonly listDay: unknown) {
    super(`Today's list is still dated ${String(listDay)}`);
  }
}

/** Retry gaps while the list is yesterday's: 1, 5, then 15 minutes. */
export const NEARLY_RETRY_MS = [60_000, 300_000, 900_000] as const;

export function cachedToday(day: string, store: CachedStorage = appStorage): TodayList | undefined {
  try {
    const list: unknown = JSON.parse(store.getItem(LAST_TODAY_KEY) ?? 'null');
    return acceptToday(list) && list.today === day ? list : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Today's puzzles. A list is used only when it is dated today in London (the finish
 * sheet's rule), so yesterday's puzzles are never shown as today's.
 */
export function useToday(store: CachedStorage = appStorage): TodayStatus & { refresh: () => void } {
  const day = useLondonDay();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['today', day],
    queryFn: async () => {
      const list = await fetchToday();
      if (!acceptToday(list) || list.today !== londonDay())
        throw new NotTodayYet((list as { today?: unknown })?.today);
      store.setItem(LAST_TODAY_KEY, JSON.stringify(list));
      return list;
    },
    initialData: () => cachedToday(day, store),
    initialDataUpdatedAt: 0, // always check the site once, even with a cached list
    retry: (n, e) => (e instanceof NotTodayYet ? n < NEARLY_RETRY_MS.length : n < 2),
    retryDelay: (n, e) =>
      e instanceof NotTodayYet ? NEARLY_RETRY_MS[Math.min(n, 2)]! : 2_000 * 2 ** n,
  });
  // Try again asks the site now. With no list yet, React Query would sit out a pending
  // retry's wait, so cancel that attempt first.
  const refresh = () => {
    void qc.cancelQueries({ queryKey: ['today', day] }).then(() => q.refetch());
  };
  // Say what's wrong at the first failure; retries carry on quietly behind it.
  const why = q.error ?? q.failureReason;
  if (q.data) return { kind: 'ready', list: q.data, stale: !!why, refresh };
  if (why instanceof NotTodayYet) return { kind: 'nearly', refresh };
  if (why) return { kind: 'offline', refresh };
  return { kind: 'loading', refresh };
}
