/**
 * What happens when a Sweep ends, and what a reopened one shows: the save, the streak
 * and the finish sheet's words, exactly as engines/sweep.js donePut, recordResult,
 * showEnd, finishSheet and restoreDone do them. The screen and the differential replay
 * both call these, so the replay proves the code the app runs.
 */
import {
  dnTime,
  londonDay,
  recordResultStreak,
  shareSweep,
  type GridStreak,
  type KV,
  type SaveStore,
} from '@noodle/core';

import {
  endDetail,
  finish,
  finishNote,
  SAVE_KEY,
  STREAK_KEY,
  timerText,
  type SweepState,
} from './model';

/** Everything the finish sheet shows. */
export interface FinishInfo {
  id: string;
  /** "Swept" or "Boom." (the tracker's loss title: kept exact). */
  title: string;
  /** The time as the sheet's hero shows it ("1:27"). */
  hero: string;
  note: string;
  share: string;
  streak: number;
  best: number;
  played: number;
  /** "Play again (not recorded)" is offered after a mine. */
  again: boolean;
}

export interface Finished extends FinishInfo {
  /** The `dn:puzzle_end` detail the site's tracker would send. */
  detail: Record<string, unknown>;
  /** True when this is the puzzle's first result (no record was kept before). */
  first: boolean;
  /** The record kept in `digi-sweep-v1` (the first one, if it had a result before). */
  rec: Record<string, unknown> | null;
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

/** The saved Sweep streak, or null (the engine's `store(true)`). */
export function readStreak(kv: KV): GridStreak | null {
  const s = readJson(kv, STREAK_KEY);
  return s && typeof s === 'object' ? (s as GridStreak) : null;
}

/** Whether today's result is still to come: the engine's initRanked. */
export function isRanked(kv: KV, now: number): boolean {
  const s = readStreak(kv);
  return !(s && Array.isArray(s.dates) && s.dates.includes(londonDay(now)));
}

/** The bar's streak and the sheet's two streak stats: the saved numbers as they stand. */
function saved(kv: KV) {
  const s = readStreak(kv) || { streak: 0, best: 0 };
  return { streak: s.streak || 0, best: s.best || 0 };
}

/**
 * A round just ended (`state.over`): save the result (the first is kept), and when it
 * counted (`endRanked`) record it in the streak, a loss ending the run. `now` is the
 * instant of the last square.
 */
export function commitFinish(state: SweepState, saves: SaveStore, kv: KV, now: number): Finished {
  const id = state.p.id;
  const first = !saves.getDone(SAVE_KEY, id);
  const { rec } = finish(state);
  const kept = saves.putDone(SAVE_KEY, id, { ...rec });
  if (state.endRanked) {
    const prev = readStreak(kv);
    const next = recordResultStreak(prev, londonDay(now), state.won);
    if (next !== prev) saves.saveStreak(STREAK_KEY, next);
  }
  const st = saved(kv);
  const o = state.won ? 'win' : 'loss';
  return {
    id,
    title: state.won ? 'Swept' : 'Boom.',
    hero: dnTime(timerText(state.endSecs)),
    note: finishNote(state, true),
    share: shareSweep(o, timerText(state.endSecs), st.streak, id),
    ...st,
    played: doneCount(kv),
    again: !state.won,
    detail: endDetail(state),
    first,
    rec: kept,
  };
}

/** A finished Sweep reopened (restoreDone): its time, the saved streak, the short note. */
export function reopenInfo(state: SweepState, kv: KV): FinishInfo {
  const st = saved(kv);
  const time = timerText(state.endSecs);
  return {
    id: state.p.id,
    title: state.won ? 'Swept' : 'Boom.',
    hero: dnTime(time),
    note: finishNote(state, false),
    share: shareSweep(state.won ? 'win' : 'loss', time, st.streak, state.p.id),
    ...st,
    played: doneCount(kv),
    again: !state.won,
  };
}

/** The bar's flame: the saved streak (refreshStreakUI shows it as stored). */
export const barStreak = (kv: KV) => saved(kv).streak;
