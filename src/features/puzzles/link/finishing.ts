/**
 * What happens when a Link ends, and what a reopened one shows: the save, the streak
 * and the finish sheet's words, exactly as engines/link.js finish, recordResult,
 * showEnd, finishSheet and restoreDone do them. The screen and the differential replay
 * both call these, so the replay proves the code the app runs.
 */
import {
  dnTime,
  londonDay,
  recordResultStreak,
  shareLink,
  type GridStreak,
  type KV,
  type SaveStore,
} from '@noodle/core';

import {
  endDetail,
  finishNote,
  guessSquares,
  record,
  recordTime,
  SAVE_KEY,
  STREAK_KEY,
  titleOf,
  type LinkPuzzle,
  type LinkState,
} from './model';

/** Everything the finish sheet shows. */
export interface FinishInfo {
  id: string;
  won: boolean;
  /** "Linked" or "So close.". */
  title: string;
  /** One square per guess: the rank solved, or 0 for a miss. */
  squares: number[];
  note: string;
  share: string;
  /** The time as the sheet shows it ("1:05"). */
  time: string;
  /** The streak as the page's #streak shows it (the saved streak, live or not). */
  streak: number;
  best: number;
}

export interface Finished extends FinishInfo {
  /** The `dn:puzzle_end` detail the site's tracker would send. */
  detail: Record<string, unknown>;
  /** True when this is the puzzle's first finish (no record was kept before). */
  first: boolean;
  /** The finish was today's first go (the page's endRanked). */
  ranked: boolean;
  /** The page's `ranked` afterwards: false once the streak has today's entry. */
  stillRanked: boolean;
  rec: Record<string, unknown> | null;
}

function readJson(kv: KV, key: string): unknown {
  try {
    return JSON.parse(kv.getItem(key) || 'null') as unknown;
  } catch {
    return null;
  }
}

/** The saved Link streak, or null (the engine's `store()`). */
export function readStreak(kv: KV): GridStreak | null {
  const s = readJson(kv, STREAK_KEY);
  return s && typeof s === 'object' ? (s as GridStreak) : null;
}

/** Whether today's result is still to come: no streak entry for the London day `now`. */
export function isRanked(kv: KV, now: number): boolean {
  const s = readStreak(kv);
  return !(s && Array.isArray(s.dates) && s.dates.includes(londonDay(now)));
}

const shown = (kv: KV) => {
  const s = readStreak(kv);
  return { streak: (s && s.streak) || 0, best: (s && s.best) || 0 };
};

/**
 * Save the result and, on today's first go, record the streak; `timer` is the clock
 * as shown ("01:05") and `now` the instant of the finish.
 */
export function commitFinish(
  state: LinkState,
  timer: string,
  saves: SaveStore,
  kv: KV,
  now: number,
): Finished {
  const id = state.p.id;
  const first = !saves.getDone(SAVE_KEY, id);
  const kept = saves.putDone(SAVE_KEY, id, { ...record(state, timer) });
  let ranked = state.ranked;
  const endRanked = ranked;
  if (ranked) {
    const t = londonDay(now);
    const prev = readStreak(kv);
    if (!(prev && (prev.dates || []).includes(t))) {
      saves.saveStreak(STREAK_KEY, recordResultStreak(prev, t, state.won));
      ranked = false;
    }
  }
  const st = shown(kv);
  return {
    id,
    won: state.won,
    title: titleOf(state.won),
    squares: guessSquares(state.guesses),
    note: finishNote(state.p, state.guesses, state.won),
    share: shareLink(state.guesses, state.won, timer, st.streak, id),
    time: dnTime(timer),
    ...st,
    detail: endDetail(state, timer),
    first,
    ranked: endRanked,
    stillRanked: ranked,
    rec: kept,
  };
}

/** A finished Link reopened from its record: its time, guesses and today's streak. */
export function reopenInfo(p: LinkPuzzle, rec: Record<string, unknown>, kv: KV): FinishInfo {
  const t = recordTime(rec);
  const won = rec.o === 'win';
  const raw = Array.isArray(rec.g) ? (rec.g as unknown[]) : [];
  const guesses = raw.filter(
    (x): x is number[] =>
      Array.isArray(x) && x.every((v) => v === 1 || v === 2 || v === 3 || v === 4),
  );
  const st = shown(kv);
  return {
    id: p.id,
    won,
    title: titleOf(won),
    squares: guessSquares(guesses),
    note: finishNote(p, guesses, won),
    share: shareLink(rec.g, won, t, st.streak, p.id),
    time: dnTime(t),
    ...st,
  };
}
