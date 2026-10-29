import { BadFeedError, fetchFeedLite } from '@/shared/feed';

import type { PuzzleCard } from '../types';

/**
 * Every released puzzle's page, for the history copy and the board's puzzle names: the
 * checked card list (malformed cards dropped), or none if the site sent no list at all.
 */
export async function fetchPuzzleCards(): Promise<PuzzleCard[]> {
  try {
    return (await fetchFeedLite()).items;
  } catch (e) {
    if (e instanceof BadFeedError) return [];
    throw e;
  }
}
