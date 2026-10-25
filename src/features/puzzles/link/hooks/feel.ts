import { strongest, type Buzz } from '@/shared/haptics';

import type { LinkState } from '../model';

/**
 * What a Link move feels like, where the page buzzes (engines/link.js): a won board,
 * a wrong four, a group found; and a light tap as a tile is picked up.
 */
export function linkFeel(prev: LinkState, next: LinkState): Buzz | null {
  return strongest(
    next.won && !prev.won && 'success',
    next.mistakes > prev.mistakes && 'error',
    // Not the lost board's groups turning over one by one.
    !next.revealing &&
      !(next.over && !next.won) &&
      (next.solved.length > prev.solved.length || next.sel.length > prev.sel.length) &&
      'tap',
  );
}
