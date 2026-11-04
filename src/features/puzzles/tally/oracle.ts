/**
 * Deterministic move lists for a Tally, for the differential replay (scripts/replay.js) and
 * the model's tests. The same list drives the web page's real controls and the native
 * model. `ms` is the time that passes after a move (the replay's fake clock).
 *
 * - solve: every square in order, tap then its number (tools/tests/play.js tally).
 * - notes: a number with no square chosen, notes on, off and over a placed number, placed
 *   numbers clearing their row's and column's notes, a number tapped twice.
 * - undo: wrong numbers that repeat in a row and break a cage, Erase, Undo, a long think.
 * - resume: a part-played board kept in `cur`, played on from there.
 */
import { dayBefore, londonDay } from '@noodle/core';

import { apply, init, type Move, type TallyData, type TallyState } from './model';

export type Variant = 'solve' | 'notes' | 'undo' | 'resume';
export const VARIANTS: readonly Variant[] = ['solve', 'notes', 'undo', 'resume'];

export interface Step {
  move: Move;
  ms: number;
}

export interface Scenario {
  variant: Variant;
  steps: Step[];
  start: 'morning' | 'midnight';
  seed: Record<string, unknown>;
  reopen: boolean;
}

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

class Player {
  state: TallyState;
  steps: Step[] = [];
  constructor(
    data: TallyData,
    private rand: () => number,
    start?: TallyState,
  ) {
    this.state = start ?? init(data);
  }
  do(move: Move, ms = Math.round(250 + this.rand() * 1050)) {
    // Once the board is solved the sheet covers it: nothing more is pressed.
    if (this.state.solved) return;
    this.state = apply(this.state, move);
    this.steps.push({ move, ms });
  }
  /** Tap a square and enter a number. */
  put(i: number, d: number) {
    this.do({ t: 'cell', i });
    this.do({ t: 'digit', d });
  }
  undo(ms?: number) {
    if (this.state.undo.length) this.do({ t: 'undo' }, ms); // the button is disabled otherwise
  }
  /** Every square's right number, skipping those already right. */
  finish() {
    const { p, n } = this.state;
    if (this.state.notesMode) this.do({ t: 'notes' });
    for (let i = 0; i < n * n && !this.state.solved; i++) {
      const want = +p.sol[i]!;
      if (this.state.g[i] !== want) this.put(i, want);
    }
  }
}

function solve(pl: Player) {
  pl.finish();
}

function notes(pl: Player) {
  const { p } = pl.state;
  pl.do({ t: 'digit', d: 2 }); // no square chosen yet
  pl.do({ t: 'erase' }); // nor here
  pl.do({ t: 'cell', i: 5 });
  pl.do({ t: 'notes' });
  for (const d of [1, 2, 3, 4]) pl.do({ t: 'digit', d });
  pl.do({ t: 'digit', d: 3 }); // off again
  pl.do({ t: 'cell', i: 6 });
  for (const d of [1, 2]) pl.do({ t: 'digit', d });
  pl.do({ t: 'notes' });
  pl.put(4, +p.sol[4]!); // clears that note along its row and column
  pl.do({ t: 'digit', d: +p.sol[4]! }); // the same number again takes it out
  pl.do({ t: 'digit', d: +p.sol[4]! });
  pl.do({ t: 'notes' });
  pl.do({ t: 'digit', d: 1 }); // a note over a placed number empties the square
  pl.do({ t: 'notes' });
  pl.do({ t: 'erase' });
  pl.finish();
}

function undo(pl: Player) {
  const { p, n } = pl.state;
  // the same number twice in the top row, then a column
  const a = +p.sol[0]!;
  pl.put(0, a);
  pl.put(1, a);
  pl.put(n, a);
  pl.undo();
  pl.undo();
  pl.do({ t: 'cell', i: 1 });
  pl.do({ t: 'erase' });
  pl.undo();
  pl.do({ t: 'erase' }, 45_000); // a long think
  // a whole cage filled wrong, so its clue goes red, then back
  const cg = p.cages.find((c) => c.c.length >= 2 && !c.c.includes(0)) ?? p.cages[0]!;
  for (const i of cg.c) pl.put(i, (+p.sol[i]! % n) + 1);
  cg.c.forEach(() => pl.undo());
  pl.do({ t: 'cell', i: cg.c[0]! });
  pl.finish();
}

const PLAY: Record<Variant, (pl: Player) => void> = { solve, notes, undo, resume: solve };

/** A part-played board: three right numbers and a note. */
function kept(data: TallyData) {
  const start = init(data);
  const g = start.g.slice();
  for (const i of [2, 7, 9]) g[i] = +data.sol[i]!;
  const notes = start.notes.slice();
  notes[0] = 1 << 2;
  return { g, notes };
}

/** The moves of one variant. Every list ends with the board solved. */
export function moves(data: TallyData, variant: Variant): Step[] {
  const base = init(data);
  const pl = new Player(
    data,
    rng(data.id, variant),
    variant === 'resume' ? { ...base, ...kept(data) } : base,
  );
  PLAY[variant](pl);
  if (!pl.state.solved) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  pl.steps[pl.steps.length - 1]!.ms = 1500;
  return pl.steps;
}

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
export function scenario(data: TallyData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const done = { 'DP·TALLY·9001': { t: '2:41', s: 161, d: days(date, 30) } };
  const streak = (last: string, n: number, best: number, tz: boolean) => ({
    last,
    streak: n,
    best,
    dates: run(last, n),
    ...(tz ? { tz: 'L' } : {}),
  });
  switch (variant) {
    case 'solve':
      return { variant, steps, start: 'morning', seed: {}, reopen: true };
    case 'notes':
      // finishes just after midnight: the streak goes on from the puzzle's own day
      return {
        variant,
        steps,
        start: 'midnight',
        seed: {
          'digi-tally-v1': { v: 1, done },
          'digi-tally-streak': streak(date, 4, 6, true),
        },
        reopen: false,
      };
    case 'undo':
      // a streak with a day's gap, from before the London stamp: it starts again
      return {
        variant,
        steps,
        start: 'morning',
        seed: { 'digi-tally-streak': streak(days(date, 2), 2, 2, false) },
        reopen: true,
      };
    case 'resume':
      // a kept round at 0:42; a streak that lapsed days ago
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-tally-v1': {
            v: 1,
            done,
            cur: { id: data.id, ...kept(data), s: 42, at: Date.parse(`${date}T07:00:00Z`) },
          },
          'digi-tally-streak': streak(days(date, 5), 7, 9, true),
        },
        reopen: true,
      };
  }
}
