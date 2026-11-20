/**
 * What happens when a Cryptic is solved, what a reopened one shows, and the unfinished clue in
 * `digi-cryptic-v1.cur`, exactly as engines/cryptic.js finish, finishSheet, restoreDone,
 * saveCur, clearCur and restoreCur do them, so the website and the app share one save.
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
  crypticNumber,
  hintsText,
  init,
  locked,
  RESUME_MSG,
  revealed,
  firstOpen,
  SAVE_KEY,
  STREAK_KEY,
  timerText,
  type CrypticData,
  type CrypticState,
} from './model';

export const RESUMED_NOTE = ' Picked up where you left off.';

/** The note under the time: "No hints." / "2 hints." (the web's hero shows the hints beside it). */
export const hintsNote = (h: number) => {
  const x = hintsText(h);
  return `${x[0]!.toUpperCase()}${x.slice(1)}.`;
};

export interface FinishInfo {
  id: string;
  hero: string;
  note: string;
  share: string;
  streak: number;
  best: number;
  played: number;
  hints: number;
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

/** Clues solved on this phone (the start card's number). */
export const playedCount = doneCount;

export function readStreak(kv: KV): GridStreak | null {
  const s = readJson(kv, STREAK_KEY);
  return s && typeof s === 'object' ? (s as GridStreak) : null;
}

export function liveStreak(kv: KV, now: number): number {
  return livePathStreak(readStreak(kv), londonDay(now));
}

/** The share line: "🕵️ Cryptic #3 — 0:48 · 1 hint · 🔥4". */
export function shareCryptic(id: string, time: string, hints: number, streak: number): string {
  return `🕵️ Cryptic #${crypticNumber(id)} — ${time.trim()} · ${hintsText(hints)}${dnStreak(String(streak))}`;
}

/** Keep an unfinished clue beside the results; a clue back to nothing gives its slot up. */
export function saveCur(
  kv: KV,
  state: CrypticState,
  secs: number,
  saves: SaveStore,
  now: number,
): void {
  const id = state.p.id;
  if (state.solved || saves.getDone(SAVE_KEY, id)) return;
  const s = readSave(kv);
  if (state.hints || state.letters.some(Boolean))
    s.cur = {
      id,
      letters: state.letters.slice(),
      hints: state.hints,
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

/** The clue kept for this puzzle, or null. */
export function restoreCur(
  kv: KV,
  data: CrypticData,
): { state: CrypticState; secs: number } | null {
  const fresh = init(data);
  const N = data.n;
  const c = readSave(kv).cur as {
    id?: unknown;
    letters?: unknown;
    hints?: unknown;
    s?: unknown;
  } | null;
  if (!c || c.id !== data.id || !Array.isArray(c.letters) || c.letters.length !== N) return null;
  const hints = Math.max(0, Math.min(N + 2, Number(c.hints) || 0));
  const st: CrypticState = {
    ...fresh,
    hints,
    letters: (c.letters as unknown[]).map((x) =>
      typeof x === 'string' && /^[A-Z]$/.test(x) ? x : '',
    ),
    msg: RESUME_MSG,
  };
  for (let i = 0; i < revealed(st); i++) st.letters[i] = fresh.sol.a[i]!;
  const gap = st.letters.findIndex((x, i) => !x && !locked(st, i));
  st.cur = gap >= 0 ? gap : firstOpen(st, 0);
  return { state: st, secs: Number(c.s) || 0 };
}

/** Save the result and bump the streak; `now` is the instant of the solving move. */
export function commitFinish(
  state: CrypticState,
  clockSecs: number,
  resumed: boolean,
  saves: SaveStore,
  kv: KV,
  now: number,
  /** Hints already taken when this session picked the clue up: the tracker counts this session's (dn-track.js). */
  hintsBefore = 0,
): Finished {
  const id = state.p.id;
  const first = !saves.getDone(SAVE_KEY, id);
  const secs = Math.round(clockSecs);
  const t = timerText(secs);
  const prev = readStreak(kv);
  const next = bumpPathStreak(prev, londonDay(now));
  if (next !== prev) saves.saveStreak(STREAK_KEY, next);
  saves.putDone(SAVE_KEY, id, { t, s: secs, h: state.hints });
  clearCur(kv, id);
  const streak = next.streak || 0;
  return {
    id,
    hero: t,
    note: `${hintsNote(state.hints)}${resumed ? RESUMED_NOTE : ''}`,
    share: shareCryptic(id, t, state.hints, streak),
    streak,
    best: Math.max(next.best || 0, streak),
    played: doneCount(kv),
    hints: state.hints,
    detail: {
      type: 'word-cryptic',
      tv: 3,
      outcome: 'solved',
      secs,
      checks: 0,
      reveals: 0,
      hints: Math.max(0, state.hints - hintsBefore),
    },
    first,
  };
}

/** The saved time as the engine reads it back: "0:00" for anything that isn't a clock. */
export const recordTime = (rec: Record<string, unknown>) =>
  /^\d{1,4}:\d{2}$/.test(String(rec.t)) ? String(rec.t) : '0:00';

/** A finished Cryptic reopened: its saved time and hints, the live streak. */
export function reopenInfo(
  data: CrypticData,
  rec: Record<string, unknown>,
  kv: KV,
  now: number,
): FinishInfo {
  const t = recordTime(rec);
  const hints = Number(rec.h) || 0;
  const streak = liveStreak(kv, now);
  const st = readStreak(kv) || ({} as Partial<GridStreak>);
  return {
    id: data.id,
    hero: t,
    note: hintsNote(hints),
    share: shareCryptic(data.id, t, hints, streak),
    streak,
    best: Math.max(st.best || 0, streak),
    played: doneCount(kv),
    hints,
  };
}
