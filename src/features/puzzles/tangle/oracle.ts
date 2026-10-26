/**
 * Deterministic move lists for a Tangle, for the differential replay
 * (scripts/replay-tangle.js) and the model's tests. Moves are what a phone player
 * does: tap the home card, trace through tiles with one finger (`trace` lists the
 * tiles the finger passes through, in order, so a tile listed again is a slide back),
 * tap single tiles, go back to the home card mid-round, leave the page, and wait.
 * `ms` is the time that passes after a move; every value is a whole number of 100 ms
 * (but after leaving) and the page is first touched 1250 ms after it loads, so no move
 * ever lands on the page's 100 ms tick (whose order against a move the replay could not
 * otherwise know).
 *
 * - words: tools/tests/play.js tangle({n: 26}): the 26 shortest common words other
 *   than the star, then the clock runs out. A fresh save.
 * - mixed: the star word, a rarer word, the same word twice, a two-letter trace, a path
 *   that is no word, a word entered by taps, a tap back to an earlier letter, a slide
 *   back, a tap that starts afresh; on the puzzle's own day with a live streak.
 * - resume: back to the home card mid-round (the clock holds), Resume and its count-in,
 *   then the page left mid-round and reopened, Resume again; a lapsed streak.
 * - midnight: the round straddles London midnight, so it is filed under the next day
 *   and its streak does not move (Tangle counts only on the puzzle's own day).
 * - archive: played three days late from the archive, beside other Tangles' saves.
 */
import { dayBefore, londonDay } from '@noodle/core';

import { NB, ROUND, type TangleData } from './model';

export type Variant = 'words' | 'mixed' | 'resume' | 'midnight' | 'archive';
export const VARIANTS: readonly Variant[] = ['words', 'mixed', 'resume', 'midnight', 'archive'];

export type OracleMove =
  | { t: 'play' }
  | { t: 'trace'; tiles: number[] }
  | { t: 'tap'; i: number }
  | { t: 'home' }
  | { t: 'leave' }
  | { t: 'wait' };

export interface Step {
  move: OracleMove;
  ms: number;
}

export interface Scenario {
  variant: Variant;
  steps: Step[];
  /** The instant the page opens. */
  open: number;
  seed: Record<string, unknown>;
  reopen: boolean;
}

/** The page's first touch after it loads (and after it is reopened). */
export const LOAD_MS = 1250;

/** The engine's findPath: the first trace of `w` it finds, or null. */
export function findPath(data: TangleData, w: string): number[] | null {
  const low = data.tiles.map((t) => t.toLowerCase());
  const go = (i: number, pos: number, used: number): number[] | null => {
    if (!w.startsWith(low[i]!, pos)) return null;
    const p2 = pos + low[i]!.length;
    if (p2 === w.length) return [i];
    for (const j of NB[i]!)
      if (!((used >> j) & 1)) {
        const r = go(j, p2, used | (1 << j));
        if (r) return [i].concat(r);
      }
    return null;
  };
  for (let i = 0; i < 16; i++) {
    const r = go(i, 0, 1 << i);
    if (r) return r;
  }
  return null;
}

/** play.js tangle(): the n shortest common words, the star left out. */
export function shortest(data: TangleData, n: number): string[] {
  return data.main
    .filter((w) => w !== data.star)
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, n);
}

class Steps {
  steps: Step[] = [];
  do(move: OracleMove, ms: number) {
    this.steps.push({ move, ms });
  }
  word(data: TangleData, w: string, ms = 1300) {
    const p = findPath(data, w);
    if (!p) throw new Error(`oracle: no path for ${w} in ${data.id}`);
    this.do({ t: 'trace', tiles: p }, ms);
  }
  /** Play (or Resume) and its 3-2-1. */
  start(ms = 3500) {
    this.do({ t: 'play' }, ms);
  }
}

/** A path of three or more tiles that is no word on the list. */
function nonWord(data: TangleData): number[] {
  const low = data.tiles.map((t) => t.toLowerCase());
  const all = new Set(data.main.concat(data.bonus));
  for (let a = 0; a < 16; a++)
    for (const b of NB[a]!)
      for (const c of NB[b]!) {
        if (c === a) continue;
        const w = low[a]! + low[b]! + low[c]!;
        if (w.length >= 3 && !all.has(w)) return [a, b, c];
      }
  throw new Error(`oracle: every three-tile path is a word in ${data.id}`);
}

/** Two touching tiles, neither of them Qu: a trace too short to be a word. */
function twoTiles(data: TangleData): number[] {
  for (let a = 0; a < 16; a++)
    for (const b of NB[a]!) if (data.tiles[a] !== 'QU' && data.tiles[b] !== 'QU') return [a, b];
  throw new Error(`oracle: no two plain tiles touch in ${data.id}`);
}

function words(s: Steps, data: TangleData) {
  s.start();
  for (const w of shortest(data, 26)) s.word(data, w, 1200);
  s.do({ t: 'wait' }, (ROUND + 5) * 1000);
}

