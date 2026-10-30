/** The finish sheet's league line (dn-board.js ordinal and rankText, AF-019). */
import type { DayBoard } from '../types';

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st (dn-board.js ordinal). */
export function ordinal(n: number): string {
  const v = n % 100;
  const suf = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${suf}`;
}

/**
 * "Currently 1st in Family", "Currently 3rd of 6 in Family", from board_day's own `me`
 * row among the finishers; null when this player has no rank there (not on the board yet,
 * failed or revealed). Rank only, no names (Alec, 28 Oct 2026).
 */
export function rankLine(d: DayBoard | null | undefined, league: string): string | null {
  const me = (d?.ranked ?? []).find((r) => r.me);
  if (!me || typeof me.rank !== 'number') return null;
  const n = (d?.players ?? []).length;
  return `Currently ${ordinal(me.rank)}${me.rank > 1 && n > 1 ? ` of ${n}` : ''} in ${league}`;
}
