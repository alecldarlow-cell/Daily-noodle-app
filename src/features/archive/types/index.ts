import type { FeedItem } from '@/shared/feed';

export type { FeedLite } from '@/shared/feed';

/** One puzzle card in the site's feed-lite.json. */
export type ArchiveItem = FeedItem;

export interface ArchiveSection {
  title: string;
  data: ArchiveItem[];
}
