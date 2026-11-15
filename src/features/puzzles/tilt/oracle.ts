/**
 * Deterministic move lists for a Tilt maze, for the differential replay (scripts/replay.js)
 * and the model's tests. The same list drives the web page's real buttons and the native
 * model. `ms` is the time that passes after a move (the replay's fake clock): always longer
 * than the page's turn, roll and exit, so every board is read at rest.
 *
 * - solve: the shortest way out, turn by turn (the engine's own route).
 * - detour: a turn that moves nothing, wrong turns taken back with Undo, wrong turns kept and
 *   worked back from, a long think; starts at midnight, with a live streak.
 * - resume: a part-turned maze kept in `cur` (from a few turns along the route), played on.
 */
import { dayBefore, londonDay } from '@noodle/core';

import {
  apply,
  init,
  OUT_MS,
  rollMs,
  slide,
  TURN_MS,
  type Move,
  type TiltData,
  type TiltState,
} from './model';

export type Variant = 'solve' | 'detour' | 'resume';
export const VARIANTS: readonly Variant[] = ['solve', 'detour', 'resume'];

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

/** The turns of the shortest way out from any state (its square and gravity). */
export function route(state: TiltState): (1 | -1)[] {
  return bfs(state);
}

/** Breadth-first over (square, gravity) from any state: the turns to the gap. */
function bfs(state: TiltState): (1 | -1)[] {
  const k = (r: number, c: number, g: number) => r * 400 + c * 4 + g;
  const prev = new Map<number, { from: number; dir: 1 | -1 } | null>([
    [k(state.pos[0], state.pos[1], state.g), null],
  ]);
  const queue: [number, number, number][] = [[state.pos[0], state.pos[1], state.g]];
  while (queue.length) {
    const [r, c, g] = queue.shift()!;
    const k0 = k(r, c, g);
    for (const dir of [1, -1] as const) {
      const ng = (g + (dir > 0 ? 3 : 1)) % 4;
      const s = slide(state.p, [r, c], ng);
      const back = () => {
        const out: (1 | -1)[] = [dir];
        let cur = k0;
        while (prev.get(cur)) {
          const q = prev.get(cur)!;
          out.push(q.dir);
          cur = q.from;
        }
        return out.reverse();
      };
      if (s.out) return back();
      const kk = k(s.pos[0], s.pos[1], ng);
      if (!prev.has(kk)) {
        prev.set(kk, { from: k0, dir });
        queue.push([s.pos[0], s.pos[1], ng]);
      }
    }
  }
  throw new Error(`oracle: no way out of ${state.p.id}`);
}

class Player {
  state: TiltState;
  steps: Step[] = [];
  constructor(
    data: TiltData,
    private rand: () => number,
    start?: TiltState,
  ) {
    this.state = start ?? init(data);
  }
  /** A move, then a pause longer than the page's turn and roll (ms by default 1.0-2.3 s). */
  do(move: Move, ms = Math.round(1000 + this.rand() * 1300)) {
    if (this.state.solved) return;
    this.state = apply(this.state, move);
    this.steps.push({ move, ms });
  }
  turn(dir: 1 | -1, ms?: number) {
    this.do({ t: 'turn', dir }, ms);
  }
  undo(ms?: number) {
    if (this.state.hist.length) this.do({ t: 'undo' }, ms);
  }
  /** The shortest way out from wherever the ball is. */
  finish() {
    for (const dir of route(this.state)) this.turn(dir);
  }
}

/** A turn from here that moves nothing, if there is one. */
function stillTurn(s: TiltState): 1 | -1 | null {
  for (const dir of [1, -1] as const) {
    const ng = (s.g + (dir > 0 ? 3 : 1)) % 4;
    const sl = slide(s.p, s.pos, ng);
    if (!sl.path.length && !sl.out) return dir;
  }
  return null;
}

function detour(pl: Player) {
  const plan = route(pl.state);
  // part of the way, watching for a turn that moves nothing
  let still = false;
  for (const dir of plan.slice(0, Math.max(1, plan.length - 3))) {
    if (!still) {
      const d = stillTurn(pl.state);
      if (d) {
        pl.turn(d);
        still = true;
        pl.undo();
      }
    }
    pl.turn(dir);
  }
  // two wrong turns taken back
  const next = route(pl.state)[0]!;
  pl.turn(next === 1 ? -1 : 1);
  pl.turn(next === 1 ? -1 : 1);
  pl.undo();
  pl.undo(45_000); // a long think
  // a wrong turn kept, and worked back from
  const again = route(pl.state)[0]!;
  const wrong = apply(pl.state, { t: 'turn', dir: again === 1 ? -1 : 1 });
  if (!wrong.solved) pl.turn(again === 1 ? -1 : 1);
  pl.finish();
}

function solve(pl: Player) {
  pl.finish();
}

const PLAY: Record<Variant, (pl: Player) => void> = { solve, detour, resume: solve };

/** A part-turned maze: the first few turns of the shortest way, as the page keeps it. */
export function kept(data: TiltData): TiltState {
  let s = init(data);
  const plan = route(s);
  for (const dir of plan.slice(0, Math.min(3, plan.length - 1))) s = apply(s, { t: 'turn', dir });
  return { ...s, hist: [], last: null };
}

/**
 * Nudge the pauses so the finish never lands near a half second: the page's ball rolls on
 * animation frames, so its finish can come a frame or two (up to ~25 ms) after the model's.
 * `lead` is the time from Play to the first move plus the last turn's own time on the page.
 */
function settle(steps: Step[], baseMs: number, lead: number) {
  for (let i = 0; i < 20; i++) {
    const ms = baseMs + lead + steps.slice(0, -1).reduce((n, x) => n + x.ms, 0);
    const frac = (ms / 1000) % 1;
    if (frac < 0.44 || frac > 0.52) return;
    steps[0]!.ms += 120;
  }
}

/** The moves of one variant. Every list ends with the ball out. */
export function moves(data: TiltData, variant: Variant): Step[] {
  const pl = new Player(
    data,
    rng(data.id, variant),
    variant === 'resume' ? kept(data) : init(data),
  );
  PLAY[variant](pl);
  if (!pl.state.solved) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  pl.steps[pl.steps.length - 1]!.ms = 1500;
  // the last turn's own time on the page: the quarter turn, the roll, out
  const last = pl.state.last!;
  const outMs = TURN_MS + rollMs(last.path.length) + OUT_MS;
  settle(pl.steps, variant === 'resume' ? 42_000 : 0, 500 + outMs);
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
export function scenario(data: TiltData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const done = { 'DP·TILT·9001': { t: '0:41', s: 41, n: 12, d: days(date, 30) } };
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
    case 'detour':
      // finishes just after midnight: the streak goes on from the puzzle's own day
      return {
        variant,
        steps,
        start: 'midnight',
        seed: {
          'digi-tilt-v1': { v: 1, done },
          'digi-tilt-streak': streak(date, 4, 6, true),
        },
        reopen: false,
      };
    case 'resume': {
      // a kept maze at 0:42; a streak that lapsed days ago
      const k = kept(data);
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-tilt-v1': {
            v: 1,
            done,
            cur: {
              id: data.id,
              pos: k.pos,
              g: k.g,
              rot: k.rot,
              n: k.turns,
              trail: k.trail,
              s: 42,
              at: Date.parse(`${date}T07:00:00Z`),
            },
          },
          'digi-tilt-streak': streak(days(date, 5), 7, 9, true),
        },
        reopen: true,
      };
    }
  }
}
