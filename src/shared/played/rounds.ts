/**
 * What the phone holds about a puzzle besides its result: a round left part-way, and
 * whether the puzzle itself has been downloaded (opened before), so the cards on Today and
 * the Archive can say "Continue" and, offline, which puzzles still work. Reads only; the
 * players write these keys.
 *
 * Rounds live in two places. Mini, Doku, Sweep and Path keep theirs in the app's own
 * keys (`noodle-app-rounds-<type>`, one per puzzle, and the older one-per-type slot
 * `noodle-app-progress-<type>`; features/puzzles/progress.ts). Tangle keeps its days in
 * `digi-tangle-v1`; Borders, Reckon, Link and Tally keep one round per puzzle in their site
 * save's `rounds` (22 Nov 2026; the single `cur` before, still read).
 */
import { clock, roundFor, type PuzzleType } from '@noodle/core';

/** The types whose round is kept in the app's own slot. */
export type ProgressType = 'mini' | 'doku' | 'sweep' | 'path';
export const PROGRESS_TYPES: readonly ProgressType[] = ['mini', 'doku', 'sweep', 'path'];

/** `noodle-app-progress-mini` and so on: one slot per type, holding the latest round. */
export const progressKey = (type: ProgressType) => `noodle-app-progress-${type}`;

/**
 * `noodle-app-rounds-mini` and so on (22 Nov 2026): every part-played puzzle's round of the
 * type, `{id: round}`, so starting another puzzle never replaces one. The slot above still
 * holds the latest, as before.
 */
export const roundsKey = (type: ProgressType) => `noodle-app-rounds-${type}`;

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
 * (`site`, `digi-<type>-v1`) and, for the four grid types, its parsed rounds (`rounds`,
 * `noodle-app-rounds-<type>`) and old one-round slot (`slot`). Every puzzle keeps its own
 * round (22 Nov 2026): its own first, then the old slot or `cur` if that is this puzzle's.
 */
export function roundOf(
  type: PuzzleType,
  id: string,
  site: unknown,
  slot: unknown,
  rounds: unknown = null,
): Round | null {
  if (obj(site) && obj(site.done) && site.done[id]) return null; // finished
  if (isProgressType(type)) {
    const own = obj(rounds) && obj(rounds[id]) ? rounds[id] : slot;
    if (!obj(own) || own.id !== id || !Array.isArray(own.moves) || !own.moves.length) return null;
    const secs = typeof own.secs === 'number' && Number.isFinite(own.secs) ? own.secs : NaN;
    const time = clock(Math.floor(secs));
    return time ? { time } : {};
  }
  if (type === 'tangle') {
    const d = obj(site) && obj(site.days) ? site.days[id] : null;
    if (!obj(d) || (d.state !== 'playing' && d.state !== 'suspended')) return null;
    const time = typeof d.left === 'number' ? clock(Math.ceil(Math.max(0, d.left))) : '';
    return time ? { time: `${time} left` } : {};
  }
  if (type === 'borders' || type === 'reckon') return roundFor(site, id) ? {} : null;
  if (type === 'link' || type === 'tally') {
    // engines/link.js round: {id, f, m, g, tr, l, s: seconds played, at}; tally.js: {id, g, notes, s, at}
    const cur = roundFor(site, id);
    if (!cur) return null;
    const time = typeof cur.s === 'number' ? clock(Math.floor(cur.s)) : '';
    return time ? { time } : {};
  }
  return null;
}

/** True when `x` looks like a puzzle's published data file (reports/<file>.json). */
export function isPuzzleData(x: unknown): boolean {
  const f = x as { id?: unknown; path?: unknown; data?: unknown } | null;
  return (
    !!f &&
    typeof f === 'object' &&
    typeof f.id === 'string' &&
    typeof f.path === 'string' &&
    !!f.data &&
    typeof f.data === 'object'
  );
}

/** True when `raw` (a `noodle-app-puzzle:<file>` value) is a kept puzzle. */
export const isKept = (raw: string | null): boolean => !!raw && raw.startsWith('{');
