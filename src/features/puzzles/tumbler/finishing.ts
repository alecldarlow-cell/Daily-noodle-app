/**
 * What happens when a Tumbler is solved, what a reopened one shows, and the unfinished board
 * in `digi-tumbler-v1.cur`, exactly as engines/tumbler.js finish, finishSheet, restoreDone,
 * saveCur, clearCur and restoreCur do them, so the website and the app share one save. The
 * screen and the replay both call these.
 */
import {
  bumpPathStreak,
  dnStreak,
  livePathStreak,
  londonDay,
  type GridStreak,
  type KV,
  type SaveStore,
} from '@noodle/core';

import {
  init,
  RESUME_MSG,
  SAVE_KEY,
  STREAK_KEY,
  submitsText,
  timerText,
  tumblerNumber,
  type TumblerData,
  type TumblerState,
} from './model';

export const RESUMED_NOTE = ' Picked up where you left off.';

export interface FinishInfo {
  id: string;
  hero: string;
  note: string;
  share: string;
  streak: number;
  best: number;
  played: number;
  /** The submits that found it, oldest first (the recap). */
  tries: string[];
}

export interface Finished extends FinishInfo {
  detail: Record<string, unknown>;
  first: boolean;
}

type Save = { v?: number; done?: unknown; cur?: Record<string, unknown> | null };

function readJson(kv: KV, key: string): unknown {
  try {
    return JSON.parse(kv.getItem(key) || 'null') as unknown;
  } catch {
    return null;
  }
}

function readSave(kv: KV): Save {
  const s = readJson(kv, SAVE_KEY);
  return s && typeof s === 'object' ? (s as Save) : { v: 1 };
}

const doneCount = (kv: KV) => {
  const s = readSave(kv);
  return s.done && typeof s.done === 'object' ? Object.keys(s.done).length : 0;
};

export function readStreak(kv: KV): GridStreak | null {
  const s = readJson(kv, STREAK_KEY);
  return s && typeof s === 'object' ? (s as GridStreak) : null;
}

export function liveStreak(kv: KV, now: number): number {
  return livePathStreak(readStreak(kv), londonDay(now));
}

/** The share line: "🎛️ Tumbler #25 — 1:42 · 3 submits · 🔥4". */
export function shareTumbler(id: string, time: string, submits: number, streak: number): string {
  return `🎛️ Tumbler #${tumblerNumber(id)} — ${time.trim()} · ${submitsText(submits)}${dnStreak(String(streak))}`;
}

/** Puzzles of the type finished on this phone (the start card's number). */
export const playedCount = doneCount;

/** Keep an unfinished board beside the results; a board back to nothing gives its slot up. */
export function saveCur(
  kv: KV,
  state: TumblerState,
  secs: number,
  saves: SaveStore,
  now: number,
): void {
  const id = state.p.id;
  if (state.solved || saves.getDone(SAVE_KEY, id)) return;
  const s = readSave(kv);
  if (state.turns || state.tries.length)
    s.cur = { id, o: state.off, w: state.tries, t: state.turns, s: Math.round(secs), at: now };
  else if (s.cur && s.cur.id === id) delete s.cur;
  else return;
  if (!s.v) s.v = 1;
  kv.setItem(SAVE_KEY, JSON.stringify(s));
}

function clearCur(kv: KV, id: string): void {
  const s = readSave(kv);
  if (s.cur && s.cur.id === id) {
    delete s.cur;
    kv.setItem(SAVE_KEY, JSON.stringify(s));
  }
}

/** The board kept for this puzzle, or null. */
export function restoreCur(
  kv: KV,
  data: TumblerData,
): { state: TumblerState; secs: number } | null {
  const fresh = init(data);
  const c = readSave(kv).cur as {
    id?: unknown;
    o?: unknown;
    w?: unknown;
    t?: unknown;
    s?: unknown;
  } | null;
  if (!c || c.id !== data.id || !Array.isArray(c.o) || c.o.length !== data.n) return null;
  const P = fresh.size;
  const off = c.o.map((x) => (((Number(x) || 0) % P) + P) % P);
  const tries = Array.isArray(c.w)
    ? (c.w as unknown[]).filter((w): w is string => fresh.words.has(w as string))
    : [];
  return {
    state: { ...fresh, off, tries, turns: Number(c.t) || 0, msg: RESUME_MSG },
    secs: Number(c.s) || 0,
  };
}

/** Save the result and bump the streak; `now` is the instant of the solving submit. */
export function commitFinish(
  state: TumblerState,
  clockSecs: number,
  resumed: boolean,
  saves: SaveStore,
  kv: KV,
  now: number,
): Finished {
  const id = state.p.id;
  const first = !saves.getDone(SAVE_KEY, id);
  const secs = Math.round(clockSecs);
  const t = timerText(secs);
  const prev = readStreak(kv);
  const next = bumpPathStreak(prev, londonDay(now));
  if (next !== prev) saves.saveStreak(STREAK_KEY, next);
  saves.putDone(SAVE_KEY, id, { t, s: secs, n: state.tries.length, w: state.tries });
  clearCur(kv, id);
  const streak = next.streak || 0;
  return {
    id,
    hero: t,
    note: `${submitsText(state.tries.length)}, ${state.turns} turns.${resumed ? RESUMED_NOTE : ''}`,
    share: shareTumbler(id, t, state.tries.length, streak),
    streak,
    best: Math.max(next.best || 0, streak),
    played: doneCount(kv),
    tries: state.tries,
    detail: {
      type: 'word-tumbler',
      tv: 3,
      outcome: 'solved',
      secs,
      checks: 0,
      reveals: 0,
      hints: 0,
    },
    first,
  };
}

/** The saved time as the engine reads it back: "0:00" for anything that isn't a clock. */
export const recordTime = (rec: Record<string, unknown>) =>
  /^\d{1,4}:\d{2}$/.test(String(rec.t)) ? String(rec.t) : '0:00';

/** A finished Tumbler reopened: its saved time and submits, the live streak. */
export function reopenInfo(
  data: TumblerData,
  rec: Record<string, unknown>,
  kv: KV,
  now: number,
): FinishInfo {
  const t = recordTime(rec);
  const tries = Array.isArray(rec.w) ? (rec.w as string[]) : [data.secret];
  const streak = liveStreak(kv, now);
  const st = readStreak(kv) || ({} as Partial<GridStreak>);
  return {
    id: data.id,
    hero: t,
    note: `${submitsText(tries.length)}.`,
    share: shareTumbler(data.id, t, tries.length, streak),
    streak,
    best: Math.max(st.best || 0, streak),
    played: doneCount(kv),
    tries,
  };
}
