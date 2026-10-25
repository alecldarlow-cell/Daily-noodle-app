/**
 * The native half of the differential replay, and the oracle's player: a Reckon page's
 * life on a fake clock, as the screen runs it. The page's performance clock (`tick`)
 * runs from `off` when it opens at wall time `openAt`; animation frames fall every
 * 16 ms of it (as the replay's paused browser clock schedules them), and each one
 * runs the engine's active-time loop. Moves happen between frames. A reload saves
 * the round (the page's pagehide) and opens the page again from its save.
 *
 * After every move it reports the screen in the shape `scripts/replay/reckon.js` reads
 * from the page; at the end the save, the `dn:puzzle_end` detail and the finish sheet.
 */
import {
  createSaveStore,
  dayBefore,
  dnNum,
  londonDay,
  type KV,
  type SaveStore,
} from '@noodle/core';

import { longDate } from '@/shared/time/format';

import { commitFinish, readSave, reopenInfo, saveHost, type FinishInfo } from './finishing';
import {
  apply,
  frame,
  homeView,
  init,
  playView,
  SAVE_KEY,
  scaleMarks,
  serial,
  type Host,
  type Move,
  type ReckonData,
  type ReckonState,
} from './model';
import type { Scenario } from './oracle';

export function memoryKV(
  seed: Record<string, unknown> = {},
): KV & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) m.set(k, JSON.stringify(v));
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    dump: () => Object.fromEntries(m),
  };
}

/** What the replay reads off the page after a move. */
export interface Snapshot {
  view: string;
  paused: boolean;
  home?: { date: string; streak: string; status: string; button: string; stats: string[] };
  play?: {
    qn: string;
    sc: string;
    chip: string;
    q: string;
    ru: string;
    rv: string;
    now: string;
    text: string;
    prev: boolean;
    fwd: boolean;
    rvt: string | null;
    pauseHidden: boolean;
    fb: { v: string; p: string; l: string; n: string | null; a: string; u: string } | null;
    act: string;
    nudge: boolean;
    tip: boolean;
    pips: string;
    labs: string;
  };
  /** After a reload: the save the page kept. */
  saved?: unknown;
}

export function snapshot(s: ReckonState, t: string): Snapshot {
  const out: Snapshot = { view: s.view, paused: s.paused };
  if (s.view === 'home') {
    const h = homeView(s, t, dayBefore);
    out.home = {
      date: 'No. ' + serial(s.P.id) + ', ' + longDate(s.P.date),
      streak: h.streak,
      status: h.status,
      button: h.button,
      stats: h.stats,
    };
  }
  if (s.view === 'play') {
    const v = playView(s);
    out.play = {
      qn: v.qn,
      sc: String(v.score),
      chip: v.chip.name,
      q: v.question,
      ru: v.unit,
      rv: v.guess,
      now: String(v.index),
      text: v.guessText,
      prev: v.prevDisabled,
      fwd: v.fwdDisabled,
      rvt: v.reviewing,
      pauseHidden: v.pauseHidden,
      fb: v.feedback
        ? {
            v: v.feedback.verdict,
            p: v.feedback.pts,
            l: v.feedback.line,
            n: v.feedback.noteHidden ? null : v.feedback.note,
            a: v.feedback.answer,
            u: v.feedback.unit,
          }
        : null,
      act: v.action,
      nudge: v.nudgeDisabled,
      tip: v.tipHidden,
      pips: v.pips
        .map(
          (p) =>
            (p.view ? 'v' : '') +
            (p.live ? 'l' : '') +
            (p.zone == null ? '' : String(p.zone)) +
            (p.disabled ? 'd' : ''),
        )
        .join(' '),
      labs: scaleMarks(v.lo)
        .labels.map((l) => l.text)
        .join(' '),
    };
  }
  return out;
}

/** One page's life: its save, its clock, its frames. */
export class Session {
  kv: KV;
  saves!: SaveStore;
  state!: ReckonState;
  tick: number;
  host!: Host;
  /** The next animation frame's time. */
  private nf: number;
  finished: (FinishInfo & { detail: Record<string, unknown> }) | null = null;

