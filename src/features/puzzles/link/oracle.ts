/**
 * Deterministic move lists for a Link, for the differential replay (scripts/replay-link.js)
 * and the model's tests. Each variant plays the puzzle to its end through the controls
 * a phone has; the same list drives the web page's real controls and the native model.
 * `ms` is the time that passes after a move (the replay's fake clock); every value is
 * a whole number of 100 ms. Shuffle and Play again carry no order here: the board is
 * dealt at random, so the replay reads the page's order after each and hands it to
 * the model.
 *
 * - solve: Play, a deselect, two shuffles, the four groups in the page's order.
 * - wrong: tools/tests/play.js link({wrong: 1}); crosses London midnight on a live streak.
 * - misc: "Four at a time", Not a group, the same four again ("Already tried"), one
 *   away, then the solve; a streak saved before 18 Oct 2026 (one day's grace).
 * - loss: play.js link({wrong: 4}) on a lapsed streak, then Play again (not recorded)
 *   and a win that records nothing.
 * - replayday: another Link already played today, so this one is a replay from the
 *   start (the label, the note, no streak), solved with two mistakes.
 * - reduced: reduced motion (the settle lands at once), one mistake.
 */
import { dayBefore, londonDay } from '@noodle/core';

import { allTiles, apply, init, settles, type LinkData, type LinkState, type Move } from './model';

export type Variant = 'solve' | 'wrong' | 'misc' | 'loss' | 'replayday' | 'reduced';
export const VARIANTS: readonly Variant[] = [
  'solve',
  'wrong',
  'misc',
  'loss',
  'replayday',
  'reduced',
];

/** A move as the oracle writes it: Shuffle and Play again without their (random) orders. */
export type OracleMove =
  | Exclude<Move, { t: 'shuffle' } | { t: 'again' } | { t: 'land' } | { t: 'revealed' }>
  | { t: 'shuffle' }
  | { t: 'again' };

export interface Step {
  move: OracleMove;
  ms: number;
  /** A submit of a right four: the board settles before it lands. */
  settles?: boolean;
}

export interface Scenario {
  variant: Variant;
  steps: Step[];
  /** 'morning': 08:15 UTC on the puzzle's day; 'midnight': play straddles its end. */
  start: 'morning' | 'midnight';
  /** Saves present before the page opens (key → document). */
  seed: Record<string, unknown>;
  /** The phone asks for reduced motion. */
  reduced: boolean;
  /** Reload after the finish and check the reopened sheet. */
  reopen: boolean;
}

/** The model's move for an oracle move, given the order the board took. */
export function realMove(m: OracleMove, order: string[]): Move {
  if (m.t === 'shuffle') return { t: 'shuffle', order };
  if (m.t === 'again') return { t: 'again', order };
  return m;
}

class Player {
  state: LinkState;
  steps: Step[] = [];
  constructor(private data: LinkData) {
    this.state = init(data, allTiles(data), { ranked: true, rec: null });
  }
  do(move: OracleMove, ms: number) {
    const real = realMove(move, move.t === 'again' ? allTiles(this.data) : this.state.live);
    const settle = settles(this.state, real);
    this.state = apply(this.state, real);
    if (settle) this.state = apply(this.state, { t: 'land' });
    if (this.state.revealing) this.state = apply(this.state, { t: 'revealed' });
    this.steps.push(settle ? { move, ms, settles: true } : { move, ms });
  }
  pick(ws: string[], last = false) {
    if (this.state.sel.length) this.do({ t: 'deselect' }, 300);
    ws.forEach((w, i) => this.do({ t: 'tile', w: w.toUpperCase() }, 300 + 100 * (i % 3)));
    const right = new Set(ws.map((w) => this.state.p.byName[w.toUpperCase()])).size === 1;
    this.do({ t: 'submit' }, last ? 4000 : right ? 1800 : 1200);
  }
}

const G = (d: LinkData) => d.groups.map((g) => g.members);
/** play.js link(): the wrong guesses it makes after the first group. */
function wrongs(d: LinkData): string[][] {
  const g = G(d);
  return [
    [g[1]![0]!, g[1]![1]!, g[1]![2]!, g[2]![0]!],
    [g[1]![0]!, g[1]![1]!, g[2]![0]!, g[2]![1]!],
    [g[1]![0]!, g[2]![0]!, g[3]![0]!, g[3]![1]!],
    [g[2]![1]!, g[2]![2]!, g[3]![0]!, g[1]![3]!],
  ];
}

function solve(pl: Player, d: LinkData) {
  const g = G(d);
  pl.do({ t: 'play' }, 600);
  pl.do({ t: 'tile', w: g[0]![0]!.toUpperCase() }, 400);
  pl.do({ t: 'tile', w: g[0]![1]!.toUpperCase() }, 300);
  pl.do({ t: 'deselect' }, 500);
  pl.do({ t: 'shuffle' }, 700);
  pl.pick(g[0]!);
  pl.pick(g[1]!);
  pl.do({ t: 'shuffle' }, 900);
  pl.pick(g[2]!);
  pl.pick(g[3]!, true);
}

function wrong(pl: Player, d: LinkData, n: number) {
  const g = G(d);
  pl.do({ t: 'play' }, 600);
  pl.pick(g[0]!);
  const w = wrongs(d);
  for (let i = 0; i < n; i++) pl.pick(w[i]!, i === 3);
  if (n < 4) {
    pl.pick(g[1]!);
    pl.pick(g[2]!);
    pl.pick(g[3]!, true);
  }
}

