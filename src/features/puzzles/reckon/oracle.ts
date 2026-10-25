/**
 * Deterministic move lists for a Reckon, for the differential replay (scripts/replay.js)
 * and the model's tests. The same list drives the web page's real controls and the
 * native model. `ms` is the time that passes after a move (the replay's fake clock).
 *
 * - site: the site's own player (tools/tests/play.js reckon, wrong [2, 5], stop 10):
 *   drag to the answer (or the wrong end of the scale), Lock in, Next.
 *   (A recap row's review is not replayed: on the page, Back to results rebuilds the
 *   sheet without its title, points and time, a site bug the app doesn't copy.)
 * - resume: − and + taps and a hold, a Next tapped too soon after Lock in (ignored),
 *   the page closed and reopened twice mid-round (once with the answer showing, once
 *   mid-guess) and resumed, ‹ › and pips to look back, Pause, Back to start, Resume;
 *   played across London midnight from a streak on the puzzle's day.
 * - lapsed: the coach tip already seen, a lapsed streak, a better score elsewhere;
 *   guesses fine-tuned with − / + to land one step off.
 * - archive: played three days late, from a live streak: the streak doesn't move.
 */
import { dayBefore, londonDay } from '@noodle/core';

import { fractionOf, ladderOf, type Move, type ReckonData, type ReckonState } from './model';
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
  /** 'morning': 08:15 UTC on the day; 'midnight': play straddles its end; 'later': three days on. */
  start: 'morning' | 'midnight' | 'later';
  seed: Record<string, unknown>;
  /** Reload after the finish and check the reopened sheet. */
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

/** Builds a move list while playing it, so each move is chosen from the real state. */
class Player {
  ses: Session;
  steps: Step[] = [];
  constructor(
    public data: ReckonData,
    private rand: () => number,
  ) {
    this.ses = new Session(data, {}, Date.parse(`${data.date}T08:15:00Z`), 0);
  }
  get state(): ReckonState {
    return this.ses.state;
  }
  gap(lo: number, hi: number) {
    return Math.round(lo + this.rand() * (hi - lo));
  }
  do(move: Move, ms = this.gap(300, 1200)) {
    this.ses.move(move);
    this.ses.advance(ms);
    this.steps.push({ move, ms });
  }
  get q() {
    return this.data.qs[this.state.Q]!;
  }
  /** The ladder index nearest the answer. */
  answerIndex() {
    const lad = ladderOf(this.state);
    const lv = Math.log10(this.q.a);
    let best = 0;
    for (let i = 1; i < lad.length; i++)
      if (Math.abs(Math.log10(lad[i]!) - lv) < Math.abs(Math.log10(lad[best]!) - lv)) best = i;
    return best;
  }
  dragTo(i: number) {
    const n = ladderOf(this.state).length;
    this.do({ t: 'drag', fr: fractionOf(this.state, Math.max(0, Math.min(n - 1, i))) });
  }
  /** play.js: the answer, or the far end of the scale for a wrong one. */
  guess(wrong: boolean) {
    if (wrong) {
      const at = (Math.log10(this.q.a) - this.q.lo) / 2;
      this.do({ t: 'drag', fr: at < 0.5 ? 1 : 0 }, 300);
    } else this.dragTo(this.answerIndex());
  }
  lockAndNext() {
    this.do({ t: 'act' }, 900);
    this.do({ t: 'act' }, 700);
  }
  get finished() {
    return !!this.ses.finished && this.state.view === 'winModal';
  }
}

function site(pl: Player) {
  pl.do({ t: 'play' }, 800);
  for (let i = 0; i < 10; i++) {
    pl.guess(i === 2 || i === 5);
    pl.lockAndNext();
  }
}

