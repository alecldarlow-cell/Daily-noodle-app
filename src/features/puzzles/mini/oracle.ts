/**
 * Deterministic move lists for a Mini, for the differential replay (scripts/replay.js)
 * and the model's tests. Each variant plays the puzzle to the end through moves a
 * player makes; the same list drives the web page's real controls and the native
 * model. `ms` is the time that passes after a move (the replay's fake clock).
 *
 * - solve: tap every open square in turn and type its letter (tools/tests/play.js grid).
 * - words: word by word with › and ‹, a wrong letter fixed by deleting back, Check
 *   word, Check all, clue-bar taps and a long pause; crosses London midnight.
 * - reveal: Reveal word, a mistake caught by Check word, then the rest square by square.
 * - checks: every third letter wrong, Check all, fixes, Check word and Reveal word.
 */
import { dayBefore, londonDay } from '@noodle/core';

import {
  allCells,
  apply,
  init,
  orderedSlots,
  wordAt,
  type Dir,
  type MiniData,
  type MiniState,
  type Move,
  type Slot,
} from './model';

export type Variant = 'solve' | 'words' | 'reveal' | 'checks';
export const VARIANTS: readonly Variant[] = ['solve', 'words', 'reveal', 'checks'];

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

/** Builds a move list while tracking the model, so each move is chosen from the real state. */
class Player {
  state: MiniState;
  steps: Step[] = [];
  constructor(
    data: MiniData,
    private rand: () => number,
  ) {
    this.state = init(data);
  }
  gap(lo: number, hi: number) {
    return Math.round(lo + this.rand() * (hi - lo));
  }
  do(move: Move, ms = this.gap(250, 1400)) {
    this.state = apply(this.state, move);
    this.steps.push({ move, ms });
  }
  get p() {
    return this.state.p;
  }
  get solved() {
    return this.state.solved;
  }
  letter(r: number, c: number) {
    return this.p.grid[r]![c]!;
  }
  wrong(r: number, c: number) {
    const ch = this.letter(r, c).charCodeAt(0) - 65;
    return String.fromCharCode(65 + ((ch + 1 + Math.floor(this.rand() * 24)) % 26));
  }
  correct(r: number, c: number) {
    return this.state.entries[r]![c] === this.letter(r, c);
  }
  /** Put the cursor on (r, c) facing `dir` by tapping squares, as a player would. */
  tapTo(r: number, c: number, dir: Dir) {
    for (let k = 0; k < 3; k++) {
      const { sel } = this.state;
      if (sel.r === r && sel.c === c && sel.dir === dir) return;
      this.do({ t: 'cell', r, c }, this.gap(150, 500));
    }
  }
  /** Type the rest of the current word from the cursor, optionally one wrong letter at `bad`. */
  typeRest(w: Slot, bad = -1) {
    const { sel } = this.state;
    let i = w.cells.findIndex(([y, x]) => y === sel.r && x === sel.c);
    for (; i >= 0 && i < w.cells.length && !this.solved; i++) {
      const [r, c] = w.cells[i]!;
      this.do({ t: 'key', ch: i === bad ? this.wrong(r, c) : this.letter(r, c) });
    }
  }
  /** Fill every square still wrong, square by square. */
  sweep() {
    for (const [r, c] of allCells(this.p)) {
      if (this.solved) return;
      if (this.correct(r, c)) continue;
      const { sel } = this.state;
      if (sel.r !== r || sel.c !== c) this.do({ t: 'cell', r, c }, this.gap(150, 400));
      this.do({ t: 'key', ch: this.letter(r, c) });
    }
  }
}

function solve(pl: Player) {
  // tools/tests/play.js grid(): tap each open square, then type its letter.
  for (const [r, c] of allCells(pl.p)) {
    if (pl.solved) break;
    pl.do({ t: 'cell', r, c }, 200);
    pl.do({ t: 'key', ch: pl.letter(r, c) }, pl.gap(400, 1600));
  }
}

const activeWord = (pl: Player) => wordAt(pl.p, pl.state.sel.r, pl.state.sel.c, pl.state.sel.dir);

/** Step with › (or ‹) until `w` is the clue; the step lands on its first empty square. */
function stepTo(pl: Player, w: Slot, delta: 1 | -1 = 1) {
  for (let n = 0; n <= pl.p.slots.length && activeWord(pl) !== w; n++)
    pl.do({ t: 'step', delta }, pl.gap(200, 600));
}

