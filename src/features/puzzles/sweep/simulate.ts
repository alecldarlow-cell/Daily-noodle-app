/**
 * The native half of the differential replay: plays a scenario's moves through the
 * model on a fake clock, as the screen does on a real one, and reports the board after
 * every move and the finish in the shape `scripts/replay.js` reads from the web page.
 * The clock follows the page's: a one-second tick from digging the start square,
 * stopped by the end of the round, back to zero on Play again.
 */
import { createSaveStore, type KV } from '@noodle/core';

import { streakLine } from '@/shared/finish-sheet/rules';

import { barStreak, commitFinish, isRanked, reopenInfo, type FinishInfo } from './finishing';
import {
  apply,
  CELLS,
  init,
  MARK_MS,
  minesLeft,
  msgText,
  overCount,
  restore,
  SAVE_KEY,
  STREAK_KEY,
  timerText,
  unmark,
  type SweepData,
  type SweepState,
} from './model';
import { holdOf, type Scenario } from './oracle';

/** How long a won board shows before the finish sheet rises (the page's celebrate). */
export const SHEET_DELAY_MS = 1450;

/**
 * One square as the replay reads it: x the mine hit, o (and its number, ~ if crossed
 * out) open, f flagged, h hidden (L locked until the start is dug); then ! for Hint's
 * mark and @ for a ringed number.
 */
export function squareCode(s: SweepState, i: number): string {
  let code: string;
  if (s.boomed.has(i)) code = 'x';
  else if (s.revealed.has(i))
    code = 'o' + (s.p.NUM[i]! > 0 ? String(s.p.NUM[i]) : '') + (overCount(s, i) ? '~' : '');
  else if (s.flagged.has(i)) code = 'f';
  else code = 'h' + (!s.startDug && i !== s.p.start ? 'L' : '');
  return code + (s.mark && s.mark.i === i ? '!' : '') + (s.why.includes(i) ? '@' : '');
}

export interface Snapshot {
  cells: string;
  left: string;
  neg: boolean;
  flagMode: boolean;
  msg: string;
  rank: string;
  timer: string;
  streak: string;
  win: boolean;
  sheet: boolean;
}

export function snapshot(s: SweepState, clock: number, streak: number, sheet: boolean): Snapshot {
  const cells: string[] = [];
  for (let i = 0; i < CELLS; i++) cells.push(squareCode(s, i));
  const left = minesLeft(s);
  return {
    cells: cells.join(' '),
    left: String(left),
    neg: left < 0,
    flagMode: s.flagMode,
    msg: msgText(s.msg),
    rank: s.rank,
    timer: timerText(clock),
    streak: String(streak),
    win: s.over && s.won,
    sheet,
  };
}

export interface Outcome {
  save: unknown;
  streak: unknown;
  end: Record<string, unknown> | null;
  share: string;
  note: string;
  hero: string;
  title: string;
  kick: string;
  /** The model's three numbers (kept as a check; the sheet shows only `streakLine` since AF-019). */
  stats: string[];
  /** "🔥 5-day streak", the sheet's line under the score. */
  streakLine: string;
  again: boolean;
  /** Which round the sheet ended (2 after one Play again). */
  round: number;
}

export interface Simulation {
  snaps: Snapshot[];
  final: Outcome;
  reopened: Pick<
    Outcome,
    'share' | 'note' | 'hero' | 'stats' | 'streakLine' | 'title' | 'again'
  > | null;
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
/** The sheet's line under the score (finish.js streakLine, AF-019): the day streak. */
const line = (n: number) => streakLine([{ value: n, label: 'day streak' }]);

/**
 * Play `sc` on a page opened at `openAt` whose first move is at `firstAt`. `date` is
 * the page's dn:date and `n` its number, which the finish sheet's kicker names.
 */
export function simulate(
  data: SweepData,
  sc: Scenario,
  openAt: number,
  firstAt: number,
  date: string,
  n: number | string,
): Simulation {
  const kv = memoryKV(sc.seed);
  let clockNow = openAt;
  const saves = createSaveStore(kv, { now: () => clockNow });
  let state = init(data, {
    ranked: isRanked(kv, openAt),
    done: !!saves.getDone(SAVE_KEY, data.id),
  });
  let now = firstAt;
  let startAt: number | null = null;
  let sheetAt: number | null = null;
  let detail: Record<string, unknown> | null = null;
  let info: FinishInfo | null = null;
  const timers: { at: number; n: number }[] = [];
  const snaps: Snapshot[] = [];
  for (const step of sc.steps) {
    const before = state;
    const at = now + holdOf(step.move);
    clockNow = at;
    const secs = startAt === null ? 0 : Math.floor((at - startAt) / 1000);
    const ranked = step.move.t === 'again' ? isRanked(kv, at) : undefined;
    state = apply(state, step.move, { secs, ranked });
    if (state.round !== before.round) {
      startAt = null;
      sheetAt = null;
    }
    if (state.started && startAt === null) startAt = at;
    if (state.over && !before.over) {
      const f = commitFinish(state, saves, kv, at);
      detail = detail ?? f.detail;
      info = f;
      sheetAt = at + (state.won ? SHEET_DELAY_MS : 0);
    }
    if (step.move.t === 'hint' && state.mark && state.mark !== before.mark)
      timers.push({ at: at + MARK_MS, n: state.mark.n });
    now = at + step.ms;
    while (timers.length && timers[0]!.at <= now) state = unmark(state, timers.shift()!.n);
    const clock = !state.started
      ? 0
      : state.over
        ? state.endSecs
        : Math.floor((now - (startAt ?? now)) / 1000);
    snaps.push(snapshot(state, clock, barStreak(kv), sheetAt !== null && now >= sheetAt));
  }
  if (!info) throw new Error(`simulate: ${sc.variant} never finished ${data.id}`);
  const final: Outcome = {
    save: JSON.parse(kv.getItem(SAVE_KEY) || 'null'),
    streak: JSON.parse(kv.getItem(STREAK_KEY) || 'null'),
    end: detail,
    share: info.share,
    note: info.note,
    hero: info.hero,
    title: info.title,
    kick: `Sweep ${n}`,
    stats: stats(info),
    streakLine: line(info.streak),
    again: info.again,
    round: state.round,
  };
  let reopened: Simulation['reopened'] = null;
  if (sc.reopen) {
    const r = restore(data, saves.getDone(SAVE_KEY, data.id), isRanked(kv, now));
    if (!r) throw new Error(`simulate: ${data.id} did not reopen`);
    const f = reopenInfo(r, kv);
    reopened = {
      share: f.share,
      note: f.note,
      hero: f.hero,
      stats: stats(f),
      streakLine: line(f.streak),
      title: f.title,
      again: f.again,
    };
  }
  return { snaps, final, reopened };
}
