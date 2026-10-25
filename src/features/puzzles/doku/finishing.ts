/**
 * What happens when a Doku is solved, and what a reopened one shows: the save, Doku's
 * own streak (seeded from its results the first time it is read) and the finish
 * sheet's words, exactly as engines/doku.js checkWin, store, bumpStreak, finishSheet
 * and restoreDone do them. The screen and the differential replay both call these,
 * so the replay proves the code the app runs.
 */
import {
  bumpSolveStreak,
  dnTime,
  londonDay,
  seedDokuStreak,
  shareDoku,
  type GridStreak,
  type KV,
  type SaveDoc,
  type SaveStore,
} from '@noodle/core';

import {
  endDetail,
  finish,
  finishNote,
  recordSeconds,
  SAVE_KEY,
  STREAK_KEY,
  timerText,
  type DokuState,
} from './model';

/** Everything the finish sheet shows. */
export interface FinishInfo {
  id: string;
  /** The time as the sheet's hero shows it ("1:27"). */
  hero: string;
  /** The one line under it; empty on a reopened puzzle, as the page leaves it. */
  note: string;
  share: string;
  streak: number;
  best: number;
  played: number;
  /** The record kept in `digi-doku-v1` (the first one, if the puzzle was finished before). */
  rec: Record<string, unknown> | null;
}

export interface Finished extends FinishInfo {
  /** The `dn:puzzle_end` detail the site's tracker would send. */
  detail: Record<string, unknown>;
  /** True when this is the puzzle's first finish (no record was kept before). */
  first: boolean;
}

function readJson(kv: KV, key: string): unknown {
  try {
    return JSON.parse(kv.getItem(key) || 'null') as unknown;
  } catch {
    return null;
  }
}

const doneCount = (kv: KV) => {
  const s = readJson(kv, SAVE_KEY) as { done?: unknown } | null;
  return s && s.done && typeof s.done === 'object' ? Object.keys(s.done).length : 0;
};

/**
 * dn-doku-streak-v1: Doku keeps its own streak in digi-doku-streak (18 Oct 2026; it
 * shared digi-mini-streak before). The first time it is read and there is none, it is
 * rebuilt from the days in Doku's own results and written (the engine's `store(true)`,
 * which the page runs on opening, at the solve and on reopening).
 */
export function ensureStreak(kv: KV): void {
  try {
    if (kv.getItem(STREAK_KEY)) return;
    const seed = seedDokuStreak(readJson(kv, SAVE_KEY) as SaveDoc | null);
    if (seed) kv.setItem(STREAK_KEY, JSON.stringify(seed));
  } catch {
    // the page ignores a failing read or write here too
  }
}

/** The saved Doku streak after seeding, or null. */
export function readStreak(kv: KV): GridStreak | null {
  ensureStreak(kv);
  const s = readJson(kv, STREAK_KEY);
  return s && typeof s === 'object' ? (s as GridStreak) : null;
}

/** Save the result and bump the streak; `now` is the instant of the solve. */
export function commitFinish(
  state: DokuState,
  clockSecs: number,
  saves: SaveStore,
  kv: KV,
  now: number,
): Finished {
  const id = state.p.id;
  const first = !saves.getDone(SAVE_KEY, id);
  const { rec } = finish(state, clockSecs);
  const kept = saves.putDone(SAVE_KEY, id, { ...rec });
  const before = readStreak(kv);
  const streak = bumpSolveStreak(before, londonDay(now));
  // The engine writes only when the day is new (otherwise it just repaints).
  if (streak !== before) saves.saveStreak(STREAK_KEY, streak);
  const shown = timerText(rec.s);
  return {
    id,
    hero: dnTime(shown),
    note: finishNote(state),
    share: shareDoku(id, shown, streak.streak || 0),
    streak: streak.streak || 0,
    best: streak.best || 0,
    played: doneCount(kv),
    rec: kept,
    detail: endDetail(state, clockSecs),
    first,
  };
}

/** A finished Doku reopened: its original time, the saved streak, no note. */
export function reopenInfo(id: string, rec: Record<string, unknown>, kv: KV): FinishInfo {
  const shown = timerText(recordSeconds(rec));
  const st = readStreak(kv);
  const streak = (st && st.streak) || 0;
  return {
    id,
    hero: dnTime(shown),
    note: '',
    share: shareDoku(id, shown, streak),
    streak,
    best: (st && st.best) || 0,
    played: doneCount(kv),
    rec,
  };
}
