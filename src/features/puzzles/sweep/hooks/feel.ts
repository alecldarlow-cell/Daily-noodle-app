import { strongest, type Buzz } from '@/shared/haptics';

import type { SweepState } from '../model';

/** What a Sweep move feels like: a cleared board, a mine, a square dug or flagged. */
export function sweepFeel(prev: SweepState, next: SweepState): Buzz | null {
  return strongest(
    next.won && !prev.won && 'success',
    next.boomed.size > prev.boomed.size && 'error',
    (next.revealed.size > prev.revealed.size || next.flagged.size > prev.flagged.size) &&
      next.round === prev.round &&
      'tap',
  );
}
