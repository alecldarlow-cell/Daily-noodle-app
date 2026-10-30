import { PUZZLE_TYPES, saveKey, type PuzzleType } from '@noodle/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { appStorage, useStoredDocs } from '@/shared/storage';
import { useLondonDay } from '@/shared/time';
import { TODAY_CACHE_KEY, cachedToday, fetchToday } from '@/shared/today';

import { nextRow, toMidnight, type NextRow } from './rules';

const KEYS = [...new Set(PUZZLE_TYPES.map(saveKey))];

/**
 * The Play more row and countdown: today's list (the kept copy straight away, then the
 * site's file, as finish.js does with dn-today-cache), the saves, and a clock that
 * repaints every 30 seconds.
 */
export function useFinishData(type: PuzzleType): { next: NextRow; secs: number } {
  const day = useLondonDay();
  const docs = useStoredDocs(KEYS);
  const q = useQuery({
    queryKey: ['finish-today', day],
    queryFn: async () => {
      const list = await fetchToday();
      if (!list || list.today !== day) return null;
      appStorage.setItem(TODAY_CACHE_KEY, JSON.stringify(list));
      return list;
    },
    initialData: () => cachedToday(day) ?? undefined,
    initialDataUpdatedAt: 0,
    retry: 1,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(h);
  }, []);
  const list = q.data ?? cachedToday(day) ?? null;
  const next = useMemo(() => nextRow(list, type, docs), [list, type, docs]);
  return { next, secs: toMidnight(now) };
}
