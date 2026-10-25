/**
 * Deterministic move lists for a Sweep, for the differential replay (scripts/replay.js)
 * and the model's tests. The same list drives the web page's real controls and the
 * native model. `ms` is the time that passes after a move (the replay's fake clock;
 * a long press also holds for PRESS_HOLD_MS before it).
 *
 * - solve: dig the start, then every safe square in turn (tools/tests/play.js sweep).
 * - boom: a Hint, then a mine (play.js sweep {boom}); Play again (not recorded) and a
 *   replay won with flags (run.js finish:sweep-boom goes on to Play again).
 * - hint: solved by Hint alone, flagging what it calls a mine (play.js sweepByHint).
 * - wrongflag: a long-press flag on a square the numbers prove safe, then by Hint, which
 *   names it (run.js sweep:hint (a)).
 * - unproved: a flag on a square the numbers can't decide yet, then by Hint, which must
 *   ignore it (run.js sweep:hint (b)).
 * - flags: Flag mode; too many flags round a number (crossed out), every mine flagged,
 *   one safe square flagged so all 36 are called (the nudge), then fixed.
 */
import { dayBefore, londonDay } from '@noodle/core';

import {
  apply,
  CELLS,
  init,
  NB,
  provable,
  type Move,
  type SweepData,
  type SweepState,
} from './model';

export type Variant = 'solve' | 'boom' | 'hint' | 'wrongflag' | 'unproved' | 'flags';
export const VARIANTS: readonly Variant[] = [
  'solve',
  'boom',
  'hint',
  'wrongflag',
  'unproved',
  'flags',
];

/** A long press is held this long on the replay's clock (the page flags at 350 ms). */
export const PRESS_HOLD_MS = 400;

export interface Step {
  move: Move;
  ms: number;
}

export interface Scenario {
  variant: Variant;
  steps: Step[];
  /** 'morning': 08:15 UTC on the puzzle's day; 'midnight': play straddles its end. */
  start: 'morning' | 'midnight';
  /** Saves present before the page opens (key → document). */
  seed: Record<string, unknown>;
  /** Reload after the finish and check the reopened sheet. */
  reopen: boolean;
}

/** mulberry32 keyed by the puzzle id, as the Mini's oracle. */
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
  state: SweepState;
  steps: Step[] = [];
  constructor(
    data: SweepData,
    private rand: () => number,
  ) {
    this.state = init(data, { ranked: true });
  }
  gap(lo: number, hi: number) {
    return Math.round(lo + this.rand() * (hi - lo));
  }
  do(move: Move, ms = this.gap(300, 1500)) {
    // Once a round ends the sheet covers the board: only its Play again is pressed.
    if (this.state.over && !(move.t === 'again' && !this.state.won)) return;
    this.state = apply(this.state, move, { ranked: false });
    this.steps.push({ move, ms });
  }
  get p() {
    return this.state.p;
  }
  get over() {
    return this.state.over;
  }
  hidden(i: number) {
    const s = this.state;
    return !s.revealed.has(i) && !s.flagged.has(i) && !s.boomed.has(i);
  }
  mine(i: number) {
    return this.p.MS.has(i);
  }
  setMode(flag: boolean) {
    if (this.state.flagMode !== flag) this.do({ t: 'mode', flag }, this.gap(150, 400));
  }
  digStart() {
    this.do({ t: 'tap', i: this.p.start }, this.gap(900, 1600));
  }
  /** Dig every safe square still hidden, in board order. */
  digRest(skip = -1) {
    this.setMode(false);
    for (let i = 0; i < CELLS && !this.over; i++)
      if (i !== skip && !this.mine(i) && this.hidden(i)) this.do({ t: 'tap', i });
  }
  /** Flag square i in Flag mode, back to Dig. */
  flagByMode(i: number) {
    this.setMode(true);
    this.do({ t: 'tap', i }, this.gap(150, 500));
    this.setMode(false);
  }
  /** Press Hint, then dig or flag the square it marks, until the board is done. */
  byHint() {
    for (let k = 0; k < 60 && !this.over; k++) {
      this.do({ t: 'hint' }, this.gap(500, 2600));
      const m = this.state.mark;
      if (!m) break;
      // a mine is flagged; a flag Hint calls wrong comes off; a safe square is dug
      if (this.mine(m.i) || this.state.flagged.has(m.i)) this.flagByMode(m.i);
      else this.do({ t: 'tap', i: m.i });
    }
    this.digRest();
  }
}

function solve(pl: Player) {
  pl.digStart();
  pl.digRest();
}

function boom(pl: Player) {
  pl.digStart();
  pl.do({ t: 'hint' });
  pl.do({ t: 'tap', i: pl.p.mines[0]! }, 3000);
  pl.do({ t: 'again' }, 800);
  // the replay: two mines flagged by long press, one in Flag mode, the rest dug
  pl.digStart();
  const [a, b, c] = pl.p.mines.filter((i) => pl.hidden(i));
  if (a !== undefined) pl.do({ t: 'press', i: a });
  if (b !== undefined) pl.do({ t: 'press', i: b });
  if (c !== undefined) pl.flagByMode(c);
  pl.digRest();
}

function hint(pl: Player) {
  pl.digStart();
  pl.byHint();
}

function wrongflag(pl: Player) {
  pl.digStart();
  const { S } = provable(pl.state);
  const x = [...S].find((i) => pl.hidden(i));
  if (x !== undefined) pl.do({ t: 'press', i: x });
  pl.byHint();
}

