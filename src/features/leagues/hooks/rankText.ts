/** The finish sheet's league line (dn-board.js ordinal and rankText, AF-019). */
import type { DayBoard } from '../types';

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st (dn-board.js ordinal). */
export function ordinal(n: number): string {
  const v = n % 100;
  const suf = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${suf}`;
}

/**
 * The rank behind the finish sheet's league line (design B3, 8 Nov 2026): this player's
 * place among the finishers in board_day's own `me` row, and how many play; null when this
 * player has no rank there (not on the board yet, failed or revealed). Rank only, no names
 * (Alec, 28 Oct 2026).
 */
export function myRank(d: DayBoard | null | undefined): number | null {
  const me = (d?.ranked ?? []).find((r) => r.me);
  return me && typeof me.rank === 'number' ? me.rank : null;
}

/** "1st in Family today": today's place, for the line under the reward. */
export const placeLine = (rank: number, league: string): string =>
  `${ordinal(rank)} in ${league} today`;
