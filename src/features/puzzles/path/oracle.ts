/**
 * Deterministic move lists for a Path, for the differential replay (scripts/replay.js)
 * and the model's tests. The same list drives the web page's real controls and the
 * native model. `ms` is the time that passes after a move (the replay's fake clock).
 *
 * - solve: tap 1, then 2 to 35 in order (tools/tests/play.js path).
 * - ends: both ends in turn, the 36 counting down and the 1 up, meeting in the middle,
 *   with each kind of refused tap along the way.
 * - hints: Hint until neither end is forced, then one true step, and again; a tap
 *   onto a given elsewhere and one that would strand a number.
 * - undo: a wrong turn three squares long, taken back with Undo, then on to the end
 *   with a Hint and an Undo of a checkpoint.
 */
import { dayBefore, londonDay } from '@noodle/core';

import {
  apply,
  init,
  N,
  neighbors,
  TOTAL,
  type Cell,
  type Move,
  type PathData,
  type PathState,
} from './model';

export type Variant = 'solve' | 'ends' | 'hints' | 'undo';
export const VARIANTS: readonly Variant[] = ['solve', 'ends', 'hints', 'undo'];

export interface Step {
  move: Move;
  ms: number;
}

export interface Scenario {
  variant: Variant;
  steps: Step[];
  /** 'morning': 08:15 UTC on the puzzle's day; 'midnight': play straddles its end. */
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
  state: PathState;
  steps: Step[] = [];
  at: Cell[] = [];
  constructor(
    data: PathData,
    private rand: () => number,
  ) {
    this.state = init(data);
    data.solution.forEach((row, r) => row.forEach((v, c) => (this.at[v] = [r, c])));
  }
  gap(lo: number, hi: number) {
    return Math.round(lo + this.rand() * (hi - lo));
  }
  do(move: Move, ms = this.gap(250, 1300)) {
    // Once the thread is complete the sheet covers the board: nothing more is pressed.
    if (this.solved) return;
    this.state = apply(this.state, move);
    this.steps.push({ move, ms });
  }
  get solved() {
    return this.state.solved;
  }
  tap([r, c]: Cell, ms?: number) {
    this.do({ t: 'cell', r, c }, ms);
  }
  /** Make `end` the active one by tapping its first square, if it isn't already. */
  choose(end: 'low' | 'high') {
    if (this.state.activeEnd !== end) this.tap(this.at[end === 'low' ? 1 : TOTAL]!);
  }
  /** One true step at the active end. */
  step() {
    const s = this.state;
    const v = s.activeEnd === 'low' ? s.lowHead + 1 : s.highHead - 1;
    this.tap(this.at[v]!);
  }
  /** An empty square next to the active end that the rules accept but the answer doesn't. */
  wrongTurn(): Cell | null {
    const s = this.state;
    const head = s.activeEnd === 'low' ? s.lowCell : s.highCell;
    const v = s.activeEnd === 'low' ? s.lowHead + 1 : s.highHead - 1;
    for (const [r, c] of neighbors(head[0], head[1])) {
      if (s.cellValue[r]![c] !== null || s.p.solution[r]![c] === v) continue;
      const next = apply(s, { t: 'cell', r, c });
      if (next.cellValue[r]![c] === v) return [r, c];
    }
    return null;
  }
  /** A square two away from the active end (refused: not next to it). */
  farSquare(): Cell {
    const s = this.state;
    const head = s.activeEnd === 'low' ? s.lowCell : s.highCell;
    const r = head[0] >= 2 ? head[0] - 2 : head[0] + 2;
    return [r, head[1]];
  }
  /** One true step from the low end (when Hint can't help). */
  finishStep() {
    if (this.solved) return;
    this.choose('low');
    if (!this.solved) this.step();
  }
  /** Whether both threads still follow the answer. */
  onTrack() {
    const s = this.state;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const v = s.cellValue[r]![c];
        if (v !== null && v !== s.p.solution[r]![c]) return false;
      }
    return true;
  }
  /** Play the rest from the low end (back onto the answer with Undo first, if need be). */
  finish() {
    for (let k = 0; k < 40 && !this.onTrack(); k++) this.do({ t: 'undo' });
    this.choose('low');
    for (let k = 0; k < 80 && !this.solved; k++) this.step();
  }
}

function solve(pl: Player) {
  pl.tap(pl.at[1]!, 700);
  for (let k = 2; k <= 35 && !pl.solved; k++) pl.tap(pl.at[k]!, 700);
}