function words(pl: Player) {
  pl.do({ t: 'step', delta: 1 });
  pl.do({ t: 'step', delta: -1 });
  const list = orderedSlots(pl.p);
  list.forEach((w, k) => {
    if (pl.solved || w.cells.every(([r, c]) => pl.correct(r, c))) return;
    stepTo(pl, w, k % 3 === 2 ? -1 : 1);
    if (k === 0) {
      // a mistake at the second letter: Check word, then delete back to it and retype
      pl.typeRest(w, 1);
      if (pl.solved) return;
      pl.do({ t: 'checkWord' });
      for (let i = 0; i < w.L - 1; i++) pl.do({ t: 'del' }, pl.gap(150, 450));
      pl.typeRest(w);
      return;
    }
    pl.typeRest(w);
    if (k === 1 && !pl.solved) {
      pl.do({ t: 'bar' });
      pl.do({ t: 'bar' }, pl.gap(30_000, 95_000)); // a long think
    }
    if (k === 2 && !pl.solved) pl.do({ t: 'checkAll' });
  });
  pl.sweep();
}

function reveal(pl: Player) {
  const list = orderedSlots(pl.p);
  pl.typeRest(list[0]!);
  const second = list[1];
  if (second && !pl.solved) {
    stepTo(pl, second);
    pl.do({ t: 'revealWord' });
  }
  const down = list.find((w) => w.t === 'D' && w.cells.some(([r, c]) => !pl.correct(r, c)));
  if (down && !pl.solved) {
    const [r, c] = down.cells.find(([y, x]) => !pl.correct(y, x))!;
    pl.tapTo(r, c, 'D');
    pl.do({ t: 'key', ch: pl.wrong(r, c) });
    pl.tapTo(r, c, 'D');
    pl.do({ t: 'checkWord' });
    pl.do({ t: 'key', ch: pl.letter(r, c) });
  }
  pl.sweep();
}

function checks(pl: Player) {
  // Every square in turn, every third one wrong; Check all; fix what it marks; then
  // Check word and Reveal word on the last word still wrong, and a final Check all.
  allCells(pl.p).forEach(([r, c], i) => {
    if (pl.solved) return;
    pl.do({ t: 'cell', r, c }, pl.gap(150, 400));
    pl.do({ t: 'key', ch: i % 3 === 1 ? pl.wrong(r, c) : pl.letter(r, c) });
  });
  if (!pl.solved) pl.do({ t: 'checkAll' });
  const bad = allCells(pl.p).filter(([r, c]) => !pl.correct(r, c));
  const last = bad.pop();
  for (const [r, c] of bad) {
    if (pl.solved) break;
    pl.do({ t: 'cell', r, c }, pl.gap(150, 400));
    pl.do({ t: 'key', ch: pl.letter(r, c) });
  }
  if (last && !pl.solved) {
    const [r, c] = last;
    pl.do({ t: 'cell', r, c });
    pl.do({ t: 'checkWord' });
    pl.do({ t: 'revealWord' });
  }
  if (!pl.solved) pl.do({ t: 'checkAll' });
  pl.sweep();
}

const PLAY: Record<Variant, (pl: Player) => void> = { solve, words, reveal, checks };

/** The moves of one variant for a puzzle. Every list ends with the puzzle solved. */
export function moves(data: MiniData, variant: Variant): Step[] {
  const pl = new Player(data, rng(data.id, variant));
  PLAY[variant](pl);
  if (!pl.solved) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  const last = pl.steps[pl.steps.length - 1]!;
  last.ms = 4000; // the finish sheet rises 1.45 s after the last letter
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
export function scenario(data: MiniData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const otherMini = { v: 1, done: { 'DP·MINI·0001': { s: 75, d: days(date, 30) } } };
  switch (variant) {
    case 'solve':
      return { variant, steps, start: 'morning', seed: {}, reopen: true };
    case 'words':
      // Finishes just after midnight, so the streak continues from the puzzle's own day.
      return {
        variant,
        steps,
        start: 'midnight',
        seed: {
          'digi-mini-v1': otherMini,
          'digi-mini-streak': { last: date, streak: 4, best: 6, dates: run(date, 4), tz: 'L' },
        },
        reopen: false,
      };
    case 'reveal':
      // A streak saved before 18 Oct 2026 (no tz): one extra day of gap is allowed.
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-mini-streak': {
            last: days(date, 2),
            streak: 2,
            best: 2,
            dates: run(days(date, 2), 2),
          },
        },
        reopen: false,
      };
    case 'checks':
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-mini-v1': otherMini,
          'digi-mini-streak': {
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
