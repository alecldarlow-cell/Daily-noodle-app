import { useQuery } from '@tanstack/react-query';

import { getJson } from '@/shared/net';
import { appStorage, type CachedStorage } from '@/shared/storage';

/**
 * The website's switches, features.json (Alec, 6 Nov 2026: to turn the archive calendar or the
 * stats off after testing, with no app update): `{"archive": true, "stats": true}`. Only an
 * explicit `false` turns a feature off; missing, unreadable or offline counts as on, using the
 * last copy the app saw.
 */
export interface Features {
  archive: boolean;
  stats: boolean;
}
export const FEATURES_KEY = 'noodle-app-features';
export const ALL_ON: Features = { archive: true, stats: true };

export function parseFeatures(x: unknown): Features {
  const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
  return { archive: o.archive !== false, stats: o.stats !== false };
}

function cached(store: CachedStorage): Features {
  try {
    return parseFeatures(JSON.parse(store.getItem(FEATURES_KEY) ?? 'null'));
  } catch {
    return ALL_ON;
  }
}

export function useFeatures(store: CachedStorage = appStorage): Features {
  const q = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const f = parseFeatures(await getJson<unknown>('features.json'));
      store.setItem(FEATURES_KEY, JSON.stringify(f));
      return f;
    },
    initialData: () => cached(store),
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60_000,
  });
  return q.data ?? ALL_ON;
}
