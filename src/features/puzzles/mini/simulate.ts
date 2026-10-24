/**
 * The native half of the differential replay: plays a scenario's moves through the
 * model on a fake clock, as the screen does on a real one, and reports the board after
 * every move and the finish in the same shape `scripts/replay.js` reads from the web
 * page. The clock follows the page's: a one-second tick from the first letter, delete
 * or reveal, stopped by the solve.
 */
import { createSaveStore, dnNum, type KV } from '@noodle/core';

import { longDate } from '@/shared/time/format';

import { commitFinish, reopenInfo, type FinishInfo } from './finishing';
import {
  apply,
  clueBar,
  init,
  SAVE_KEY,
  STREAK_KEY,
  status,
  timerText,
  type MiniData,
  type MiniState,
} from './model';
import type { Scenario } from './oracle';

/** One square as the replay reads it: letter or '.', then * cursor, + in the word, g/b marks. */
export function squareCode(s: MiniState, r: number, c: number): string {
  if (s.p.grid[r]![c] === '#') return '#';
  const active = status(s).active;
  const mark = s.checked[r]![c];
  return (
    (s.entries[r]![c] || '.') +
    (s.sel.r === r && s.sel.c === c ? '*' : '') +
    (active && active.cells.some(([y, x]) => y === r && x === c) ? '+' : '') +
    (mark === 'good' ? 'g' : mark === 'bad' ? 'b' : '')
  );
}

export interface Snapshot {
  cells: string;
  bar: string;
  timer: string;
  win: boolean;
}

export function snapshot(s: MiniState, bar: string, clock: number): Snapshot {
  const cells: string[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cells.push(squareCode(s, r, c));
  return { cells: cells.join(' '), bar, timer: timerText(clock), win: s.solved };
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
}

export interface Simulation {
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

/**
 * Play `sc` from instant `t0` (the moment of the first move). `date` is the page's
 * dn:date, which the finish sheet's kicker names.
 */
export function simulate(data: MiniData, sc: Scenario, t0: number, date: string): Simulation {
  const kv = memoryKV(sc.seed);
  let state = init(data);
  let now = t0;
  let startAt: number | null = null;
  let solveAt: number | null = null;
  let solvedClock = 0;
  const barText = () => {
    const b = clueBar(state);
    return b ? `${b.label} ${b.clue}` : '';
  };
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
    snaps.push(snapshot(state, barText(), clock));
  }
  if (solveAt === null) throw new Error(`simulate: ${sc.variant} never solved ${data.id}`);
  const saves = createSaveStore(kv, { now: () => solveAt! });
  const f = commitFinish(state, solvedClock, saves, kv, solveAt);
  const final: Outcome = {
    save: JSON.parse(kv.getItem(SAVE_KEY) || 'null'),
    streak: JSON.parse(kv.getItem(STREAK_KEY) || 'null'),
    end: f.detail,
    share: f.share,
    note: f.note,
    hero: f.hero,
    title: 'Solved',
    kick: `Mini ${dnNum(data.id).slice(1)}, ${longDate(date)}`,
    stats: stats(f),
  };
  let reopened: Simulation['reopened'] = null;
  if (sc.reopen) {
    const r = reopenInfo(data.id, saves.getDone(SAVE_KEY, data.id)!, kv);
    reopened = { share: r.share, note: r.note, hero: r.hero, stats: stats(r) };
  }
  return { snaps, final, reopened };
}
