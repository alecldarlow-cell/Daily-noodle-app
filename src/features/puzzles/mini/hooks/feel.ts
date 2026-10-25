import { strongest, type Buzz } from '@/shared/haptics';

import type { MiniState } from '../model';

const bad = (s: MiniState) =>
  s.checked.reduce((n, row) => n + row.filter((m) => m === 'bad').length, 0);
/** A letter went into a square (typed over one, or revealed). */
const placed = (prev: MiniState, next: MiniState) =>
  next.entries.some((row, r) => row.some((x, c) => !!x && x !== '#' && x !== prev.entries[r]![c]));

/** What a Mini move feels like: the solve, a wrong check, a letter down. */
export function miniFeel(prev: MiniState, next: MiniState): Buzz | null {
  return strongest(
    next.solved && !prev.solved && 'success',
    bad(next) > bad(prev) && 'error',
    placed(prev, next) && 'tap',
  );
}
