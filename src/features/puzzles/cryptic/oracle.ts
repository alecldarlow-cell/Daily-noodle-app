/**
 * Deterministic move lists for a Cryptic, for the differential replay (scripts/replay.js) and
 * the model's tests. The same list drives the web page's real controls (the on-screen keys,
 * Enter, Delete, Hint, Clear and the squares) and the native model. `ms` is the time that
 * passes after a move.
 *
 * - solve: type the answer, Enter.
 * - tries: Enter too early, a wrong answer (shakes), Delete, a square tapped and retyped,
 *   Clear, then the answer; finishes just after midnight.
 * - hints: the definition, the clue type, two letters revealed, the rest typed, Enter.
 * - reveal: every letter revealed (no fail state: the clue finishes itself).
 * - resume: a part-played clue kept in `cur` (one hint, two letters), played on.
 */
import { dayBefore, londonDay } from '@noodle/core';

import { apply, init, type CrypticData, type CrypticState, type Move } from './model';

export type Variant = 'solve' | 'tries' | 'hints' | 'reveal' | 'resume';
export const VARIANTS: readonly Variant[] = ['solve', 'tries', 'hints', 'reveal', 'resume'];

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
  state: CrypticState;
  steps: Step[] = [];
  constructor(
    data: CrypticData,
    private rand: () => number,
    start?: CrypticState,
  ) {
    this.state = start ?? init(data);
  }
  do(move: Move, ms = Math.round(250 + this.rand() * 1050)) {
    if (this.state.solved) return;
    this.state = apply(this.state, move);
    this.steps.push({ move, ms });
  }
  type(w: string) {
    for (const ch of w) this.do({ t: 'type', ch });
  }
  /** Fill the open squares with the answer's letters, from the cursor on. */
  fill() {
    const A = this.state.sol.a;
    for (let n = 0; n < A.length && this.state.letters.some((x, i) => x !== A[i]); n++)
      this.do({ t: 'type', ch: A[this.state.cur]! });
  }
}

/** The answer with its last letter changed: a wrong guess of the right length. */
const wrong = (a: string) => a.slice(0, -1) + (a.endsWith('E') ? 'S' : 'E');

/** The moves of one variant. Every list ends with the clue solved. */
export function moves(data: CrypticData, variant: Variant): Step[] {
  const rand = rng(data.id, variant);
  const base = init(data);
  const A = base.sol.a;
  const pl = new Player(
    data,
    rand,
    variant === 'resume'
      ? {
          ...base,
          hints: 1,
          letters: kept(data).letters,
          cur: 2,
          msg: 'Carrying on where you left off.',
        }
      : base,
  );
  if (variant === 'solve') {
    pl.type(A);
    pl.do({ t: 'enter' });
  } else if (variant === 'tries') {
    pl.type(A.slice(0, 2));
    pl.do({ t: 'enter' }); // too early
    pl.type(wrong(A).slice(2));
    pl.do({ t: 'enter' }, 45_000); // wrong: shakes; a long think
    pl.do({ t: 'del' });
    pl.do({ t: 'select', i: 1 });
    pl.do({ t: 'type', ch: 'Q' });
    pl.do({ t: 'clear' });
    pl.type(A);
    pl.do({ t: 'enter' });
  } else if (variant === 'hints') {
    pl.do({ t: 'hint' });
    pl.do({ t: 'hint' });
    pl.do({ t: 'hint' });
    pl.do({ t: 'hint' });
    pl.fill();
    pl.do({ t: 'enter' });
  } else if (variant === 'reveal') {
    for (let k = 0; k < A.length + 2; k++) pl.do({ t: 'hint' });
  } else {
    pl.fill();
    pl.do({ t: 'enter' });
  }
  if (!pl.state.solved) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  pl.steps[pl.steps.length - 1]!.ms = 1800;
  return pl.steps;
}

/** A part-played clue: one hint taken, the answer's first two letters typed. */
export function kept(data: CrypticData): { letters: string[]; hints: number } {
  const A = init(data).sol.a;
  return { letters: A.split('').map((ch, i) => (i < 2 ? ch : '')), hints: 1 };
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
export function scenario(data: CrypticData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const done = { 'DP·CRYP·9001': { t: '1:41', s: 101, h: 2, d: days(date, 30) } };
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
    case 'tries':
      // finishes just after midnight: the streak goes on from the puzzle's own day
      return {
        variant,
        steps,
        start: 'midnight',
        seed: {
          'digi-cryptic-v1': { v: 1, done },
          'digi-cryptic-streak': streak(date, 4, 6, true),
        },
        reopen: false,
      };
    case 'hints':
      // a streak with a day's gap, from before the London stamp: it starts again
      return {
        variant,
        steps,
        start: 'morning',
        seed: { 'digi-cryptic-streak': streak(days(date, 2), 2, 2, false) },
        reopen: true,
      };
    case 'reveal':
      return { variant, steps, start: 'morning', seed: {}, reopen: true };
    case 'resume':
      // a kept clue at 0:42; a streak that lapsed days ago
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-cryptic-v1': {
            v: 1,
            done,
            cur: { id: data.id, ...kept(data), s: 42, at: Date.parse(`${date}T07:00:00Z`) },
          },
          'digi-cryptic-streak': streak(days(date, 5), 7, 9, true),
        },
        reopen: true,
      };
  }
}
