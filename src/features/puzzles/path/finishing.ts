/**
 * What happens when a Path is complete, and what a reopened one shows: the save, the
 * streak and the finish sheet's words, exactly as engines/path.js checkWin, streakBump,
 * finishSheet and restoreDone do them. The screen and the differential replay both
 * call these, so the replay proves the code the app runs.
 */
import {
  bumpPathStreak,
  dnTime,
  livePathStreak,
  londonDay,
  sharePath,
  type GridStreak,
  type KV,
  type SaveStore,
} from '@noodle/core';

import {
  endDetail,
  finish,
  finishNote,
  recordTime,
  SAVE_KEY,
  STREAK_KEY,
  type PathState,
} from './model';

export interface FinishInfo {
  id: string;
  /** The time as the sheet's hero shows it ("1:27"). */
  hero: string;
  /** The one line; empty on a reopened puzzle. */
  note: string;
  share: string;
  streak: number;
  best: number;
  played: number;
}

export interface Finished extends FinishInfo {
  detail: Record<string, unknown>;
  /** True when this is the puzzle's first finish (no record was kept before). */
  first: boolean;
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

/** The saved Path streak, or null (the engine's streakGet). */
export function readStreak(kv: KV): GridStreak | null {
  const s = readJson(kv, STREAK_KEY);
  return s && typeof s === 'object' ? (s as GridStreak) : null;
}

/** The streak the page shows from load: alive only if played today or yesterday. */
export function liveStreak(kv: KV, now: number): number {
  return livePathStreak(readStreak(kv), londonDay(now));
}

/** Save the result and bump the streak; `now` is the instant of the last square. */
export function commitFinish(
  state: PathState,
  clockSecs: number,
  saves: SaveStore,
  kv: KV,
  now: number,
): Finished {
  const id = state.p.id;
  const first = !saves.getDone(SAVE_KEY, id);
  const { rec } = finish(state, clockSecs);
  const kept = saves.putDone(SAVE_KEY, id, { ...rec });
  const prev = readStreak(kv);
  const next = bumpPathStreak(prev, londonDay(now));
  if (next !== prev) saves.saveStreak(STREAK_KEY, next);
  const streak = next.streak || 0;
  return {
    id,
    hero: dnTime(rec.t),
    note: finishNote(state, true),
    share: sharePath(id, rec.t, String(streak)),
    streak,
    best: Math.max(next.best || 0, streak),
    played: doneCount(kv),
    detail: endDetail(state, clockSecs),
    first,
    rec: kept,
  };
}

/** A finished Path reopened: its saved time, the live streak, no note. */
export function reopenInfo(
  state: PathState,
  rec: Record<string, unknown>,
  kv: KV,
  now: number,
): FinishInfo {
  const t = recordTime(rec);
  const streak = liveStreak(kv, now);
  const st = readStreak(kv) || ({} as Partial<GridStreak>);
  return {
    id: state.p.id,
    hero: dnTime(t),
    note: finishNote(state, false),
    share: sharePath(state.p.id, t, String(streak)),
    streak,
    best: Math.max(st.best || 0, streak),
    played: doneCount(kv),
  };
}
