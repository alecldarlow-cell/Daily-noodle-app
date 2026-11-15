/**
 * Deterministic move lists for a Tumbler, for the differential replay (scripts/replay.js) and
 * the model's tests. The same list drives the web page's real controls (the wheels' down
 * arrows and Submit) and the native model. `ms` is the time that passes after a move.
 *
 * - solve: turn each wheel to the hidden word's letter, submit.
 * - tries: a submit with nothing turned, a non-word, a real word's clues, the same word
 *   again, then the hidden word.
 * - turns: a wheel turned all the way round (it wraps), a long think, a word, then solve.
 * - resume: a part-played board kept in `cur` (turned wheels and one word), played on.
 */
import { dayBefore, londonDay } from '@noodle/core';

import {
  apply,
  init,
  letter,
  lineWord,
  READ,
  type Move,
  type TumblerData,
  type TumblerState,
} from './model';

export type Variant = 'solve' | 'tries' | 'turns' | 'resume';
export const VARIANTS: readonly Variant[] = ['solve', 'tries', 'turns', 'resume'];

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
  state: TumblerState;
  steps: Step[] = [];
  constructor(
    data: TumblerData,
    private rand: () => number,
    start?: TumblerState,
  ) {
    this.state = start ?? init(data);
  }
  do(move: Move, ms = Math.round(250 + this.rand() * 1050)) {
    if (this.state.solved) return;
    this.state = apply(this.state, move);
    this.steps.push({ move, ms });
  }
  /** Turn every wheel until `word` is on the yellow line. */
  make(word: string) {
    const { p } = this.state;
    for (let k = 0; k < p.n; k++)
      for (
        let n = 0;
        n < this.state.size && letter(this.state, k, READ) !== word[k]!.toUpperCase();
        n++
      )
        this.do({ t: 'turn', k });
  }
  submit(ms?: number) {
    this.do({ t: 'submit' }, ms);
  }
}

/** A line the wheels can make that isn't a word, or null. */
export function nonWord(data: TumblerData): string | null {
  const words = new Set(data.words);
  const [a, b, c, d] = data.wheels;
  if (data.n !== 4 || !a || !b || !c || !d) return null;
  for (const w of a)
    for (const x of b)
      for (const y of c)
        for (const z of d) {
          const s = (w + x + y + z).toLowerCase();
          if (!words.has(s)) return s;
        }
  return null;
}

/** A real word other than the hidden one, picked by the seed. */
function otherWord(data: TumblerData, rand: () => number): string {
  const others = data.words.filter((w) => w !== data.secret);
  return others[Math.floor(rand() * others.length)] ?? data.secret;
}

function solve(pl: Player) {
  pl.make(pl.state.p.secret);
  pl.submit();
}

function tries(pl: Player, rand: () => number) {
  const { p } = pl.state;
  if (lineWord(pl.state) !== p.secret) pl.submit(); // whatever the line says before a turn
  const nw = nonWord(p);
  if (nw) {
    pl.make(nw);
    pl.submit();
  }
  const w = otherWord(p, rand);
  pl.make(w);
  pl.submit();
  pl.submit(); // the same word again
  solve(pl);
}

function turns(pl: Player, rand: () => number) {
  const { p } = pl.state;
  for (let n = 0; n < pl.state.size; n++) pl.do({ t: 'turn', k: 2 }); // round and back
  pl.do({ t: 'turn', k: 0 }, 45_000); // a long think
  pl.make(otherWord(p, rand));
  pl.submit();
  solve(pl);
}

/** A part-played board: wheels 1 and 3 turned, and one word submitted. */
export function kept(data: TumblerData): { o: number[]; w: string[]; t: number } {
  const P = data.wheels[0]!.length;
  const o = data.wheels.map((_, k) => (k === 0 ? P - 2 : k === 2 ? P - 1 : 0));
  const w = data.words.filter((x) => x !== data.secret).slice(0, 1);
  return { o, w, t: 3 };
}

/** The moves of one variant. Every list ends with the board solved. */
export function moves(data: TumblerData, variant: Variant): Step[] {
  const rand = rng(data.id, variant);
  const base = init(data);
  const k = kept(data);
  const pl = new Player(
    data,
    rand,
    variant === 'resume' ? { ...base, off: k.o, tries: k.w, turns: k.t } : base,
  );
  if (variant === 'tries') tries(pl, rand);
  else if (variant === 'turns') turns(pl, rand);
  else solve(pl);
  if (!pl.state.solved) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  pl.steps[pl.steps.length - 1]!.ms = 1800;
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
export function scenario(data: TumblerData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const done = { 'DP·TUMB·9001': { t: '1:41', s: 101, n: 3, w: ['abcd'], d: days(date, 30) } };
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
          'digi-tumbler-v1': { v: 1, done },
          'digi-tumbler-streak': streak(date, 4, 6, true),
        },
        reopen: false,
      };
    case 'turns':
      // a streak with a day's gap, from before the London stamp: it starts again
      return {
        variant,
        steps,
        start: 'morning',
        seed: { 'digi-tumbler-streak': streak(days(date, 2), 2, 2, false) },
        reopen: true,
      };
    case 'resume':
      // a kept board at 0:42; a streak that lapsed days ago
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-tumbler-v1': {
            v: 1,
            done,
            cur: { id: data.id, ...kept(data), s: 42, at: Date.parse(`${date}T07:00:00Z`) },
          },
          'digi-tumbler-streak': streak(days(date, 5), 7, 9, true),
        },
        reopen: true,
      };
  }
}
