import { strongest, type Buzz } from '@/shared/haptics';

import type { TangleEngine } from '../model';

/** What the screen reads off the engine (which changes in place) to feel a change. */
export interface TangleFeelSnap {
  found: number;
  /** The round's result is up, shown at the end of a round rather than reopened. */
  ended: boolean;
}

export function tangleSnap(e: TangleEngine): TangleFeelSnap {
  return {
    found: e.s.R?.found.length ?? 0,
    ended: e.s.view === 'winModal' && e.s.freshResult,
  };
}

/** What a Tangle change feels like: the round over, or a word found. */
export function tangleFeel(prev: TangleFeelSnap, next: TangleFeelSnap): Buzz | null {
  return strongest(next.ended && !prev.ended && 'success', next.found > prev.found && 'tap');
}
