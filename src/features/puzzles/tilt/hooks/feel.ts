import { strongest, type Buzz } from '@/shared/haptics';

import type { TiltState } from '../model';

/** What a Tilt move feels like: out through the gap, or the maze turning. */
export function tiltFeel(prev: TiltState, next: TiltState): Buzz | null {
  return strongest(next.solved && !prev.solved && 'success', next.turns > prev.turns && 'tap');
}
