/**
 * Deterministic move lists for a Doku, for the differential replay
 * (scripts/replay-doku.js) and the model's tests. Each variant plays the puzzle to the
 * end through moves a phone player makes; the same list drives the web page's real
 * controls and the native model. `ms` is the time that passes after a move (the
 * replay's fake clock). Letters are typed only while the phone's keyboard is up (after
 * a tap on an empty square), as on a phone.
 *
 * - solve: tile, then square, for every open square in turn (the spec's primary path).
 * - typed: tap a square and type; delete on an empty square (which starts the clock), a
 *   wrong tile typed and deleted back, a letter the bank doesn't hold, the space bar, a
 *   long pause; crosses London midnight.
 * - fullwrong: a full grid with two letters swapped (tools/tests/run.js doku:full-wrong),
 *   the note with Hints on and off, both letters tapped back to the bank, then placed right;
 *   a tile chosen, changed and put down again first.
 * - hints: Hints off from the start; squares in a shuffled order, a wrong tile tapped back,
 *   a given square tapped, a chosen tile dropped on a full square (which sends that
 *   letter back and keeps the tile), Hints on again halfway, some typing.
 * - seed: a Doku with results but no digi-doku-streak yet; down words typed.
 */
import { dayBefore, londonDay } from '@noodle/core';

import {
  apply,
  fillables,
  init,
  isLock,
  letterAt,
  wordAt,
  type DokuData,
  type DokuState,
  type Move,
} from './model';

export type Variant = 'solve' | 'typed' | 'fullwrong' | 'hints' | 'seed';
export const VARIANTS: readonly Variant[] = ['solve', 'typed', 'fullwrong', 'hints', 'seed'];

export interface Step {
  move: Move;
  ms: number;
}

/** Where the replay starts the clock, and what the player's saves hold beforehand. */
export interface Scenario {
  variant: Variant;
  steps: Step[];
  /** 'morning': 09:15 (BST) or 08:15 (GMT) on the puzzle's day; 'midnight': play straddles its end. */
  start: 'morning' | 'midnight';
  /** Saves present before the page opens (key → document). */
  seed: Record<string, unknown>;
  /** Reload after the finish and check the reopened sheet. */
  reopen: boolean;
}