function unproved(pl: Player) {
  pl.digStart();
  const { K, S } = provable(pl.state);
  const open = (i: number) => pl.state.revealed.has(i) && pl.p.NUM[i]! > 0;
  const undecided = [...Array(CELLS).keys()].filter((i) => pl.hidden(i) && !K.has(i) && !S.has(i));
  const x = undecided.find((i) => NB[i]!.some(open)) ?? undecided[0];
  if (x !== undefined) pl.flagByMode(x);
  pl.byHint();
}

function flags(pl: Player) {
  pl.digStart();
  // too many flags round one number: it is crossed out; then they come off
  const crowded = [...pl.state.revealed].find((i) => {
    const n = pl.p.NUM[i]!;
    return n > 0 && NB[i]!.filter((j) => pl.hidden(j)).length > n;
  });
  pl.setMode(true);
  if (crowded !== undefined) {
    const around = NB[crowded]!.filter((j) => pl.hidden(j)).slice(0, pl.p.NUM[crowded]! + 1);
    for (const j of around) pl.do({ t: 'tap', i: j }, pl.gap(200, 600));
    for (const j of around) pl.do({ t: 'tap', i: j }, pl.gap(200, 600));
  }
  for (const m of pl.p.mines) if (pl.hidden(m)) pl.do({ t: 'tap', i: m }, pl.gap(200, 700));
  pl.setMode(false);
  // dig every safe square but the last, flag that one: all 36 called, not swept
  const safes = () => [...Array(CELLS).keys()].filter((i) => !pl.mine(i) && pl.hidden(i));
  while (safes().length > 1 && !pl.over) pl.do({ t: 'tap', i: safes()[0]! });
  const last = safes()[0];
  if (last !== undefined && !pl.over) {
    pl.do({ t: 'press', i: last }, pl.gap(2000, 5000));
    pl.do({ t: 'press', i: last });
    pl.do({ t: 'tap', i: last });
  }
  pl.digRest();
}

const PLAY: Record<Variant, (pl: Player) => void> = {
  solve,
  boom,
  hint,
  wrongflag,
  unproved,
  flags,
};

/** The moves of one variant. Every list ends with the board finished (won, but boom's first round). */
export function moves(data: SweepData, variant: Variant): Step[] {
  const pl = new Player(data, rng(data.id, variant));
  PLAY[variant](pl);
  if (!pl.state.won) throw new Error(`oracle: ${variant} did not sweep ${data.id}`);
  pl.steps[pl.steps.length - 1]!.ms = 4000; // the sheet rises 1.45 s after the last square
  return pl.steps;
}

/** The time a move takes before its `ms` (a long press is held). */
export const holdOf = (m: Move) => (m.t === 'press' ? PRESS_HOLD_MS : 0);

/**
 * The instant the page opens. `leadMs` is the time between opening and the first move.
 * In a 'midnight' scenario London midnight falls halfway through the moves.
 */
export function startAt(sc: Scenario, date: string, leadMs: number): number {
  if (sc.start === 'morning') return Date.parse(`${date}T08:15:00Z`);
  let m = Date.parse(`${date}T21:00:00Z`);
  while (londonDay(m) === date) m += 60_000;
  const playing = sc.steps.slice(0, -1).reduce((n, s) => n + s.ms + holdOf(s.move), 0);
  return m - leadMs - Math.floor(playing / 2);
}

const days = (day: string, n: number) => {
  let d = day;
  for (let i = 0; i < n; i++) d = dayBefore(d);
  return d;
};
const run = (last: string, n: number) => Array.from({ length: n }, (_, i) => days(last, n - 1 - i));

/** A variant with its start time and the saves it begins from. `date` is the puzzle's day. */
export function scenario(data: SweepData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const other = {
    v: 1,
    done: { 'DP·SWEEP·2026-07-01': { o: 'win', s: 141, d: days(date, 30) } },
  };
  const streak = (last: string, n: number, best: number, tz = true) => ({
    last,
    streak: n,
    best,
    dates: run(last, n),
    ...(tz ? { tz: 'L' } : {}),
  });
  switch (variant) {
    case 'solve':
      return { variant, steps, start: 'morning', seed: {}, reopen: true };
    case 'boom':
      // a live streak, ended by the mine; the replay that follows records nothing
      return {
        variant,
        steps,
        start: 'morning',
        seed: { 'digi-sweep-v1': other, 'digi-sweep-streak': streak(days(date, 1), 4, 6) },
        reopen: true,
      };
    case 'hint':
      // a streak saved before 18 Oct 2026 (no tz): one extra day of gap is allowed
      return {
        variant,
        steps,
        start: 'morning',
        seed: { 'digi-sweep-streak': streak(days(date, 2), 2, 2, false) },
        reopen: false,
      };
    case 'wrongflag':
      return {
        variant,
        steps,
        start: 'morning',
        seed: { 'digi-sweep-v1': other, 'digi-sweep-streak': streak(days(date, 5), 7, 9) },
        reopen: true,
      };
    case 'unproved':
      // today's result is already in: a replay that records nothing, across midnight
      return {
        variant,
        steps,
        start: 'midnight',
        seed: { 'digi-sweep-v1': other, 'digi-sweep-streak': streak(date, 3, 5) },
        reopen: false,
      };
    case 'flags':
      // a live streak from yesterday, finished after midnight: a day missed
      return {
        variant,
        steps,
        start: 'midnight',
        seed: { 'digi-sweep-streak': streak(days(date, 1), 4, 4) },
        reopen: true,
      };
  }
}
