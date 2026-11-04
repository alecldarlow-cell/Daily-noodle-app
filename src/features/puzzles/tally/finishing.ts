/**
 * What happens when a Tally is solved, what a reopened one shows, and the unfinished round
 * in `digi-tally-v1.cur`, exactly as engines/tally.js finish, finishSheet, restoreDone,
 * saveCur, clearCur and restoreCur do them. The screen and the replay both call these.
 */
import {
  bumpPathStreak,
  livePathStreak,
  londonDay,
  shareTally,
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
  type TallyData,
  type TallyState,
} from './model';

export const RESUMED_NOTE = 'Picked up where you left off.';

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

/** Keep an unfinished board beside the results; a board emptied again gives its slot up. */
export function saveCur(
  kv: KV,
  state: TallyState,
  secs: number,
  saves: SaveStore,
  now: number,
): void {
  const id = state.p.id;
  if (state.solved || saves.getDone(SAVE_KEY, id)) return;
  const s = readSave(kv);
  if (state.g.some(Boolean) || state.notes.some(Boolean))
    s.cur = { id, g: state.g, notes: state.notes, s: Math.round(secs), at: now };
  else if (s.cur && s.cur.id === id) delete s.cur;
  else return;
  kv.setItem(SAVE_KEY, JSON.stringify(s));
}

function clearCur(kv: KV, id: string): void {
  const s = readSave(kv);
  if (s.cur && s.cur.id === id) {
    delete s.cur;
    kv.setItem(SAVE_KEY, JSON.stringify(s));
  }
}

/** The round kept for this puzzle, on its board, or null. */
export function restoreCur(kv: KV, data: TallyData): { state: TallyState; secs: number } | null {
  const fresh = init(data);
  const c = readSave(kv).cur as { id?: unknown; g?: unknown; notes?: unknown; s?: unknown } | null;
  const cells = fresh.g.length;
  if (!c || c.id !== data.id || !Array.isArray(c.g) || c.g.length !== cells) return null;
  const list = (x: unknown[]) => x.map((v) => Number(v) || 0);
  const notes = Array.isArray(c.notes) && c.notes.length === cells ? list(c.notes) : fresh.notes;
  return {
    state: { ...fresh, g: list(c.g), notes, msg: RESUME_MSG },
    secs: Number(c.s) || 0,
  };
}

/** Save the result and bump the streak; `now` is the instant of the last number. */
export function commitFinish(
  state: TallyState,
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
  const day = londonDay(now);
  const next = bumpPathStreak(prev, day);
  if (next !== prev) saves.saveStreak(STREAK_KEY, next);
  saves.putDone(SAVE_KEY, id, { t, s: secs });
  clearCur(kv, id);
  const streak = next.streak || 0;
  return {
    id,
    hero: t,
    note: resumed ? RESUMED_NOTE : '',
    share: shareTally(id, t, String(streak)),
    streak,
    best: Math.max(next.best || 0, streak),
    played: doneCount(kv),
    detail: {
      type: 'logic-tally',
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

/** A finished Tally reopened: its saved time, the live streak, no note. */
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
    note: '',
    share: shareTally(id, t, String(streak)),
    streak,
    best: Math.max(st.best || 0, streak),
    played: doneCount(kv),
  };
}
