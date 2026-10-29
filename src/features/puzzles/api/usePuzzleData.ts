import { useQuery } from '@tanstack/react-query';

import { getJson, HttpError } from '@/shared/net';
import { PUZZLE_CACHE_PREFIX } from '@/shared/played/rounds';
import { appStorage, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../types';

/** App-only key prefix: a puzzle's data kept after its first open, so it plays offline. */
export { PUZZLE_CACHE_PREFIX };

function looksLikeFile(x: unknown): x is PuzzleFile {
  const f = x as PuzzleFile | null;
  return (
    !!f &&
    typeof f === 'object' &&
    typeof f.id === 'string' &&
    typeof f.path === 'string' &&
    !!f.data &&
    typeof f.data === 'object'
  );
}

export function cachedPuzzle(
  file: string,
  store: CachedStorage = appStorage,
): PuzzleFile | undefined {
  try {
    const j: unknown = JSON.parse(store.getItem(PUZZLE_CACHE_PREFIX + file) ?? 'null');
    return looksLikeFile(j) ? j : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A puzzle's published data (reports/<file>.json). Kept once fetched; a kept copy is
 * used as it is (a published puzzle doesn't change). A page without a data file (the
 * oldest few) answers 404: the caller falls back to the WebView bridge.
 */
export function usePuzzleData(file: string, store: CachedStorage = appStorage) {
  return useQuery({
    queryKey: ['puzzle', file],
    queryFn: async () => {
      const j = await getJson<unknown>(`reports/${encodeURIComponent(file)}.json`);
      if (!looksLikeFile(j)) throw new Error(`reports/${file}.json is not puzzle data`);
      store.setItem(PUZZLE_CACHE_PREFIX + file, JSON.stringify(j));
      return j;
    },
    initialData: () => cachedPuzzle(file, store),
    staleTime: Infinity,
    retry: (n, e) => !(e instanceof HttpError && e.status === 404) && n < 1,
  });
}
