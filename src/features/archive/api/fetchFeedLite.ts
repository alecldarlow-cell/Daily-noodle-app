import { getJson } from '@/shared/net';

import type { FeedLite } from '../types';

/** Every released puzzle card, as the site's build lists them. */
export function fetchFeedLite(): Promise<FeedLite> {
  return getJson<FeedLite>('feed-lite.json');
}
