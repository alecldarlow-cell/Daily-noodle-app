import type { PuzzleType } from '@noodle/core';
import { useQuery } from '@tanstack/react-query';

import { getJson } from '@/shared/net';
import { appStorage, type CachedStorage } from '@/shared/storage';

/** One puzzle card in the site's feed-lite.json (tools/puzzle-json.js). */
export interface FeedItem {
  path: string;
  type: PuzzleType;
  id: string;
  date: string;
  headline: string;
  standfirst: string;
  read: string;
  /** The grid the card's tile previews (front.js puzzleTile); empty for picture tiles. */
  mask: string;
  /** The puzzle's data file, or null for the older pages that have none. */
  json: string | null;
}

export interface FeedLite {
  built: string;
  today: string;
  count: number;
  items: FeedItem[];
}

/** App-only key: the last copy of the list, so the Archive and Today's cards open offline. */
export const LAST_FEED_KEY = 'noodle-app-feed-lite';

/** Every released puzzle card, as the site's build lists them. */
export function fetchFeedLite(): Promise<FeedLite> {
  return getJson<FeedLite>('feed-lite.json');
}

function cached(store: CachedStorage): FeedLite | undefined {
  try {
    const v = JSON.parse(store.getItem(LAST_FEED_KEY) ?? 'null') as FeedLite | null;
    return v && Array.isArray(v.items) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** The site's puzzle cards: the last copy at once, refreshed from the site every half hour. */
export function useFeedLite(store: CachedStorage = appStorage) {
  return useQuery({
    queryKey: ['feed-lite'],
    queryFn: async () => {
      const lite = await fetchFeedLite();
      store.setItem(LAST_FEED_KEY, JSON.stringify(lite));
      return lite;
    },
    initialData: () => cached(store),
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60_000,
  });
}