/** A small seeded generator (mulberry32, as the engine uses) keyed by the puzzle id. */
function rng(id: string, salt: string): () => number {
  let a = 0;
  for (const ch of id + salt) a = (Math.imul(a, 31) + ch.codePointAt(0)!) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Sq = readonly [number, number];

/** Builds a move list while tracking the model, so each move is chosen from the real state. */
class Player {
  state: DokuState;
  steps: Step[] = [];
  constructor(
    data: DokuData,
    private rand: () => number,
  ) {
    this.state = init(data);
  }
  gap(lo: number, hi: number) {
    return Math.round(lo + this.rand() * (hi - lo));
  }
  do(move: Move, ms = this.gap(250, 1200)) {
    this.state = apply(this.state, move);
    this.steps.push({ move, ms });
  }
  get p() {
    return this.state.p;
  }
  get solved() {
    return this.state.solved;
  }
  /** The open squares (not given), in reading order. */
  get open(): Sq[] {
    return fillables(this.p.grid).filter(([r, c]) => !isLock(this.p, r, c));
  }
  answer(r: number, c: number) {
    return this.p.grid[r]![c]!;
  }
  shown(r: number, c: number) {
    return letterAt(this.state, r, c);
  }
  right(r: number, c: number) {
    return this.shown(r, c) === this.answer(r, c);
  }
  freeTile(ch: string) {
    return this.state.tiles.find((t) => !t.at && t.ch === ch);
  }
  /** A free tile with a different letter, if the bank has one. */
  otherTile(ch: string) {
    return this.state.tiles.find((t) => !t.at && t.ch !== ch);
  }
  /** Tile, then square. */
  put(r: number, c: number, ch = this.answer(r, c)) {
    const t = this.freeTile(ch);
    if (!t || this.solved) return false;
    this.do({ t: 'tile', id: t.id }, this.gap(200, 700));
    this.do({ t: 'cell', r, c });
    return true;
  }
  /** Bring the keyboard up on an empty open square (tapping it, or a first one). */
  keyboard() {
    const { sel } = this.state;
    const empty = (r: number, c: number) => !isLock(this.p, r, c) && !this.state.entries[r]![c];
    if (this.state.kbd && empty(sel.r, sel.c)) return true;
    const sq = empty(sel.r, sel.c) ? [sel.r, sel.c] : this.open.find(([r, c]) => empty(r, c));
    if (!sq) return false;
    this.do({ t: 'cell', r: sq[0]!, c: sq[1]! }, this.gap(150, 500));
    return this.state.kbd;
  }
  /** Type the right letter at the cursor, `n` times (or until the grid is full). */
  typeRight(n: number) {
    for (let i = 0; i < n && !this.solved; i++) {
      if (!this.keyboard()) return;
      const { sel } = this.state;
      this.do({ t: 'key', ch: this.answer(sel.r, sel.c).toLowerCase() });
    }
  }
  /** Finish: send every wrong letter back, then fill every empty square, tile then square. */
  sweep() {
    for (const [r, c] of this.open) {
      if (this.solved) return;
      if (this.shown(r, c) && !this.right(r, c)) this.do({ t: 'cell', r, c }, this.gap(200, 600));
    }
    for (const [r, c] of this.open) {
      if (this.solved) return;
      if (!this.shown(r, c)) this.put(r, c);
    }
  }
}

function solve(pl: Player) {
  for (const [r, c] of pl.open) if (!pl.put(r, c)) break;
}

function typed(pl: Player) {
  if (!pl.keyboard()) return;
  pl.do({ t: 'del' }, pl.gap(800, 2200)); // nothing to delete, but the clock starts
  pl.typeRight(2);
  // a wrong tile, typed, then deleted back: the cursor has moved on, so delete walks back
  if (!pl.solved && pl.keyboard()) {
    const { sel } = pl.state;
    const other = pl.otherTile(pl.answer(sel.r, sel.c));
    if (other) {
      pl.do({ t: 'key', ch: other.ch.toLowerCase() });
      pl.do({ t: 'del' });
      if (!pl.solved && pl.keyboard()) pl.do({ t: 'del' }, pl.gap(200, 500));
    }
  }
  // a letter the bank doesn't hold: the square shakes, nothing moves
  if (!pl.solved && pl.keyboard()) {
    const held = new Set(pl.state.tiles.filter((t) => !t.at).map((t) => t.ch));
    const none = 'QZXJKVWYFBGHMPUCDLNRSTOAEI'.split('').find((ch) => !held.has(ch));
    if (none) pl.do({ t: 'key', ch: none.toLowerCase() });
  }
  if (!pl.solved && pl.keyboard()) {
    pl.do({ t: 'space' });
    pl.do({ t: 'space' }, pl.gap(30_000, 95_000)); // a long think
  }
  pl.typeRight(Math.ceil(pl.open.length / 2));
  pl.sweep();
}

function fullwrong(pl: Player) {
  const cells = pl.open;
  const want = cells.map(([r, c]) => pl.answer(r, c));
  const j = want.findIndex((ch) => ch !== want[0]);
  if (j > 0) [want[0], want[j]] = [want[j]!, want[0]!];
  // choose a tile, change your mind, put it down again
  const t0 = pl.state.tiles[0]!;
  const t1 = pl.state.tiles.find((t) => t.ch !== t0.ch) ?? pl.state.tiles[1];
  pl.do({ t: 'tile', id: t0.id }, 400);
  if (t1) pl.do({ t: 'tile', id: t1.id }, 400);
  pl.do({ t: 'tile', id: (t1 ?? t0).id }, 600);
  cells.forEach(([r, c], k) => {
    if (!pl.solved) pl.put(r, c, want[k]);
  });
  if (!pl.solved && j > 0) {
    pl.do({ t: 'hints' }, pl.gap(1500, 3000));
    pl.do({ t: 'hints' }, pl.gap(800, 2000));
    for (const k of [0, j]) {
      const [r, c] = cells[k]!;
      pl.do({ t: 'cell', r, c }, pl.gap(300, 900));
    }
  }
  pl.sweep();
}

function hints(pl: Player) {
  pl.do({ t: 'hints' }, pl.gap(500, 1500));
  const order = pl.open.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const k = pl.gap(0, i);
    [order[i], order[k]] = [order[k]!, order[i]!];
  }
  const half = Math.floor(order.length / 2);
  order.forEach(([r, c], i) => {
    if (pl.solved) return;
    if (i === 1) {
      // a wrong tile, then tapped back to the bank
      const other = pl.otherTile(pl.answer(r, c));
      if (other && pl.put(r, c, other.ch) && !pl.solved) pl.do({ t: 'cell', r, c });
    }
    if (i === 2) {
      const lock = fillables(pl.p.grid).find(([y, x]) => isLock(pl.p, y, x));
      if (lock) pl.do({ t: 'cell', r: lock[0], c: lock[1] });
    }
    if (i === 3) {
      // a chosen tile dropped on a full square sends that letter back; the tile stays chosen
      const full = order.slice(0, 3).find(([y, x]) => pl.shown(y, x));
      const t = pl.freeTile(pl.answer(r, c));
      if (full && t) {
        pl.do({ t: 'tile', id: t.id });
        pl.do({ t: 'cell', r: full[0], c: full[1] });
        pl.do({ t: 'cell', r, c });
      }
    }
    if (i === half && !pl.solved) pl.do({ t: 'hints' });
    if (i === half + 1 && !pl.solved) {
      pl.typeRight(2);
      return;
    }
    if (!pl.solved && !pl.shown(r, c)) pl.put(r, c);
  });
  pl.sweep();
}

