import type { GridStreakType } from '@noodle/core';

import { useStoredDocs } from '@/shared/storage';
import { useLondonDay } from '@/shared/time';

import { keysFor, startStats, type StartStats } from './stats';

/** The start card's numbers for a type, kept current as saves change. */
export function useStartStats(type: GridStreakType): StartStats {
  const day = useLondonDay();
  const [save, streak] = keysFor(type);
  const docs = useStoredDocs([save, streak]);
  return startStats(docs[save], docs[streak], day);
}