function ends(pl: Player) {
  pl.choose('high');
  pl.tap(pl.farSquare()); // not next to the active end
  let low = false;
  for (let round = 0; round < 40 && !pl.solved; round++) {
    pl.choose(low ? 'low' : 'high');
    const n = pl.gap(3, 7);
    for (let k = 0; k < n && !pl.solved; k++) {
      const s = pl.state;
      if (s.lowHead + 1 > s.highHead - 1) break;
      pl.step();
    }
    if (round === 1 && !pl.solved) {
      // a square already on the thread, and a given that isn't next
      const s = pl.state;
      const head = s.activeEnd === 'low' ? s.lowCell : s.highCell;
      const on = neighbors(head[0], head[1]).find(([r, c]) => {
        const v = s.cellValue[r]![c];
        return v !== null && !s.p.lockedSet.has(`${r},${c}`);
      });
      if (on) pl.tap(on);
      const given = neighbors(head[0], head[1]).find(([r, c]) => {
        const v = s.cellValue[r]![c];
        const want = s.activeEnd === 'low' ? s.lowHead + 1 : s.highHead - 1;
        return s.p.lockedSet.has(`${r},${c}`) && v !== want && !s.p.endKeys.has(`${r},${c}`);
      });
      if (given) pl.tap(given);
    }
    if (round === 3 && !pl.solved) pl.do({ t: 'hint' }, pl.gap(20_000, 60_000)); // a long think
    low = !low;
  }
  pl.finish();
}

function hints(pl: Player) {
  for (let k = 0; k < 90 && !pl.solved; k++) {
    const before = pl.state;
    pl.do({ t: 'hint' }, pl.gap(600, 2000));
    if (sameValues(pl.state, before)) {
      if (k % 4 === 1) refusals(pl);
      pl.finishStep();
    }
  }
  pl.finish();
}

function sameValues(a: PathState, b: PathState) {
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) if (a.cellValue[r]![c] !== b.cellValue[r]![c]) return false;
  return true;
}

/** Refused taps the rules name: onto a given elsewhere, or one that strands a number. */
function refusals(pl: Player) {
  const s = pl.state;
  const low = s.activeEnd === 'low';
  const head = low ? s.lowCell : s.highCell;
  const v = low ? s.lowHead + 1 : s.highHead - 1;
  const empty = neighbors(head[0], head[1]).filter(([r, c]) => s.cellValue[r]![c] === null);
  const refused = empty.find(
    ([r, c]) => s.p.solution[r]![c] !== v && sameValues(apply(s, { t: 'cell', r, c }), s),
  );
  if (refused) pl.tap(refused);
}

function undo(pl: Player) {
  pl.do({ t: 'undo' }); // nothing to take back yet
  pl.tap(pl.at[1]!);
  for (let k = 2; k <= 6 && !pl.solved; k++) pl.step();
  // a wrong turn, three squares long if the rules allow, then back
  let wrong = 0;
  for (let k = 0; k < 3; k++) {
    const w = pl.wrongTurn();
    if (!w) break;
    pl.tap(w);
    wrong++;
  }
  for (let k = 0; k < wrong; k++) pl.do({ t: 'undo' }, pl.gap(300, 900));
  pl.do({ t: 'hint' });
  // on to a checkpoint, through it, back and through again
  for (let k = 0; k < 40 && !pl.solved; k++) {
    const s = pl.state;
    const next = pl.at[s.lowHead + 1]!;
    const isGiven = s.p.lockedSet.has(`${next[0]},${next[1]}`) && s.lowHead + 1 < TOTAL;
    pl.step();
    if (isGiven && !pl.solved) {
      pl.do({ t: 'undo' });
      pl.step();
      break;
    }
  }
  pl.choose('high');
  for (let k = 0; k < 4 && !pl.solved; k++) pl.step();
  pl.do({ t: 'undo' });
  pl.finish();
}

const PLAY: Record<Variant, (pl: Player) => void> = { solve, ends, hints, undo };

/** The moves of one variant. Every list ends with the thread complete. */
export function moves(data: PathData, variant: Variant): Step[] {
  const pl = new Player(data, rng(data.id, variant));
  PLAY[variant](pl);
  if (!pl.solved) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  pl.steps[pl.steps.length - 1]!.ms = 3000; // the sheet rises 0.9 s after the last square
  return pl.steps;
}

/**
 * The instant the page opens. `leadMs` is the time between opening and the first move
 * (load, then Play). In a 'midnight' scenario London midnight falls halfway through.
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
export function scenario(data: PathData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const other = { v: 1, done: { 'DP·PATH·0001': { t: '2:41', d: days(date, 30) } } };
  switch (variant) {
    case 'solve':
      return { variant, steps, start: 'morning', seed: {}, reopen: true };
    case 'ends':
      // finishes just after midnight: the streak goes on from the puzzle's own day
      return {
        variant,
        steps,
        start: 'midnight',
        seed: {
          'digi-path-v1': other,
          'digi-path-streak': { last: date, streak: 4, best: 6, dates: run(date, 4), tz: 'L' },
        },
        reopen: false,
      };
    case 'hints':
      // a streak saved before 18 Oct 2026 with a day's gap: Path allows no grace day
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-path-streak': {
            last: days(date, 2),
            streak: 2,
            best: 2,
            dates: run(days(date, 2), 2),
          },
        },
        reopen: true,
      };
    case 'undo':
      // a streak that lapsed days ago: the bar shows none, and it starts again at one
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-path-v1': other,
          'digi-path-streak': {
            last: days(date, 5),
            streak: 7,
            best: 9,
            dates: run(days(date, 5), 7),
            tz: 'L',
          },
        },
        reopen: true,
      };
  }
}
