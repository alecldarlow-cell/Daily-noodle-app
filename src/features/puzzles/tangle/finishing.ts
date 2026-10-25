/**
 * What the Tangle finish sheet shows, and what a reopened result shows, from the
 * engine's own state (engines/tangle.js showResult and recapNode). The round's save,
 * best score and streak are written by the engine itself at the end of the round
 * (endRound), as on the page; this only reads them back.
 */
import { longDate } from '@/shared/time/format';

import { result, endDetail, recap, type TangleEngine } from './model';

export interface SheetInfo {
  id: string;
  title: string;
  kick: string;
  /** "12 points" (the big number and its word). */
  hero: { score: number; word: string };
  note: { before: string; bold: string; after: string };
  share: string;
  stats: { value: number; label: string }[];
  recap: ReturnType<typeof recap>;
  /** The `dn:puzzle_end` detail, sent only when the round has just ended. */
  detail: Record<string, unknown>;
  fresh: boolean;
}

/** The sheet for the engine's result, on London day `today`. */
export function sheetInfo(e: TangleEngine, today: string): SheetInfo {
  const r = result(e, today);
  return {
    id: e.P.id,
    title: r.title,
    // the shared sheet's kicker (finish.js): name, number, the day without its year
    kick: `Tangle ${e.P.n}, ${longDate(e.P.date)}`,
    hero: { score: r.score, word: r.score === 1 ? 'point' : 'points' },
    note: r.note,
    share: r.share,
    stats: [
      { value: r.words, label: 'words' },
      { value: r.streak, label: 'day streak' },
      { value: r.best, label: 'best score' },
    ],
    recap: recap(e.P, e.s.D.found),
    detail: endDetail(r),
    fresh: e.s.freshResult,
  };
}

/** The note as plain text (how the page's .fin-note reads). */
export const noteText = (n: SheetInfo['note']) => n.before + n.bold + n.after;
