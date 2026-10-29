import { isPuzzleType, typeOfId, type PuzzleType } from '@noodle/core';
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

/** The site answered with something that isn't a card list at all. */
export class BadFeedError extends Error {
  constructor() {
    super('feed-lite.json is not a list of puzzle cards');
    this.name = 'BadFeedError';
  }
}

const str = (x: unknown): x is string => typeof x === 'string';
const PATH = /^reports\/[^/\s]+\.html$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One card, or null if Today and the Archive couldn't show it: a page path, a known type
 * whose id agrees with it (DP·MINI·… is a mini), a date and a headline. Text the card can do
 * without is filled in empty.
 */
function parseItem(x: unknown): FeedItem | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!str(o.path) || !PATH.test(o.path)) return null;
  if (!isPuzzleType(o.type) || !str(o.id) || typeOfId(o.id) !== o.type) return null;
  if (!str(o.date) || !DATE.test(o.date) || !str(o.headline)) return null;
  return {
    path: o.path,
    type: o.type,
    id: o.id,
    date: o.date,
    headline: o.headline,
    standfirst: str(o.standfirst) ? o.standfirst : '',
    read: str(o.read) ? o.read : '',
    mask: str(o.mask) ? o.mask : '',
    json: str(o.json) ? o.json : null,
  };
}

/**
 * feed-lite.json checked before it is used or kept (R9): not a card list at all → throws
 * (the last good copy stays); malformed or mismatched cards, and repeats of a page, are
 * dropped so the rest still shows.
 */
export function parseFeedLite(x: unknown): FeedLite {
  if (!x || typeof x !== 'object' || !Array.isArray((x as FeedLite).items))
    throw new BadFeedError();
  const o = x as Record<string, unknown> & { items: unknown[] };
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const raw of o.items) {
    const it = parseItem(raw);
    if (!it || seen.has(it.path)) continue;
    seen.add(it.path);
    items.push(it);
  }
  return {
    built: str(o.built) ? o.built : '',
    today: str(o.today) ? o.today : '',
    count: items.length,
    items,
  };
}

/** Every released puzzle card, as the site's build lists them, checked. */
export async function fetchFeedLite(): Promise<FeedLite> {
  return parseFeedLite(await getJson<unknown>('feed-lite.json'));
}

function cached(store: CachedStorage): FeedLite | undefined {
  try {
    return parseFeedLite(JSON.parse(store.getItem(LAST_FEED_KEY) ?? 'null'));
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
