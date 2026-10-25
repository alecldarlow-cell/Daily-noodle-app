/**
 * The native half of the differential replay: plays a scenario's moves through the
 * model on a fake clock, as the screen does on a real one, and reports the board after
 * every move and the finish in the same shape `scripts/replay-doku.js` reads from the
 * web page. The clock follows the page's: a one-second tick from the first tile placed
 * or the first delete, stopped by the solve. Opening the puzzle seeds Doku's streak
 * from its results, as the page's load does.
 */
import { createSaveStore, dnNum, type KV } from '@noodle/core';

import { longDate } from '@/shared/time/format';

import { commitFinish, ensureStreak, reopenInfo, type FinishInfo } from './finishing';
import {
  activeWord,
  apply,
  bankTiles,
  goodSquares,
  init,
  isLock,
  letterAt,
  message,
  recapSub,
  SAVE_KEY,
  STREAK_KEY,
  timerText,
  type DokuData,
  type DokuState,
} from './model';
import type { Scenario } from './oracle';

/**
 * One square as the replay reads it: letter or '.', then * cursor, + in the word,
 * g green, L given or p placed.
 */
export function squareCode(s: DokuState, r: number, c: number, good = goodSquares(s)): string {
  if (s.p.grid[r]![c] === '#') return '#';
  const w = activeWord(s);
  return (
    (letterAt(s, r, c) || '.') +
    (s.view.r === r && s.view.c === c ? '*' : '') +
    (w && w.cells.some(([y, x]) => y === r && x === c) ? '+' : '') +
    (good.has(r + ',' + c) ? 'g' : '') +
    (isLock(s.p, r, c) ? 'L' : s.entries[r]![c] ? 'p' : '')
  );
}

export interface Snapshot {
  cells: string;
  /** Free tiles in bank order, "t3" or "t3*" when chosen. */
  bank: string;
  msg: string;
  timer: string;
  hints: string;
  win: boolean;
  /** The phone's keyboard is up (the page's hidden input has focus). */
  kbd: boolean;
}

export function snapshot(s: DokuState, clock: number): Snapshot {
  const good = goodSquares(s);
  const cells: string[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cells.push(squareCode(s, r, c, good));
  const timer = timerText(clock);
  return {
    cells: cells.join(' '),
    bank: bankTiles(s)
      .map((t) => t.id + (s.selTile === t.id ? '*' : ''))
      .join(' '),
    msg: message(s, timer),
    timer,
    hints: `Hints: ${s.hints ? 'on' : 'off'}`,
    win: s.solved,
    kbd: s.kbd,
  };
}

/** The finish as the replay compares it with the page. */
export interface Outcome {
  save: unknown;
  streak: unknown;
  end: Record<string, unknown>;
  share: string;
  note: string;
  hero: string;
  title: string;
  kick: string;
  stats: string[];
  recap: string;
}

export interface Simulation {
  /** The streak document after the page's load (seeded or as it was). */
  opened: unknown;
  snaps: Snapshot[];
  final: Outcome;
  reopened: Pick<Outcome, 'share' | 'note' | 'hero' | 'stats'> | null;
}

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

const stats = (f: FinishInfo) => [String(f.streak), String(f.best), String(f.played)];
const doc = (kv: KV, k: string): unknown => JSON.parse(kv.getItem(k) || 'null');

/**
 * Play `sc` from instant `t0` (the moment of the first move). `date` is the page's
 * dn:date, which the finish sheet's kicker names.
 */
export function simulate(data: DokuData, sc: Scenario, t0: number, date: string): Simulation {
  const kv = memoryKV(sc.seed);
  ensureStreak(kv);
  const opened = doc(kv, STREAK_KEY);
  let state = init(data);
  let now = t0;
  let startAt: number | null = null;
  let solveAt: number | null = null;
  let solvedClock = 0;
  const snaps: Snapshot[] = [];
  for (const step of sc.steps) {
    const before = state;
    state = apply(state, step.move);
    if (state.started && startAt === null) startAt = now;
    if (state.solved && !before.solved) {
      solveAt = now;
      solvedClock = Math.floor((now - (startAt ?? now)) / 1000);
    }
    now += step.ms;
    const clock = state.solved
      ? solvedClock
      : startAt === null
        ? 0
        : Math.floor((now - startAt) / 1000);
    snaps.push(snapshot(state, clock));
  }
  if (solveAt === null) throw new Error(`simulate: ${sc.variant} never solved ${data.id}`);
  const saves = createSaveStore(kv, { now: () => solveAt! });
  const f = commitFinish(state, solvedClock, saves, kv, solveAt);
  const final: Outcome = {
    save: doc(kv, SAVE_KEY),
    streak: doc(kv, STREAK_KEY),
    end: f.detail,
    share: f.share,
    note: f.note,
    hero: f.hero,
    title: 'Solved',
    kick: `Doku ${dnNum(data.id).slice(1)}, ${longDate(date)}`,
    stats: stats(f),
    recap: recapSub(state.p),
  };
  let reopened: Simulation['reopened'] = null;
  if (sc.reopen) {
    const r = reopenInfo(data.id, saves.getDone(SAVE_KEY, data.id)!, kv);
    reopened = { share: r.share, note: r.note, hero: r.hero, stats: stats(r) };
  }
  return { opened, snaps, final, reopened };
}