function misc(pl: Player, d: LinkData) {
  const g = G(d);
  pl.do({ t: 'play' }, 500);
  for (const w of [g[0]![0], g[1]![0], g[2]![0], g[3]![0], g[0]![1]])
    pl.do({ t: 'tile', w: w!.toUpperCase() }, 300);
  pl.do({ t: 'deselect' }, 400);
  const two = [g[1]![0]!, g[1]![1]!, g[2]![0]!, g[2]![1]!];
  pl.pick(two);
  pl.pick([two[3]!, two[1]!, two[2]!, two[0]!]); // the same four, tapped in another order
  pl.pick([g[0]![0]!, g[0]![1]!, g[0]![2]!, g[3]![0]!]);
  pl.do({ t: 'shuffle' }, 600);
  pl.do({ t: 'shuffle' }, 800);
  pl.pick(g[3]!);
  pl.pick(g[0]!);
  pl.pick(g[2]!);
  pl.pick(g[1]!, true);
}

function loss(pl: Player, d: LinkData) {
  wrong(pl, d, 4);
  pl.do({ t: 'again' }, 900);
  const g = G(d);
  pl.pick(g[1]!);
  pl.pick(g[0]!);
  pl.pick(g[3]!);
  pl.pick(g[2]!, true);
}

function replayday(pl: Player, d: LinkData) {
  const g = G(d);
  const w = wrongs(d);
  pl.do({ t: 'play' }, 700);
  pl.pick(g[0]!);
  pl.pick(w[0]!);
  pl.pick(w[2]!);
  pl.pick(g[1]!);
  pl.pick(g[2]!);
  pl.pick(g[3]!, true);
}

function reduced(pl: Player, d: LinkData) {
  const g = G(d);
  pl.do({ t: 'play' }, 500);
  pl.pick(g[0]!);
  pl.pick(wrongs(d)[1]!);
  pl.pick(g[2]!);
  pl.pick(g[1]!);
  pl.pick(g[3]!, true);
}

/** The moves of one variant for a puzzle. Every list ends with the board over. */
export function moves(data: LinkData, variant: Variant): Step[] {
  const pl = new Player(data);
  if (variant === 'solve') solve(pl, data);
  else if (variant === 'wrong') wrong(pl, data, 1);
  else if (variant === 'misc') misc(pl, data);
  else if (variant === 'loss') loss(pl, data);
  else if (variant === 'replayday') replayday(pl, data);
  else reduced(pl, data);
  if (!pl.state.over) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  return pl.steps;
}

/**
 * The instant the page opens. `leadMs` is the time between opening and the first move.
 * A 'midnight' scenario is timed so London midnight falls halfway through its moves.
 */
export function startAt(sc: Scenario, date: string, leadMs: number): number {
  if (sc.start === 'morning') return Date.parse(`${date}T08:15:00Z`);
  let m = Date.parse(`${date}T21:00:00Z`);
  while (londonDay(m) === date) m += 60_000;
  const playing = sc.steps.slice(0, -1).reduce((n, s) => n + s.ms, 0);
  return m - leadMs - Math.floor(playing / 2 / 100) * 100;
}

const days = (day: string, n: number) => {
  let d = day;
  for (let i = 0; i < n; i++) d = dayBefore(d);
  return d;
};
const run = (last: string, n: number) => Array.from({ length: n }, (_, i) => days(last, n - 1 - i));

/** A variant with its start and the saves it begins from. `date` is the puzzle's day. */
export function scenario(data: LinkData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const otherLink = {
    v: 1,
    done: {
      'DP·LINK·0001': { o: 'win', t: '02:10', m: 1, r: [1, 2, 3, 4], g: [], d: days(date, 40) },
    },
  };
  const base = {
    variant,
    steps,
    start: 'morning' as const,
    seed: {},
    reduced: false,
    reopen: false,
  };
  switch (variant) {
    case 'solve':
      return { ...base, reopen: true };
    case 'wrong':
      // Finishes just after midnight, so the streak continues from the puzzle's own day.
      return {
        ...base,
        start: 'midnight',
        seed: {
          'digi-link-v1': otherLink,
          'digi-link-streak': { last: date, streak: 4, best: 6, dates: run(date, 4), tz: 'L' },
        },
      };
    case 'misc':
      // A streak saved before 18 Oct 2026 (no tz): one extra day of gap is allowed.
      return {
        ...base,
        seed: {
          'digi-link-streak': {
            last: days(date, 2),
            streak: 2,
            best: 3,
            dates: run(days(date, 2), 2),
          },
        },
      };
    case 'loss':
      return {
        ...base,
        seed: {
          'digi-link-v1': otherLink,
          'digi-link-streak': {
            last: days(date, 5),
            streak: 7,
            best: 9,
            dates: run(days(date, 5), 7),
            tz: 'L',
          },
        },
        reopen: true,
      };
    case 'replayday':
      return {
        ...base,
        seed: {
          'digi-link-v1': otherLink,
          'digi-link-streak': { last: date, streak: 3, best: 3, dates: run(date, 3), tz: 'L' },
        },
      };
    case 'reduced':
      return {
        ...base,
        reduced: true,
        seed: {
          'digi-link-streak': {
            last: days(date, 1),
            streak: 1,
            best: 4,
            dates: [days(date, 1)],
            tz: 'L',
          },
        },
        reopen: true,
      };
  }
}
