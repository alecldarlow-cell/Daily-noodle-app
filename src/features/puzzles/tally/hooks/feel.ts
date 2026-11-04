import { strongest, type Buzz } from '@/shared/haptics';

import type { TallyState } from '../model';

/** What a Tally move feels like: the solve, or a number or note going in. */
export function tallyFeel(prev: TallyState, next: TallyState): Buzz | null {
  return strongest(
    next.solved && !prev.solved && 'success',
    next.undo.length > prev.undo.length && 'tap',
  );
}
