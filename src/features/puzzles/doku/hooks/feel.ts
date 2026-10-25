import { strongest, type Buzz } from '@/shared/haptics';

import type { DokuState } from '../model';

/** A tile went into a square (entries hold tile ids; 'L' given, '#' block). */
const placed = (prev: DokuState, next: DokuState) =>
  next.entries.some((row, r) =>
    row.some((x, c) => !!x && x !== 'L' && x !== '#' && x !== prev.entries[r]![c]),
  );

/** What a Doku move feels like: the solve, or a tile down. */
export function dokuFeel(prev: DokuState, next: DokuState): Buzz | null {
  return strongest(next.solved && !prev.solved && 'success', placed(prev, next) && 'tap');
}