  constructor(
    public data: ReckonData,
    seed: Record<string, unknown>,
    public openAt: number,
    public off: number,
  ) {
    this.kv = memoryKV(seed);
    this.tick = off;
    this.nf = this.next(off);
    this.open();
  }
  /** The wall clock now. */
  wall() {
    return this.openAt + (this.tick - this.off);
  }
  today() {
    return londonDay(this.wall());
  }
  private next(t: number) {
    return t + (16 - (t % 16));
  }
  private open() {
    this.saves = createSaveStore(this.kv, { now: () => this.wall() });
    this.host = saveHost(
      this.saves,
      this.data.id,
      () => this.tick,
      () => this.today(),
    );
    this.state = init(this.data, readSave(this.kv), this.tick);
    this.nf = this.next(this.tick);
  }
  /** Let `ms` pass: every frame due runs the clock. */
  advance(ms: number) {
    const to = this.tick + ms;
    while (this.nf <= to) {
      this.tick = this.nf;
      frame(this.state, this.nf);
      this.nf = this.next(this.nf);
    }
    this.tick = to;
  }
  move(m: Move) {
    if (m.t === 'reload') {
      // pagehide saves the round as it stands, then the page opens again from the save
      const st = this.state;
      const playing = !!(st.save.done[st.P.id] || (st.save.cur && st.save.cur.id === st.P.id));
      this.host.persist(st.save, playing);
      this.open();
      return;
    }
    if (m.t === 'nudge' && m.hold) this.advance(m.hold);
    this.state = apply(this.state, m, this.host);
    if (this.state.finishing) {
      const f = commitFinish(this.state, this.saves, this.host);
      this.state = f.state;
      this.finished = f;
    }
  }
  reopened(): FinishInfo | null {
    this.open();
    return reopenInfo(this.state, this.today());
  }
}

/** The finish as the replay compares it with the page. */
export interface Outcome {
  save: unknown;
  end: Record<string, unknown>;
  share: string;
  note: string;
  hero: string;
  title: string;
  kick: string;
  stats: string[];
  rows: string[];
}

export interface Simulation {
  snaps: Snapshot[];
  final: Outcome;
  reopened: Pick<Outcome, 'share' | 'note' | 'hero' | 'stats' | 'rows'> | null;
}

/** The recap rows as their text reads on the page: question, guess and answer, points. */
export const rowText = (f: FinishInfo) => f.rows.map((r) => `${r.q}${r.line}${r.pts}`);
const sheetStats = (f: FinishInfo) => [f.time, String(f.streak), String(f.best)];

/**
 * Play `sc` on a page opened at wall time `openAt`, whose clock reads `off` then; the
 * first move comes `leadMs` later.
 */
export function simulate(
  data: ReckonData,
  sc: Scenario,
  openAt: number,
  off: number,
  leadMs: number,
): Simulation {
  const ses = new Session(data, sc.seed, openAt, off);
  ses.advance(leadMs);
  const snaps: Snapshot[] = [];
  for (const step of sc.steps) {
    ses.move(step.move);
    ses.advance(step.ms);
    const snap = snapshot(ses.state, ses.today());
    if (step.move.t === 'reload') snap.saved = JSON.parse(ses.kv.getItem(SAVE_KEY) || 'null');
    snaps.push(snap);
  }
  const f = ses.finished;
  if (!f) throw new Error(`simulate: ${sc.variant} never finished ${data.id}`);
  const final: Outcome = {
    save: JSON.parse(ses.kv.getItem(SAVE_KEY) || 'null'),
    end: f.detail,
    share: f.share,
    note: f.note,
    hero: `${f.points}pts`,
    title: 'Reckoned',
    kick: `Reckon ${dnNum(data.id).slice(1)}, ${longDate(data.date)}`,
    stats: sheetStats(f),
    rows: rowText(f),
  };
  let reopened: Simulation['reopened'] = null;
  if (sc.reopen) {
    const r = ses.reopened()!;
    reopened = {
      share: r.share,
      note: r.note,
      hero: `${r.points}pts`,
      stats: sheetStats(r),
      rows: rowText(r),
    };
  }
  return { snaps, final, reopened };
}
