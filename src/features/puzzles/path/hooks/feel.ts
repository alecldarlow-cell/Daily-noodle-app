import { strongest, type Buzz } from '@/shared/haptics';

import type { PathState } from '../model';

/** What a Path move feels like: the last square, or a number down (taps and hints). */
export function pathFeel(prev: PathState, next: PathState): Buzz | null {
  return strongest(
    next.solved && !prev.solved && 'success',
    next.history.length > prev.history.length && 'tap',
  );
}
