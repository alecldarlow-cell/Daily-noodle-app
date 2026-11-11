/**
 * Deterministic move lists for a Redact, for the differential replay (scripts/replay.js) and
 * the model's tests. The same list drives the web page's real controls and the native model.
 * `ms` is the time that passes after a move (the replay's fake clock).
 *
 * - solve: the answer's squares in a shuffled order.
 * - wrong: a wrong square at the full count (the board says why), Undo, one too many, a
 *   square tapped twice, Clear, Undo, a long think, then the answer.
 * - midnight: solved just after midnight, on a streak from the puzzle's own day.
 * - resume: a part-played board kept in `cur`, played on from there.
 */
import { dayBefore, londonDay } from '@noodle/core';

import { apply, init, type Move, type RedactData, type RedactState } from './model';

export type Variant = 'solve' | 'wrong' | 'midnight' | 'resume';
export const VARIANTS: readonly Variant[] = ['solve', 'wrong', 'midnight', 'resume'];

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

/** The last move's wait: past the win beat (~1.7 s on 7×7), so the sheet is up. */
export const LAST_MS = 2500;

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
  state: RedactState;
  steps: Step[] = [];
  constructor(
    data: RedactData,
    private rand: () => number,
    start?: RedactState,
  ) {
    this.state = start ?? init(data);
  }
  do(move: Move, ms = Math.round(250 + this.rand() * 1050)) {
    if (this.state.solved) return;
    // Undo and Clear are disabled with nothing to do: never pressed then.
    if (move.t === 'undo' && !this.state.hist.length) return;
    if (move.t === 'clear' && !this.state.black.length) return;
    this.state = apply(this.state, move);
    this.steps.push({ move, ms });
  }
  tap(i: number, ms?: number) {
    this.do({ t: 'cell', i }, ms);
  }
  shuffled(list: readonly number[]) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
  /** Take out every wrong square, then black out the rest of the answer. */
  finish() {
    const want = new Set(this.state.p.black);
    for (const i of this.state.black.filter((x) => !want.has(x))) this.tap(i);
    for (const i of this.shuffled(this.state.p.black))
      if (!this.state.black.includes(i)) this.tap(i);
  }
}

function wrongSquares(p: RedactData): number[] {
  const want = new Set(p.black);
  return Array.from({ length: p.n * p.n }, (_, i) => i).filter((i) => !want.has(i));
}

function solve(pl: Player) {
  pl.finish();
}

function wrong(pl: Player) {
  const p = pl.state.p;
  const off = wrongSquares(p);
  const a = p.black;
  // all but one of the answer, then a wrong square: the full count, and why it isn't right
  for (const i of a.slice(0, -1)) pl.tap(i);
  pl.tap(off[0]!);
  pl.do({ t: 'undo' });
  // one too many
  pl.tap(off[1]!);
  pl.tap(off[2]!);
  pl.do({ t: 'undo' });
  pl.do({ t: 'undo' });
  // a square tapped twice comes back
  pl.tap(a[0]!);
  pl.tap(a[0]!);
  pl.do({ t: 'clear' });
  pl.do({ t: 'undo' }, 45_000); // a long think
  // a different wrong square at the full count
  pl.tap(off[off.length - 1]!);
  pl.finish();
}

const PLAY: Record<Variant, (pl: Player) => void> = {
  solve,
  wrong,
  midnight: solve,
  resume: solve,
};

/** A part-played board: a third of the answer and one wrong square, two misses so far. */
export function kept(data: RedactData) {
  const third = data.black.slice(0, Math.max(1, Math.floor(data.black.length / 3)));
  return { b: [...third, wrongSquares(data)[0]!], t: third.length + 4, m: 2 };
}

/** The moves of one variant. Every list ends with the board solved. */
export function moves(data: RedactData, variant: Variant): Step[] {
  const base = init(data);
  const k = kept(data);
  const pl = new Player(
    data,
    rng(data.id, variant),
    variant === 'resume' ? { ...base, black: k.b, taps: k.t, misses: k.m } : base,
  );
  PLAY[variant](pl);
  if (!pl.state.solved) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  pl.steps[pl.steps.length - 1]!.ms = LAST_MS;
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
export function scenario(data: RedactData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const done = { 'DP·REDA·9001': { t: '2:41', s: 161, m: 1, d: days(date, 30) } };
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
    case 'wrong':
      // a streak with a day's gap, from before the London stamp: it starts again
      return {
        variant,
        steps,
        start: 'morning',
        seed: { 'digi-redact-streak': streak(days(date, 2), 2, 2, false) },
        reopen: true,
      };
    case 'midnight':
      // finishes just after midnight: the streak goes on from the puzzle's own day
      return {
        variant,
        steps,
        start: 'midnight',
        seed: {
          'digi-redact-v1': { v: 1, done },
          'digi-redact-streak': streak(date, 4, 6, true),
        },
        reopen: false,
      };
    case 'resume':
      // a kept board at 0:42; a streak that lapsed days ago
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-redact-v1': {
            v: 1,
            done,
            cur: { id: data.id, ...kept(data), s: 42, at: Date.parse(`${date}T07:00:00Z`) },
          },
          'digi-redact-streak': streak(days(date, 5), 7, 9, true),
        },
        reopen: true,
      };
  }
}
