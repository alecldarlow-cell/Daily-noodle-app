import { strongest, type Buzz } from '@/shared/haptics';

import type { ReckonState } from '../model';

/** What the screen reads off a Reckon state (its round changes in place) to feel a change. */
export interface ReckonFeelSnap {
  /** Answers locked in this round. */
  locked: number;
  /** The result is up. */
  ended: boolean;
}

export function reckonSnap(s: ReckonState): ReckonFeelSnap {
  return { locked: s.R?.z.length ?? 0, ended: s.view === 'winModal' };
}

/** What a Reckon change feels like, where the page buzzes: an answer locked in, the ten done. */
export function reckonFeel(prev: ReckonFeelSnap, next: ReckonFeelSnap): Buzz | null {
  return strongest(next.ended && !prev.ended && 'success', next.locked > prev.locked && 'tap');
}
