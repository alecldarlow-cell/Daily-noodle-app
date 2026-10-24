import { getJson } from '@/shared/net';

import type { PuzzleCard } from '../types';

/** Every released puzzle's page, for the history copy and the board's puzzle names. */
export async function fetchPuzzleCards(): Promise<PuzzleCard[]> {
  const lite = await getJson<{ items?: PuzzleCard[] }>('feed-lite.json');
  return Array.isArray(lite.items) ? lite.items : [];
}
