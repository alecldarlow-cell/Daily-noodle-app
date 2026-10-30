/**
 * The native half of the differential replay: plays a scenario's moves through the
 * model on a fake clock, as the screen does on a real one, and reports the board after
 * every move and the finish in the shape `scripts/replay.js` reads from the web page.
 * The clock follows the page's: it starts on Play (SITE.md › Players), ticks once a
 * second and stops when the thread is complete.
 */
import { createSaveStore, type KV } from '@noodle/core';

import { streakLine } from '@/shared/finish-sheet/rules';

import { commitFinish, liveStreak, reopenInfo, type FinishInfo } from './finishing';
import {
  apply,
  endMark,
  init,
  lines,
  N,
  restore,
  SAVE_KEY,
  STREAK_KEY,
  timerText,
  type Cell,
  type PathData,
  type PathState,
} from './model';
import type { Scenario } from './oracle';

/** How long the complete thread shows before the finish sheet rises (the page waits 0.9 s). */
export const SHEET_DELAY_MS = 900;

/** One square as the replay reads it: its number or '.', * the active end, ^ the other end, ~ shaken. */
export function squareCode(s: PathState, r: number, c: number, shaken: boolean): string {
  const v = s.cellValue[r]![c];
  const m = endMark(s, r, c);
  return (
    (v === null || v === undefined ? '.' : String(v)) +
    (m === 'active' ? '*' : m === 'endsel' ? '^' : '') +
    (shaken ? '~' : '')
  );
}

/** A thread as the page's SVG polyline holds it: stroke, then the square centres. */
const polyline = (cells: Cell[], stroke: string) =>
  cells.length < 2
    ? null
    : `${stroke} ${cells.map(([r, c]) => `${c * 100 + 50},${r * 100 + 50}`).join(' ')}`;

export function lineCodes(s: PathState): string[] {
  const l = lines(s);
  return (
    l.solved
      ? [polyline(l.low, '#1F9E6B')]
      : [polyline(l.low, '#2E5BFF'), polyline(l.high, '#1B3B9E')]
  ).filter((x): x is string => x !== null);
}

export interface Snapshot {
  cells: string;
  lines: string[];
  msg: string;
  timer: string;
  streak: string;
  sheet: boolean;
}

export function snapshot(
  s: PathState,
  shook: ReadonlySet<number>,
  clock: number,
  streak: number,
  sheet: boolean,
): Snapshot {
  const cells: string[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) cells.push(squareCode(s, r, c, shook.has(r * N + c)));
  return {
    cells: cells.join(' '),
    lines: lineCodes(s),
    msg: s.msg,
    timer: timerText(clock),
    streak: String(streak),
    sheet,
  };
}

export interface Outcome {
  save: unknown;
  streak: unknown;
  end: Record<string, unknown>;
  share: string;
  note: string;
  hero: string;
  title: string;
  kick: string;
  /** The model's three numbers (kept as a check; the sheet shows only `streakLine` since AF-019). */
  stats: string[];
  /** "🔥 5-day streak", the sheet's line under the score. */
  streakLine: string;
}

export interface Simulation {
  snaps: Snapshot[];
  final: Outcome;
  reopened: Pick<Outcome, 'share' | 'note' | 'hero' | 'stats' | 'streakLine'> | null;
}

export function memoryKV(seed: Record<string, unknown> = {}): KV {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) m.set(k, JSON.stringify(v));
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const stats = (f: FinishInfo) => [String(f.streak), String(f.best), String(f.played)];
/** The sheet's line under the score (finish.js streakLine, AF-019): the day streak. */
const line = (n: number) => streakLine([{ value: n, label: 'day streak' }]);

/** "Path 92" from "DP·PATH·0092", as finishSheet numbers it. */
export const pathNumber = (id: string) => parseInt(String(id).split('·').pop() ?? '', 10);

/**
 * Play `sc` on a page opened at `openAt`, Play pressed at `playAt`, first move at
 * `firstAt`. `date` is the page's dn:date, which the finish sheet's kicker names.
 */
export function simulate(
  data: PathData,
  sc: Scenario,
  openAt: number,
  playAt: number,
  firstAt: number,
  date: string,
): Simulation {
  const kv = memoryKV(sc.seed);
  let clockNow = openAt;
  const saves = createSaveStore(kv, { now: () => clockNow });
  let streak = liveStreak(kv, openAt);
  let state = init(data);
  const startAt = playAt;
  let now = firstAt;
  let solvedClock = 0;
  let sheetAt: number | null = null;
  let info: (FinishInfo & { detail: Record<string, unknown> }) | null = null;
  const shook = new Set<number>();
  const snaps: Snapshot[] = [];
  for (const step of sc.steps) {
    const before = state;
    clockNow = now;
    state = apply(state, step.move);
    if (state.shake && state.shake !== before.shake) shook.add(state.shake.r * N + state.shake.c);
    if (state.solved && !before.solved) {
      solvedClock = Math.floor((now - startAt) / 1000);
      const f = commitFinish(state, solvedClock, saves, kv, now);
      streak = f.streak;
      info = f;
      sheetAt = now + SHEET_DELAY_MS;
    }
    now += step.ms;
    const clock = state.solved ? solvedClock : Math.floor((now - startAt) / 1000);
    snaps.push(snapshot(state, shook, clock, streak, sheetAt !== null && now >= sheetAt));
  }
  if (!info) throw new Error(`simulate: ${sc.variant} never finished ${data.id}`);
  const final: Outcome = {
    save: JSON.parse(kv.getItem(SAVE_KEY) || 'null'),
    streak: JSON.parse(kv.getItem(STREAK_KEY) || 'null'),
    end: info.detail,
    share: info.share,
    note: info.note,
    hero: info.hero,
    title: 'Path complete',
    kick: `Path ${pathNumber(data.id)}`,
    stats: stats(info),
    streakLine: line(info.streak),
  };
  let reopened: Simulation['reopened'] = null;
  if (sc.reopen) {
    const rec = saves.getDone(SAVE_KEY, data.id)!;
    const r = reopenInfo(restore(data, rec), rec, kv, now);
    reopened = {
      share: r.share,
      note: r.note,
      hero: r.hero,
      stats: stats(r),
      streakLine: line(r.streak),
    };
  }
  return { snaps, final, reopened };
}
