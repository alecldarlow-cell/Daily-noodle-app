/**
 * Deterministic move lists for a Borders, for the differential replay
 * (scripts/replay.js) and the model's tests. The same list drives the web page's real
 * controls and the native model. `ms` is the time that passes after a move.
 *
 * - site: the site's own player (tools/tests/play.js borders, wrong [3, 6, 8],
 *   hint [5]): Play, Show on map where asked, a name, Next.
 * - resume: hints, wrong names, the page closed and reopened with an answer showing,
 *   mid-question after a hint (the hint doesn't survive, as on the page) and after the
 *   tenth answer before See result (Resume goes straight to the result); a long pause;
 *   Back to start; across London midnight from a streak on the puzzle's day, with some
 *   of the day's countries already in Borderline's atlas.
 * - lapsed: the coach tip already seen, a lapsed streak, an atlas save that isn't one
 *   (nothing is added to it), hints on the first and last; every name right.
 * - archive: played three days late, no atlas yet: the streak still counts.
 */
import { dayBefore, londonDay } from '@noodle/core';

import { slug, type BordersData, type BordersState, type Move } from './model';
import { Session } from './simulate';

export type Variant = 'site' | 'resume' | 'lapsed' | 'archive';
export const VARIANTS: readonly Variant[] = ['site', 'resume', 'lapsed', 'archive'];

export interface Step {
  move: Move;
  ms: number;
}

export interface Scenario {
  variant: Variant;
  steps: Step[];
  start: 'morning' | 'midnight' | 'later';
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
  ses: Session;
  steps: Step[] = [];
  constructor(
    public data: BordersData,
    private rand: () => number,
  ) {
    this.ses = new Session(data, {}, Date.parse(`${data.date}T08:15:00Z`), 0);
  }
  get state(): BordersState {
    return this.ses.state;
  }
  gap(lo: number, hi: number) {
    return Math.round(lo + this.rand() * (hi - lo));
  }
  do(move: Move, ms = this.gap(400, 1500)) {
    this.ses.move(move);
    this.ses.advance(ms);
    this.steps.push({ move, ms });
  }
  get q() {
    return this.data.qs[this.state.cur!.i]!;
  }
  /** play.js: the right name, or the first one that isn't. */
  name(wrong: boolean) {
    const o = this.q.o;
    this.do(
      { t: 'answer', k: wrong ? o.findIndex((n) => n !== this.q.n) : o.indexOf(this.q.n) },
      1200,
    );
  }
  get finished() {
    return !!this.ses.finished && this.state.view === 'winModal';
  }
}

function site(pl: Player) {
  pl.do({ t: 'play' }, 1500);
  for (let i = 0; i < 10; i++) {
    if (i === 5) pl.do({ t: 'hint' }, 800);
    pl.name([3, 6, 8].includes(i));
    pl.do({ t: 'next' }, 1000);
  }
}

function resume(pl: Player) {
  pl.do({ t: 'play' }, 1500);
  pl.do({ t: 'hint' }, 900);
  pl.name(false);
  pl.do({ t: 'next' });
  pl.name(true);
  pl.do({ t: 'reload' }, 1500); // answered, Next not yet tapped
  pl.do({ t: 'play' }, 1200); // Resume: on to the next question
  pl.do({ t: 'hint' }, 700);
  pl.do({ t: 'reload' }, 1500); // the hint is not kept
  pl.do({ t: 'play' }, 1200);
  pl.name(false);
  pl.do({ t: 'pause' }, pl.gap(20_000, 60_000));
  pl.do({ t: 'resume' }, 600);
  pl.do({ t: 'next' });
  pl.do({ t: 'pause' }, 700);
  pl.do({ t: 'quit' }, 1500);
  pl.do({ t: 'play' }, 1200);
  for (let n = 0; n < 12 && pl.state.cur && pl.state.cur.i < 9; n++) {
    const i = pl.state.cur.i;
    if (i === 6) pl.do({ t: 'hint' }, pl.gap(3000, 9000));
    pl.name(i === 5);
    pl.do({ t: 'next' });
  }
  pl.name(false);
  pl.do({ t: 'reload' }, 1500); // the tenth answered, See result not yet tapped
  pl.do({ t: 'play' }, 1200); // Resume: straight to the result
}

function lapsed(pl: Player) {
  pl.do({ t: 'play' }, 1500);
  for (let i = 0; i < 10; i++) {
    if (i === 0 || i === 9) pl.do({ t: 'hint' }, 800);
    pl.name(false);
    pl.do({ t: 'next' }, 1000);
  }
}

function archive(pl: Player) {
  pl.do({ t: 'play' }, 1500);
  for (let i = 0; i < 10; i++) {
    pl.name(i === 0);
    pl.do({ t: 'next' }, 1000);
  }
}

const PLAY: Record<Variant, (pl: Player) => void> = { site, resume, lapsed, archive };

export function moves(data: BordersData, variant: Variant): Step[] {
  const pl = new Player(data, rng(data.id, variant));
  PLAY[variant](pl);
  if (!pl.finished) throw new Error(`oracle: ${variant} did not finish ${data.id}`);
  pl.steps[pl.steps.length - 1]!.ms = 3000;
  return pl.steps;
}

const days = (day: string, n: number) => {
  let d = day;
  for (let i = 0; i < n; i++) d = dayBefore(d);
  return d;
};
const after = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function startAt(sc: Scenario, date: string, leadMs: number): number {
  if (sc.start === 'morning') return Date.parse(`${date}T08:15:00Z`);
  if (sc.start === 'later') return Date.parse(`${after(date, 3)}T08:15:00Z`);
  let m = Date.parse(`${date}T21:00:00Z`);
  while (londonDay(m) === date) m += 60_000;
  const playing = sc.steps.slice(0, -1).reduce((n, s) => n + s.ms, 0);
  return m - leadMs - Math.floor(playing / 2);
}

export function scenario(data: BordersData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const other = {
    'DP·BORD·0999': {
      c: 9,
      p: 1240,
      secs: 80,
      ans: Array.from({ length: 10 }, (_, k) => ({ k: 0, ok: k !== 4, h: false, nw: false })),
      on: days(date, 30),
    },
  };
  switch (variant) {
    case 'site':
      return { variant, steps, start: 'morning', seed: {}, reopen: true };
    case 'resume':
      return {
        variant,
        steps,
        start: 'midnight',
        seed: {
          'digi-borders-v1': {
            v: 1,
            done: other,
            streak: { last: date, n: 4, best: 6 },
            cur: null,
            snd: false,
            rm: null,
            fs: false,
            seenCoach: false,
          },
          'digi-borderline-v1': {
            v: 1,
            found: { [slug(data.qs[0]!.n)]: 2, [slug(data.qs[3]!.n)]: 1, 'not-a-country': 1 },
            best: 7,
          },
        },
        reopen: false,
      };
    case 'lapsed':
      return {
        variant,
        steps,
        start: 'morning',
        seed: {
          'digi-borders-v1': {
            v: 1,
            done: other,
            streak: { last: days(date, 5), n: 7, best: 9 },
            cur: null,
            seenCoach: true,
          },
          'digi-borderline-v1': { v: 2, countries: ['peru'] },
        },
        reopen: true,
      };
    case 'archive':
      return {
        variant,
        steps,
        start: 'later',
        seed: {
          'digi-borders-v1': { v: 1, done: {}, streak: { last: after(date, 2), n: 3, best: 3 } },
        },
        reopen: false,
      };
  }
}
