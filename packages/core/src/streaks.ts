/**
 * Streak rules, ported from the site's engines. Two shapes exist:
 * - Grid streaks (Mini, Doku, Sweep, Path, Link) in `digi-<type>-streak`:
 *   {last, streak, best, dates (last 90 days played), tz: "L"}.
 * - Round streaks (Tangle, Borders, Reckon) inside the result document: {last, n, best}.
 * Every function is pure: it returns a new object (or the same one, unchanged).
 */
import { dayBefore } from './london';
import type { GridStreak, RoundStreak, SaveDoc } from './types';

const EMPTY_GRID: GridStreak = { last: null, streak: 0, best: 0, dates: [] };

/**
 * Whether day `t` continues streak `s`. A save written before 18 Oct 2026 (no tz mark)
 * may hold a UTC date, so it is allowed one extra day of gap, once.
 */
export function followsOn(s: Pick<GridStreak, 'last' | 'tz'>, t: string): boolean {
  const y = dayBefore(t);
  return s.last === y || (!s.tz && s.last === dayBefore(y));
}

function stamp(s: GridStreak, t: string): GridStreak {
  return { ...s, last: t, tz: 'L', dates: [...new Set([...(s.dates || []), t])].slice(-90) };
}

/** Mini and Doku: a solve on day t (engines' bumpStreak). Once a day. */
export function bumpSolveStreak(prev: GridStreak | null, t: string): GridStreak {
  const s = prev || EMPTY_GRID;
  if (s.dates && s.dates.includes(t)) return s;
  const streak = followsOn(s, t) ? s.streak + 1 : 1;
  return stamp({ ...s, streak, best: Math.max(s.best, streak) }, t);
}

/** Sweep and Link: a win continues the run, a loss ends it (engines' recordResult). Once a day. */
export function recordResultStreak(prev: GridStreak | null, t: string, win: boolean): GridStreak {
  const s = prev || EMPTY_GRID;
  if ((s.dates || []).includes(t)) return s;
  const next = win
    ? (() => {
        const streak = followsOn(s, t) ? s.streak + 1 : 1;
        return { ...s, streak, best: Math.max(s.best || 0, streak) };
      })()
    : { ...s, streak: 0 };
  return stamp(next, t);
}

/** Path: a solve on day t (engines/path.js streakBump; no tz grace). Once a day. */
export function bumpPathStreak(prev: GridStreak | null, t: string): GridStreak {
  const s = prev || EMPTY_GRID;
  if ((s.dates || []).includes(t)) return s;
  const streak = s.last === dayBefore(t) ? (s.streak || 0) + 1 : 1;
  return stamp({ ...s, streak, best: Math.max(s.best || 0, streak) }, t);
}

/** Path shows a streak only while it is alive (played today or yesterday). */
export function livePathStreak(s: GridStreak | null, t: string): number {
  return s && (s.last === t || s.last === dayBefore(t)) ? s.streak || 0 : 0;
}

/**
 * Doku's own streak, rebuilt from its saved results the first time it is read
 * (Doku shared Mini's streak before 18 Oct 2026). Null when it has no dated results.
 */
export function seedDokuStreak(doc: SaveDoc | null): GridStreak | null {
  const days = new Set<string>();
  if (doc && doc.done) {
    for (const id in doc.done) {
      const d = (doc.done[id] as { d?: unknown } | undefined)?.d;
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) days.add(d);
    }
  }
  const list = [...days].sort();
  if (!list.length) return null;
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of list) {
    run = prev && dayBefore(d) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { last: prev, streak: run, best, dates: list.slice(-90), tz: 'L', seeded: 1 };
}

/**
 * Tangle, Borders, Reckon: a finished round on day t. The caller decides whether the
 * round counts (Tangle and Reckon only on the puzzle's own day; Borders always).
 */
export function bumpRoundStreak(prev: RoundStreak | null | undefined, t: string): RoundStreak {
  const s: RoundStreak = { ...(prev || { last: null, n: 0, best: 0 }) };
  if (s.last !== t) {
    s.n = s.last === dayBefore(t) ? (Number(s.n) || 0) + 1 : 1;
    s.last = t;
  }
  s.best = Math.max(s.best || 0, s.n);
  return s;
}

/** A round streak counts while it was played today or yesterday. */
export function liveRoundStreak(s: Partial<RoundStreak> | null | undefined, t: string): number {
  return s && (s.last === t || s.last === dayBefore(t)) ? s.n || 0 : 0;
}
