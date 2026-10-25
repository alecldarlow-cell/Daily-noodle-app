import { strongest, type Buzz } from '@/shared/haptics';

import type { BordersState } from '../model';

/** What the screen reads off a Borders state (its round changes in place) to feel a change. */
export interface BordersFeelSnap {
  /** Answers given this round, and whether the last was right. */
  answered: number;
  lastOk: boolean;
  /** The result is up. */
  ended: boolean;
}

export function bordersSnap(s: BordersState): BordersFeelSnap {
  const ans = s.cur?.ans ?? [];
  return {
    answered: ans.length,
    lastOk: !!ans[ans.length - 1]?.ok,
    ended: s.view === 'winModal',
  };
}

/** What a Borders change feels like: the ten done, a wrong answer (the page buzzes), a right one. */
export function bordersFeel(prev: BordersFeelSnap, next: BordersFeelSnap): Buzz | null {
  const answered = next.answered > prev.answered;
  return strongest(
    next.ended && !prev.ended && 'success',
    answered && !next.lastOk && 'error',
    answered && next.lastOk && 'tap',
  );
}