function seed(pl: Player) {
  // down words: tap an empty square that has one, twice if it lands across
  const down = pl.open.find(([r, c]) => wordAt(pl.p, r, c, 'D') && !pl.shown(r, c));
  if (down) {
    pl.do({ t: 'cell', r: down[0], c: down[1] });
    if (pl.state.sel.dir !== 'D') pl.do({ t: 'cell', r: down[0], c: down[1] });
  }
  pl.typeRight(pl.open.length);
  pl.sweep();
}

const PLAY: Record<Variant, (pl: Player) => void> = { solve, typed, fullwrong, hints, seed };

/** The moves of one variant for a puzzle. Every list ends with the puzzle solved. */
export function moves(data: DokuData, variant: Variant): Step[] {
  const pl = new Player(data, rng(data.id, variant));
  PLAY[variant](pl);
  if (!pl.solved) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  const last = pl.steps[pl.steps.length - 1]!;
  last.ms = 4000; // the finish sheet rises 1.45 s after the last tile
  return pl.steps;
}

/**
 * The instant the page opens. `leadMs` is the time between opening and the first move
 * (load, then Play). A 'midnight' scenario is timed so London midnight falls halfway
 * through its moves, so the finish is filed under the next day.
 */
export function startAt(sc: Scenario, date: string, leadMs: number): number {
  if (sc.start === 'morning') return Date.parse(`${date}T08:15:00Z`);
  let m = Date.parse(`${date}T21:00:00Z`);
  while (londonDay(m) === date) m += 60_000;
  const playing = sc.steps.slice(0, -1).reduce((n, s) => n + s.ms, 0);
  return m - leadMs - Math.floor(playing / 2);
}

const days = (day: string, n: number) => {
  let d = day;
  for (let i = 0; i < n; i++) d = dayBefore(d);
  return d;
};
const run = (last: string, n: number) => Array.from({ length: n }, (_, i) => days(last, n - 1 - i));

/** A variant with its start time and the saves it begins from. `date` is the puzzle's day. */
export function scenario(data: DokuData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const otherDoku = { v: 1, done: { 'DP·LEXI·9001': { s: 75, d: days(date, 30) } } };
  switch (variant) {
    case 'solve':
      return { variant, steps, start: 'morning', seed: {}, reopen: true };
    case 'typed':
      // Finishes just after midnight, so the streak continues from the puzzle's own day.
      return {
        variant,
        steps,
        start: 'midnight',
        seed: {
          'digi-doku-v1': otherDoku,
          'digi-doku-streak': { last: date, streak: 4, best: 6, dates: run(date, 4), tz: 'L' },
        },
        reopen: false,
      };
    case 'fullwrong':
      // A streak saved before 18 Oct 2026 (no tz): one extra day of gap is allowed.
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-doku-streak': {
            last: days(date, 2),
            streak: 2,
            best: 2,
            dates: run(days(date, 2), 2),
          },
        },
        reopen: false,
      };
    case 'hints':
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-doku-v1': otherDoku,
          'digi-doku-streak': {
            last: days(date, 5),
            streak: 7,
            best: 9,
            dates: run(days(date, 5), 7),
            tz: 'L',
          },
        },
        reopen: true,
      };
    case 'seed':
      // Results from the three days before, but no Doku streak yet: the page rebuilds it.
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-doku-v1': {
            v: 1,
            done: {
              'DP·LEXI·9001': { s: 75, d: days(date, 3) },
              'DP·LEXI·9002': { s: 64, d: days(date, 2) },
              'DP·LEXI·9003': { s: 80, d: days(date, 1) },
            },
          },
          'digi-mini-streak': {
            last: days(date, 1),
            streak: 5,
            best: 5,
            dates: run(days(date, 1), 5),
            tz: 'L',
          },
        },
        reopen: true,
      };
  }
}