function mixed(s: Steps, data: TangleData) {
  s.start();
  s.do({ t: 'trace', tiles: data.starPath }, 1500);
  const bonus = data.bonus.find((w) => findPath(data, w));
  if (bonus) s.word(data, bonus);
  const ws = shortest(data, 60);
  s.word(data, ws[0]!, 900);
  s.word(data, ws[0]!, 1200); // Already found
  s.do({ t: 'trace', tiles: twoTiles(data) }, 800); // Too short
  s.do({ t: 'trace', tiles: nonWord(data) }, 1200); // Not in today's list
  // a word by taps: each letter, then the last one again to enter it
  const tw = findPath(data, ws[2]!)!;
  for (const i of tw) s.do({ t: 'tap', i }, 400);
  s.do({ t: 'tap', i: tw[tw.length - 1]! }, 1200);
  // taps that step back to an earlier letter, then finish the word
  const bw = findPath(data, ws[3]!)!;
  for (const i of bw) s.do({ t: 'tap', i }, 300);
  s.do({ t: 'tap', i: bw[0]! }, 500);
  for (const i of bw.slice(1)) s.do({ t: 'tap', i }, 300);
  s.do({ t: 'tap', i: bw[bw.length - 1]! }, 1300);
  // a slide back: over one tile too many and back again
  const sw = findPath(data, ws[4]!)!;
  const lastT = sw[sw.length - 1]!;
  const extra = NB[lastT]!.find((j) => !sw.includes(j));
  s.do({ t: 'trace', tiles: extra === undefined ? sw : [...sw, extra, lastT] }, 1300);
  // a tap on a tile not touching the last one starts a new word there
  const fw = findPath(data, ws[5]!)!;
  s.do({ t: 'tap', i: fw[0]! }, 300);
  const far = [...Array(16).keys()].find((j) => j !== fw[0] && !NB[fw[0]!]!.includes(j))!;
  s.do({ t: 'tap', i: far }, 400);
  s.word(data, ws[5]!, 1200);
  for (const w of ws.slice(6, 12)) s.word(data, w, 1400);
  s.do({ t: 'wait' }, ROUND * 1000);
}

function resume(s: Steps, data: TangleData) {
  const ws = shortest(data, 40);
  s.start();
  for (const w of ws.slice(0, 5)) s.word(data, w, 1500);
  s.do({ t: 'wait' }, 6300);
  s.do({ t: 'home' }, 20_000); // the clock holds while the home card shows
  s.start(3900); // Resume, 3-2-1
  for (const w of ws.slice(5, 9)) s.word(data, w, 1600);
  // Leaving reloads the page, which starts its tick afresh from that instant: the next
  // move comes 50 ms off that tick, like every other.
  s.do({ t: 'leave' }, 30_050);
  s.start(3600);
  for (const w of ws.slice(9, 14)) s.word(data, w, 1400);
  s.do({ t: 'wait' }, ROUND * 1000);
}

function midnight(s: Steps, data: TangleData) {
  s.start();
  for (const w of shortest(data, 12)) s.word(data, w, 2100);
  s.do({ t: 'wait' }, ROUND * 1000);
}

function archive(s: Steps, data: TangleData) {
  s.start();
  s.do({ t: 'trace', tiles: data.starPath }, 1800);
  for (const w of shortest(data, 10)) s.word(data, w, 1700);
  s.do({ t: 'wait' }, ROUND * 1000);
}

export function moves(data: TangleData, variant: Variant): Step[] {
  const s = new Steps();
  ({ words, mixed, resume, midnight, archive })[variant](s, data);
  return s.steps;
}

const days = (day: string, n: number) => {
  let d = day;
  for (let i = 0; i < n; i++) d = dayBefore(d);
  return d;
};
const after = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Two other days' Tangle ids for the seeded saves, never `id` itself. */
export function otherIds(id: string): [string, string] {
  const ids = ['DP·TANG·0001', 'DP·TANG·0002', 'DP·TANG·0003'].filter((x) => x !== id);
  return [ids[0]!, ids[1]!];
}

/** A variant with when the page opens and the saves it begins from. */
export function scenario(data: TangleData, variant: Variant): Scenario {
  const date = data.date;
  const steps = moves(data, variant);
  const morning = (d: string) => Date.parse(`${d}T08:15:00Z`);
  // "Some other day's" saves: two Tangles that are never the one under test (Tangle 1
  // and 2 have data files since 26 Oct 2026, so the page can be one of them).
  const [doneId, playingId] = otherIds(data.id);
  const other = {
    v: 1,
    days: {
      [doneId]: { state: 'done', found: ['ago', 'air'], left: 0, score: 2 },
      [playingId]: { state: 'playing', found: ['fig'], left: 41.3, score: 1 },
    },
    done: { [doneId]: { o: 'played', s: 2, w: 2, st: false, d: days(date, 30) } },
    streak: { last: null as string | null, n: 0, best: 4 },
    best: 31,
    snd: false,
    rm: null,
    fs: false,
  };
  switch (variant) {
    case 'words':
      return { variant, steps, open: morning(date), seed: {}, reopen: true };
    case 'mixed':
      return {
        variant,
        steps,
        open: morning(date),
        seed: { 'digi-tangle-v1': { ...other, streak: { last: days(date, 1), n: 3, best: 4 } } },
        reopen: true,
      };
    case 'resume':
      return {
        variant,
        steps,
        open: morning(date),
        seed: { 'digi-tangle-v1': { ...other, streak: { last: days(date, 5), n: 6, best: 6 } } },
        reopen: false,
      };
    case 'midnight': {
      // Midnight falls in the middle of the round's 90 seconds.
      let m = Date.parse(`${date}T21:00:00Z`);
      while (londonDay(m) === date) m += 60_000;
      return {
        variant,
        steps,
        open: m - 60_000 - LOAD_MS,
        seed: { 'digi-tangle-v1': { ...other, streak: { last: days(date, 1), n: 2, best: 5 } } },
        reopen: true,
      };
    }
    case 'archive':
      return {
        variant,
        steps,
        open: morning(after(date, 3)),
        seed: { 'digi-tangle-v1': { ...other, streak: { last: after(date, 2), n: 9, best: 9 } } },
        reopen: true,
      };
  }
}