function resume(pl: Player) {
  pl.do({ t: 'play' }, 800);
  // Q1: the coach tip, − and + taps, a hold, Lock in, a Next too soon, then Next
  pl.do({ t: 'nudge', d: 1 });
  pl.do({ t: 'nudge', d: 1 }, 200);
  pl.do({ t: 'nudge', d: -1, hold: 380 + 75 * 4 + 20 });
  pl.do({ t: 'nudge', d: -1, hold: 420 }); // held, but no repeat yet: nothing moves
  pl.dragTo(pl.answerIndex() + 2);
  pl.do({ t: 'nudge', d: -1 }, 250);
  pl.do({ t: 'act' }, 200);
  pl.do({ t: 'act' }, 600); // within 450 ms of Lock in: ignored
  pl.do({ t: 'act' }, 700);
  // Q2: locked in, then the page closes and reopens; Resume shows the answer; Next
  pl.dragTo(pl.answerIndex() - 1);
  pl.do({ t: 'act' }, 900);
  pl.do({ t: 'reload' }, 1500);
  pl.do({ t: 'play' }, 800);
  pl.do({ t: 'act' }, 700);
  // Q3: closed mid-guess, resumed where the marker was
  pl.dragTo(pl.answerIndex() + 5);
  pl.do({ t: 'reload' }, 1500);
  pl.do({ t: 'play' }, 800);
  pl.do({ t: 'nudge', d: -1 });
  pl.do({ t: 'act' }, 900);
  pl.do({ t: 'act' }, 700);
  // Q4: look back with ‹ and a pip, back to the live question, a long think, Pause, Resume
  pl.do({ t: 'nav', d: -1 }, 500);
  pl.do({ t: 'pip', k: 0 }, 500);
  pl.do({ t: 'nav', d: 1 }, 400);
  pl.do({ t: 'act' }, 500); // Back to question 4
  pl.do({ t: 'pause' }, pl.gap(20_000, 60_000));
  pl.do({ t: 'resume' }, 600);
  pl.guess(false);
  pl.do({ t: 'act' }, pl.gap(30_000, 90_000)); // a long look at the answer
  pl.do({ t: 'act' }, 700);
  // Q5: Pause, Back to start, Resume
  pl.do({ t: 'pause' }, 500);
  pl.do({ t: 'quit' }, 1200);
  pl.do({ t: 'play' }, 800);
  for (let i = 4; i < 10 && !pl.finished; i++) {
    pl.guess(i === 6);
    if (i === 8) pl.do({ t: 'nudge', d: 1 }, 300);
    pl.lockAndNext();
  }
}

function lapsed(pl: Player) {
  pl.do({ t: 'play' }, 800);
  for (let i = 0; i < 10; i++) {
    const at = pl.answerIndex();
    if (i % 3 === 1) {
      pl.dragTo(at + 3);
      for (let k = 0; k < 4; k++) pl.do({ t: 'nudge', d: -1 }, pl.gap(150, 400));
    } else if (i % 3 === 2) {
      pl.dragTo(at - 9);
      pl.do({ t: 'nudge', d: 1, hold: 380 + 75 * 8 + 10 }, 400);
    } else pl.dragTo(at);
    pl.lockAndNext();
  }
}

function archive(pl: Player) {
  pl.do({ t: 'play' }, 800);
  for (let i = 0; i < 10; i++) {
    pl.guess(i === 0 || i === 9);
    pl.lockAndNext();
  }
}

const PLAY: Record<Variant, (pl: Player) => void> = { site, resume, lapsed, archive };

/** The moves of one variant. Every list ends on the finish sheet. */
export function moves(data: ReckonData, variant: Variant): Step[] {
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

/** The instant the page opens; `leadMs` is the time from opening to the first move. */
export function startAt(sc: Scenario, date: string, leadMs: number): number {
  if (sc.start === 'morning') return Date.parse(`${date}T08:15:00Z`);
  if (sc.start === 'later') return Date.parse(`${after(date, 3)}T08:15:00Z`);
  let m = Date.parse(`${date}T21:00:00Z`);
  while (londonDay(m) === date) m += 60_000;
  const playing = sc.steps
    .slice(0, -1)
    .reduce((n, s) => n + s.ms + (s.move.t === 'nudge' && s.move.hold ? s.move.hold : 0), 0);
  return m - leadMs - Math.floor(playing / 2);
}

/** A variant with its start and the saves it begins from. `date` is the puzzle's day. */
export function scenario(data: ReckonData, variant: Variant, date: string): Scenario {
  const steps = moves(data, variant);
  const other = {
    'DP·RECK·0999': {
      p: 900,
      b: 7,
      z: [0, 0, 0, 0, 0, 0, 0, 1, 1, 2],
      g: [],
      secs: 95,
      d: days(date, 40),
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
          'digi-reckon-v1': {
            v: 1,
            done: other,
            streak: { last: date, n: 4, best: 6 },
            best: 900,
            cur: null,
            snd: false,
            hap: true,
            rm: null,
            fs: false,
            tip: 0,
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
          'digi-reckon-v1': {
            v: 1,
            done: other,
            streak: { last: days(date, 5), n: 7, best: 9 },
            best: 900,
            cur: null,
            tip: 1,
          },
        },
        reopen: true,
      };
    case 'archive':
      return {
        variant,
        steps,
        start: 'later',
        seed: {
          'digi-reckon-v1': { v: 1, done: {}, streak: { last: after(date, 2), n: 3, best: 3 } },
        },
        reopen: false,
      };
  }
}
