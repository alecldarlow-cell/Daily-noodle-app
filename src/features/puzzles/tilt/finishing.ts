/**
 * What happens when a Tilt maze is got out of, what a reopened one shows, and the unfinished
 * maze in `digi-tilt-v1.cur`, exactly as engines/tilt.js finish, finishSheet, restoreDone,
 * saveCur, clearCur and restoreCur do them. The screen and the replay both call these.
 */
import {
  bumpPathStreak,
  dnNum,
  dnStreak,
  dnTime,
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
  timerText,
  turnsText,
  type Pos,
  type TiltData,
  type TiltState,
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
  turns: number;
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

/** The engine's readSave: the document, or a fresh one. */
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

/** "🌀 Tilt #12 — 1:05 · 9 turns · 🔥3" (the engine's shareText). */
export function shareTilt(id: string, time: string, turns: number, streak: unknown): string {
  return `🌀 Tilt ${dnNum(id)} — ${dnTime(time)} · ${turnsText(turns)}${dnStreak(streak)}`;
}

/** The finish's note: the turns against the shortest way out. */
export const finishNote = (turns: number, par: number, resumed: boolean) =>
  `${turnsText(turns)}, against a shortest way out of ${par}.${resumed ? RESUMED_NOTE : ''}`;

/** Keep an unfinished maze beside the results; a maze back at no turns gives its slot up. */
export function saveCur(
  kv: KV,
  state: TiltState,
  secs: number,
  saves: SaveStore,
  now: number,
): void {
  const id = state.p.id;
  if (state.solved || saves.getDone(SAVE_KEY, id)) return;
  const s = readSave(kv);
  if (state.turns)
    s.cur = {
      id,
      pos: state.pos,
      g: state.g,
      rot: state.rot,
      n: state.turns,
      trail: state.trail,
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

/** The maze kept for this puzzle, as it was left, or null (the engine's checks). */
export function restoreCur(kv: KV, data: TiltData): { state: TiltState; secs: number } | null {
  const c = readSave(kv).cur as Record<string, unknown> | null | undefined;
  const N = data.n;
  if (!c || c.id !== data.id || !Array.isArray(c.pos) || c.pos.length !== 2) return null;
  const [r, cc] = c.pos as number[];
  if (!(r! >= 0 && r! < N && cc! >= 0 && cc! < N) || !((c.g as number) >= 0 && (c.g as number) < 4))
    return null;
  const trail: string[] = [];
  for (const x of Array.isArray(c.trail) ? c.trail : [])
    if (typeof x === 'string' && !trail.includes(x)) trail.push(x);
  return {
    state: {
      ...init(data),
      pos: [r, cc] as Pos,
      g: c.g as number,
      rot: Number.isInteger(c.rot) ? (c.rot as number) : 0,
      turns: Number(c.n) || 0,
      trail,
      msg: RESUME_MSG,
    },
    secs: Number(c.s) || 0,
  };
}

/** Save the result and bump the streak; `now` is the instant the ball went out. */
export function commitFinish(
  state: TiltState,
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
  saves.putDone(SAVE_KEY, id, { t, s: secs, n: state.turns });
  clearCur(kv, id);
  const streak = next.streak || 0;
  return {
    id,
    hero: t,
    note: finishNote(state.turns, state.p.par, resumed),
    share: shareTilt(id, t, state.turns, String(streak)),
    streak,
    best: Math.max(next.best || 0, streak),
    played: doneCount(kv),
    turns: state.turns,
    detail: {
      type: 'logic-tilt',
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

/** The page's message on a reopened maze: "Out in 1:05, 9 turns." */
export const outMsg = (t: string, turns: number) =>
  `Out in ${t}${turns ? `, ${turnsText(turns)}` : ''}.`;

/** A finished maze reopened: its saved time and turns, the live streak, no "picked up". */
export function reopenInfo(
  data: TiltData,
  rec: Record<string, unknown>,
  kv: KV,
  now: number,
): FinishInfo {
  const t = recordTime(rec);
  const turns = Number(rec.n) || 0;
  const streak = liveStreak(kv, now);
  const st = readStreak(kv) || ({} as Partial<GridStreak>);
  return {
    id: data.id,
    hero: t,
    note: finishNote(turns, data.par, false),
    share: shareTilt(data.id, t, turns, String(streak)),
    streak,
    best: Math.max(st.best || 0, streak),
    played: doneCount(kv),
    turns,
  };
}
