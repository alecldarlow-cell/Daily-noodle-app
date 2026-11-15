/**
 * What happens when a Redact is solved, what a reopened one shows, and the unfinished board
 * in `digi-redact-v1.cur`, exactly as engines/redact.js finish, finishSheet, restoreDone,
 * saveCur, clearCur and restoreCur do them, so the website and the app share progress. The
 * screen and the replay both call these. Redact is a Lab trial: its own streak key is kept as
 * the page keeps it, but it never joins the overall run or the leagues.
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
  redactNumber,
  SAVE_KEY,
  STREAK_KEY,
  timerText,
  type RedactData,
  type RedactState,
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

/** How many Redacts are finished on this phone (the start card's number). */
export const playedCount = doneCount;

/** The share line: "⬛ Redact #25 — 2:48 · 🔥3". */
export const shareRedact = (id: string, t: string, streak: number) =>
  `⬛ Redact #${redactNumber(id)} — ${t}${dnStreak(String(streak))}`;

/** The finish note: the wrong tries at the full count, and a resumed board. */
export function finishNote(misses: number, resumed: boolean): string {
  return (
    (misses
      ? `${misses} wrong ${misses === 1 ? 'try' : 'tries'} at the full count.`
      : 'Right first time at the full count.') + (resumed ? RESUMED_NOTE : '')
  );
}

/** Keep an unfinished board beside the results; an untouched board gives its slot up. */
export function saveCur(
  kv: KV,
  state: RedactState,
  secs: number,
  saves: SaveStore,
  now: number,
): void {
  const id = state.p.id;
  if (state.solved || saves.getDone(SAVE_KEY, id)) return;
  const s = readSave(kv);
  if (state.taps)
    s.cur = {
      id,
      b: state.black,
      t: state.taps,
      m: state.misses,
      s: Math.round(secs),
      at: now,
    };
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
export function restoreCur(kv: KV, data: RedactData): { state: RedactState; secs: number } | null {
  const c = readSave(kv).cur as {
    id?: unknown;
    b?: unknown;
    t?: unknown;
    m?: unknown;
    s?: unknown;
  } | null;
  if (!c || c.id !== data.id || !Array.isArray(c.b)) return null;
  const n2 = data.n * data.n;
  const black = [
    ...new Set(c.b.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < n2)),
  ];
  return {
    state: {
      ...init(data),
      black,
      taps: Number(c.t) || 0,
      misses: Number(c.m) || 0,
      msg: RESUME_MSG,
    },
    secs: Number(c.s) || 0,
  };
}

/** Save the result and bump the streak; `now` is the instant of the last tap. */
export function commitFinish(
  state: RedactState,
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
  saves.putDone(SAVE_KEY, id, { t, s: secs, m: state.misses });
  clearCur(kv, id);
  const streak = next.streak || 0;
  return {
    id,
    hero: t,
    note: finishNote(state.misses, resumed),
    share: shareRedact(id, t, streak),
    streak,
    best: Math.max(next.best || 0, streak),
    played: doneCount(kv),
    detail: {
      type: 'word-redact',
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

/** A finished Redact reopened: its saved time and wrong tries, the live streak. */
export function reopenInfo(
  id: string,
  rec: Record<string, unknown>,
  kv: KV,
  now: number,
): FinishInfo {
  const t = recordTime(rec);
  const streak = liveStreak(kv, now);
  const st = readStreak(kv) || ({} as Partial<GridStreak>);
  return {
    id,
    hero: t,
    note: finishNote(Number(rec.m) || 0, false),
    share: shareRedact(id, t, streak),
    streak,
    best: Math.max(st.best || 0, streak),
    played: doneCount(kv),
  };
}
