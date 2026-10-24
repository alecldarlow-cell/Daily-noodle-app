import type { PuzzleType } from '@noodle/core';

/** One puzzle card in the site's feed-lite.json (tools/puzzle-json.js). */
export interface ArchiveItem {
  path: string;
  type: PuzzleType;
  id: string;
  date: string;
  headline: string;
  standfirst: string;
  read: string;
  mask: string;
  /** The puzzle's data file, or null for the older pages that have none. */
  json: string | null;
}

export interface FeedLite {
  built: string;
  today: string;
  count: number;
  items: ArchiveItem[];
}

export interface ArchiveSection {
  title: string;
  data: ArchiveItem[];
}
