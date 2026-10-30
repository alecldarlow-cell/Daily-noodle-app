/**
 * What the phone holds about a puzzle besides its result: a round left part-way, and
 * whether the puzzle itself has been downloaded (opened before), so the cards on Today and
 * the Archive can say "Continue" and, offline, which puzzles still work. Reads only; the
 * players write these keys.
 *
 * Rounds live in two places. Mini, Doku, Sweep and Path keep theirs in the app's own
 * one-slot-per-type keys (`noodle-app-progress-<type>`, features/puzzles/progress.ts).
 * Tangle, Borders and Reckon keep theirs in the site's save (`digi-tangle-v1` days,
 * `digi-borders-v1` / `digi-reckon-v1` / `digi-link-v1` `cur`; Link's from 29 Oct 2026, as
 * the website's engines/link.js keeps it, AF-029).
 */
import { clock, type PuzzleType } from '@noodle/core';

/** The types whose round is kept in the app's own slot. */
export type ProgressType = 'mini' | 'doku' | 'sweep' | 'path';
export const PROGRESS_TYPES: readonly ProgressType[] = ['mini', 'doku', 'sweep', 'path'];

/** `noodle-app-progress-mini` and so on: one slot per type, holding one puzzle's round. */
export const progressKey = (type: ProgressType) => `noodle-app-progress-${type}`;

/** App-only key prefix: a puzzle's data kept after its first open, so it plays offline. */
export const PUZZLE_CACHE_PREFIX = 'noodle-app-puzzle:';

/** "reports/2026-10-24-crossword-mini-0105.html" → "2026-10-24-crossword-mini-0105". */
export function fileOf(path: string): string {
  return path.replace(/^reports\//, '').replace(/\.html$/, '');
}

const isProgressType = (t: PuzzleType): t is ProgressType =>
  (PROGRESS_TYPES as readonly string[]).includes(t);

type Obj = Record<string, unknown>;
const obj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);

/** A round waiting on a card: the time it shows ("4:05", "1:12 left"), when known. */
export interface Round {
  time?: string;
}

/**
 * The round kept for puzzle `id` of `type`, or null, from the type's parsed site save
 * (`site`, `digi-<type>-v1`) and, for the four grid types, its parsed progress slot (`slot`).
 */
export function roundOf(type: PuzzleType, id: string, site: unknown, slot: unknown): Round | null {
  if (obj(site) && obj(site.done) && site.done[id]) return null; // finished
  if (isProgressType(type)) {
    if (!obj(slot) || slot.id !== id || !Array.isArray(slot.moves) || !slot.moves.length)
      return null;
    const secs = typeof slot.secs === 'number' && Number.isFinite(slot.secs) ? slot.secs : NaN;
    const time = clock(Math.floor(secs));
    return time ? { time } : {};
  }
  if (type === 'tangle') {
    const d = obj(site) && obj(site.days) ? site.days[id] : null;
    if (!obj(d) || (d.state !== 'playing' && d.state !== 'suspended')) return null;
    const time = typeof d.left === 'number' ? clock(Math.ceil(Math.max(0, d.left))) : '';
    return time ? { time: `${time} left` } : {};
  }
  if (type === 'borders' || type === 'reckon') {
    const cur = obj(site) ? site.cur : null;
    return obj(cur) && cur.id === id ? {} : null;
  }
  if (type === 'link') {
    // engines/link.js cur: {id, f, m, g, tr, l, s: seconds played, at}
    const cur = obj(site) ? site.cur : null;
    if (!obj(cur) || cur.id !== id) return null;
    const time = typeof cur.s === 'number' ? clock(Math.floor(cur.s)) : '';
    return time ? { time } : {};
  }
  return null;
}

/**
 * The puzzle another round of `type` holds in its one slot, if starting `id` would take
 * that slot (replacing the other round once play starts): the grid types' progress slot,
 * and Borders', Reckon's and Link's `cur`. Tangle keeps every day's round side by side, so
 * it never replaces one.
 */
export function heldElsewhere(
  type: PuzzleType,
  id: string,
  site: unknown,
  slot: unknown,
): string | null {
  let held: unknown = null;
  if (isProgressType(type)) {
    if (obj(slot) && Array.isArray(slot.moves) && slot.moves.length) held = slot.id;
  } else if (type === 'borders' || type === 'reckon' || type === 'link') {
    held = obj(site) && obj(site.cur) ? site.cur.id : null;
  }
  if (typeof held !== 'string' || !held || held === id) return null;
  // A round whose puzzle is already finished is nothing to lose.
  if (obj(site) && obj(site.done) && site.done[held]) return null;
  return held;
}

/** True when `raw` (a `noodle-app-puzzle:<file>` value) is a kept puzzle. */
export const isKept = (raw: string | null): boolean => !!raw && raw.startsWith('{');
