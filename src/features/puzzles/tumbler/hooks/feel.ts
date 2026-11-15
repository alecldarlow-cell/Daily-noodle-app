import { strongest, type Buzz } from '@/shared/haptics';

import type { TumblerState } from '../model';

/** What a Tumbler move feels like: the solve, a word taken, or a wheel's click. */
export function tumblerFeel(prev: TumblerState, next: TumblerState): Buzz | null {
  return strongest(next.solved && !prev.solved && 'success', next.turns > prev.turns && 'tap');
}
