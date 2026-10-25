/**
 * The native half of the differential replay, and the oracle's player: a Borders
 * page's life on a fake clock, as the screen runs it (see reckon/simulate.ts for the
 * clock: frames every 16 ms of the page's performance clock, moves between them, a
 * reload saving the round as pagehide does and reopening the page from its save).
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
  ATLAS_KEY,
  colourOf,
  frame,
  homeView,
  init,
  quizView,
  SAVE_KEY,
  serial,
  type BordersData,
  type BordersState,
  type Host,
  type Move,
} from './model';
import type { Scenario } from './oracle';

export function memoryKV(seed: Record<string, unknown> = {}): KV {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) m.set(k, JSON.stringify(v));
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/**
 * The home screen's date: the engine's en-GB long date without its year, which
 * Chromium writes with a comma after the weekday ("Wednesday, 16 August").
 */
export function homeDate(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${longDate(day).replace(/^\S+ /, '')}`;
}

export interface Snapshot {
  view: string;
  paused: boolean;
  home?: { date: string; status: string; button: string; stats: string[] };
  quiz?: {
    ticks: string;
    pts: string;
    plate: string;
    opts: string[];
    hint: string;
    next: string;
    inset: boolean;
    coach: boolean;
    revealed: boolean;
    land: string;
    fill: string;
  };
  saved?: unknown;
}

export function snapshot(s: BordersState, t: string): Snapshot {
  const out: Snapshot = { view: s.view, paused: s.paused };
  if (s.view === 'home') {
    const h = homeView(s, t, dayBefore);
    out.home = {
      date: 'No. ' + serial(s.P.id) + ', ' + homeDate(s.P.date),
      status: h.status,
      button: h.button,
      stats: h.stats,
    };
  }
  if (s.view === 'quiz') {
    const v = quizView(s);
    out.quiz = {
      ticks: v.ticks.join(' '),
      pts: `${v.pts}pts`,
      plate: v.plate ? v.plate.name + v.plate.line : '',
      opts: v.options.map((o) => `${o.name}:${o.mark}`),
      hint: (v.hintHidden ? 'hidden' : 'shown') + (v.hintDisabled ? ' disabled' : ''),
      next: v.nextHidden ? '' : v.nextLabel,
      inset: v.inset,
      coach: v.coachOff,
      revealed: v.revealed,
      land: v.q.d,
      fill: colourOf(v.q),
    };
  }
  return out;
}

export class Session {
  kv: KV;
  saves!: SaveStore;
  state!: BordersState;
  tick: number;
  host!: Host;
  private nf: number;
  finished: (FinishInfo & { detail: Record<string, unknown> }) | null = null;

  constructor(
    public data: BordersData,
    seed: Record<string, unknown>,
    public openAt: number,
    public off: number,
  ) {
    this.kv = memoryKV(seed);
    this.tick = off;
    this.nf = this.next(off);
    this.open();
  }
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
      this.kv,
      this.data.id,
      () => this.tick,
      () => this.today(),
    );
    this.state = init(this.data, readSave(this.kv), this.tick);
    this.nf = this.next(this.tick);
  }
  advance(ms: number) {
    const to = this.tick + ms;
    while (this.nf <= to) {
      this.tick = this.nf;
      frame(this.state, this.nf);
      this.nf = this.next(this.nf);
    }
    this.tick = to;
  }
  private settle() {
    if (this.state.finishing) {
      const f = commitFinish(this.state, this.host);
      this.state = f.state;
      this.finished = f;
    }
  }
  move(m: Move) {
    if (m.t === 'reload') {
      const st = this.state;
      const playing = !!(st.save.done[st.P.id] || (st.save.cur && st.save.cur.id === st.P.id));
      this.host.persist(st.save, playing);
      this.open();
      return;
    }
    this.state = apply(this.state, m, this.host);
    this.settle();
  }
  reopened(): FinishInfo | null {
    this.open();
    return reopenInfo(this.state, this.today());
  }
}

export interface Outcome {
  save: unknown;
  atlas: unknown;
  end: Record<string, unknown>;
  share: string;
  note: string;
  hero: string;
  title: string;
  kick: string;
  stats: string[];
  tiles: string[];
}

export interface Simulation {
  snaps: Snapshot[];
  final: Outcome;
  reopened: Pick<Outcome, 'share' | 'note' | 'hero' | 'stats' | 'tiles'> | null;
}

export const tileText = (f: FinishInfo) => f.tiles.map((x) => `${x.ok ? 'ok' : 'x'}:${x.caption}`);
const sheetStats = (f: FinishInfo) => [String(f.points), String(f.streak), String(f.best)];
const json = (kv: KV, k: string) => JSON.parse(kv.getItem(k) || 'null') as unknown;

export function simulate(
  data: BordersData,
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
    if (step.move.t === 'reload') snap.saved = json(ses.kv, SAVE_KEY);
    snaps.push(snap);
  }
  const f = ses.finished;
  if (!f) throw new Error(`simulate: ${sc.variant} never finished ${data.id}`);
  const final: Outcome = {
    save: json(ses.kv, SAVE_KEY),
    atlas: json(ses.kv, ATLAS_KEY),
    end: f.detail,
    share: f.share,
    note: f.note,
    hero: f.hero,
    title: 'Spotted',
    kick: `Borders ${dnNum(data.id).slice(1)}, ${longDate(data.date)}`,
    stats: sheetStats(f),
    tiles: tileText(f),
  };
  let reopened: Simulation['reopened'] = null;
  if (sc.reopen) {
    const r = ses.reopened()!;
    reopened = {
      share: r.share,
      note: r.note,
      hero: r.hero,
      stats: sheetStats(r),
      tiles: tileText(r),
    };
  }
  return { snaps, final, reopened };
}
