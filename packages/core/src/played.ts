/**
 * What a puzzle card says once you've played it, and the overall run. Ported from
 * dailynoodle front.js (playedState, resultText, clock, shownClock, showRun).
 */
import { dayBefore, londonDay } from './london';
import type { PuzzleType } from './ids';
import type { SaveDoc } from './types';

type Obj = Record<string, unknown>;

/** Seconds as the site shows a time: "1:27", "12:05", "1:02:03". Empty for bad input. */
export function clock(secs: unknown): string {
  const n = Math.round(Number(secs));
  if (!Number.isFinite(n) || n < 0) return '';
  const h = Math.floor(n / 3600);
  const m = Math.floor(n / 60) % 60;
  const s = n % 60;
  return (h ? `${h}:${m < 10 ? '0' : ''}` : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

/** A clock string as shown ("03:05", "1:02:03") re-formatted the site's way. */
export function shownClock(t: unknown): string {
  const m = /^(\d+):(\d\d)(?::(\d\d))?$/.exec(String(t || ''));
  if (!m) return '';
  return clock(m[3] ? +m[1]! * 3600 + +m[2]! * 60 + +m[3] : +m[1]! * 60 + +m[2]!);
}

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** The result line on a played card ("Solved in 1:42", "Hit a mine"…); empty if none. */
export function resultText(type: PuzzleType, r: Obj): string {
  let t: string;
  switch (type) {
    case 'mini':
    case 'doku':
      t = clock(r.s);
      return t ? `Solved in ${t}` : '';
    case 'sweep':
      if (r.o === 'loss') return 'Hit a mine';
      if (r.o === 'gave') return 'Gave up';
      t = clock(r.s);
      return t ? `Cleared in ${t}` : '';
    case 'path':
      t = shownClock(r.t) || clock(r.s);
      return t ? `Solved in ${t}` : '';
    case 'link':
      if (r.o === 'loss') return 'Out of mistakes';
      if (r.o === 'win')
        return num(r.m)
          ? r.m === 0
            ? 'Solved, no mistakes'
            : `Solved, ${r.m} mistake${r.m === 1 ? '' : 's'}`
          : 'Solved';
      return '';
    case 'tangle':
      return num(r.s) ? `${r.s} points` : '';
    case 'borders':
      // Points since 26 Oct 2026 (100 a right answer, 50 with Show on map); the right answers after.
      if (num(r.p)) return `${r.p} points` + (num(r.c) ? ` · ${r.c}/10` : '');
      return num(r.c) ? `Scored ${r.c}/10` : '';
    case 'reckon':
      return num(r.p) ? `${r.p} points` : '';
  }
  return '';
}

export type PlayedState = { done: true; lost: boolean; text: string } | { done: false };

/** A card's state from its type's save: finished (with wording), in progress, or null. */
export function playedState(type: PuzzleType, id: string, doc: SaveDoc | null): PlayedState | null {
  if (!doc || typeof doc !== 'object') return null;
  const r =
    doc.done && typeof doc.done === 'object' ? (doc.done[id] as Obj | undefined) : undefined;
  if (r) {
    const isObj = typeof r === 'object';
    return {
      done: true,
      lost: isObj && (r.o === 'loss' || r.o === 'gave'),
      text: (isObj && resultText(type, r)) || 'Played',
    };
  }
  const d = doc.days && doc.days[id];
  if (type === 'tangle' && d && (d.state === 'playing' || d.state === 'suspended'))
    return { done: false };
  if ((type === 'borders' || type === 'reckon') && doc.cur && doc.cur.id === id)
    return { done: false };
  return null;
}

export const RUN_RESULT_KEYS = [
  'digi-mini-v1',
  'digi-doku-v1',
  'digi-sweep-v1',
  'digi-path-v1',
  'digi-link-v1',
  'digi-tangle-v1',
  'digi-borders-v1',
  'digi-reckon-v1',
] as const;
export const RUN_STREAK_KEYS = [
  'digi-mini-streak',
  'digi-doku-streak',
  'digi-link-streak',
  'digi-sweep-streak',
  'digi-path-streak',
] as const;

/**
 * The overall run: consecutive London days, ending today or yesterday, on which any
 * daily puzzle was played. `docs` maps storage keys to parsed documents. The Puzzles
 * page shows it as "🔥 N-day streak" from 2 days up; celebration only, never a nudge.
 */
export function overallRun(docs: Record<string, unknown>, now?: Date | number): number {
  const days = new Set<string>();
  for (const k of RUN_RESULT_KEYS) {
    const s = docs[k] as Obj | null | undefined;
    if (s && s.done && typeof s.done === 'object') {
      for (const id in s.done as Obj) {
        const r = (s.done as Obj)[id] as Obj | null | undefined;
        const d = r && (r.d || r.on);
        if (d) days.add(String(d));
      }
    }
  }
  for (const k of RUN_STREAK_KEYS) {
    const s = docs[k] as Obj | null | undefined;
    if (s && Array.isArray(s.dates)) for (const d of s.dates) days.add(String(d));
  }
  const t = londonDay(now);
  let d = days.has(t) ? t : dayBefore(t);
  let n = 0;
  while (days.has(d) && n < 4000) {
    n++;
    d = dayBefore(d);
  }
  return n;
}
