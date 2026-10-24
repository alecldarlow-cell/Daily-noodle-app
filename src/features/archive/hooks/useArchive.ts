import { useQuery } from '@tanstack/react-query';

import { appStorage, type CachedStorage } from '@/shared/storage';

import { fetchFeedLite } from '../api/fetchFeedLite';
import type { FeedLite } from '../types';

/** App-only key: the last archive list, so it opens offline. */
export const LAST_ARCHIVE_KEY = 'noodle-app-feed-lite';

function cached(store: CachedStorage): FeedLite | undefined {
  try {
    const v = JSON.parse(store.getItem(LAST_ARCHIVE_KEY) ?? 'null') as FeedLite | null;
    return v && Array.isArray(v.items) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** The archive list: the last copy at once, refreshed from the site every half hour. */
export function useArchive(store: CachedStorage = appStorage) {
  return useQuery({
    queryKey: ['feed-lite'],
    queryFn: async () => {
      const lite = await fetchFeedLite();
      store.setItem(LAST_ARCHIVE_KEY, JSON.stringify(lite));
      return lite;
    },
    initialData: () => cached(store),
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60_000,
  });
}
