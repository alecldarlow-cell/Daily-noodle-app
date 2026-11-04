/**
 * The native half of the differential replay: plays a scenario's moves through the model
 * on a fake clock, as the screen does on a real one, and reports the board after every
 * move and the finish in the shape `scripts/replay.js` reads from the page. The clock
 * follows the page's: it starts on Play and its text moves on a 250 ms tick.
 */
import { createSaveStore, type KV } from '@noodle/core';

import { streakLine } from '@/shared/finish-sheet/rules';

import { commitFinish, liveStreak, reopenInfo, restoreCur, saveCur } from './finishing';
import {
  apply,
  init,
  SAVE_KEY,
  STREAK_KEY,
  tallyNumber,
  timerText,
  view,
  type TallyData,
  type TallyState,
} from './model';
import type { Scenario } from './oracle';

const TICK_MS = 250;

/** One square: number or '.', then its marks, then the notes showing and its clue's state. */
export function squareCode(s: TallyState, i: number, c: ReturnType<typeof view>[number]): string {
  return (
    (c.v ? String(c.v) : '.') +
    (c.bad ? '!' : '') +
    (c.sel ? '*' : '') +
    (c.cage ? 'c' : '') +
    (c.peer ? 'p' : '') +
    (c.same ? '=' : '') +
    (s.notes[i] ? `n${s.notes[i]}` : '') +
    (c.clueState ? `:${c.clueState}` : '')
  );
}

export interface Snapshot {
  cells: string;
  notesOn: boolean;
  undoOff: boolean;
  msg: string;
  timer: string;
  streak: string;
  sheet: boolean;
}

export function snapshot(
  s: TallyState,
  msg: string,
  timer: string,
  streak: number,
  sheet: boolean,
): Snapshot {
  return {
    cells: view(s)
      .map((c, i) => squareCode(s, i, c))
      .join(' '),
    notesOn: s.notesMode,
    undoOff: !s.undo.length,
    msg,
    timer,
    streak: String(streak),
    sheet,
  };
}

export function memoryKV(seed: Record<string, unknown> = {}): KV {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) m.set(k, JSON.stringify(v));
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const line = (n: number) => streakLine([{ value: n, label: 'day streak' }]);

export function simulate(
  data: TallyData,
  sc: Scenario,
  openAt: number,
  playAt: number,
  firstAt: number,
) {
  const kv = memoryKV(sc.seed);
  let clockNow = openAt;
  const saves = createSaveStore(kv, { now: () => clockNow });
  let streak = liveStreak(kv, openAt);
  const resumed = restoreCur(kv, data);
  let state = resumed?.state ?? init(data);
  const base = resumed?.secs ?? 0;
  let now = firstAt;
  let ended: ReturnType<typeof commitFinish> | null = null;
  const snaps: Snapshot[] = [];
  for (const step of sc.steps) {
    clockNow = now;
    const before = state;
    state = apply(state, step.move);
    const elapsed = base + (now - playAt) / 1000;
    if (state !== before && !state.solved) saveCur(kv, state, elapsed, saves, now);
    if (state.solved && !before.solved) {
      ended = commitFinish(state, elapsed, !!resumed, saves, kv, now);
      streak = ended.streak;
    }
    now += step.ms;
    const ticks = Math.floor((now - playAt) / TICK_MS);
    const timer = ended ? ended.hero : timerText(base + (ticks * TICK_MS) / 1000);
    snaps.push(
      snapshot(state, ended ? `Solved in ${ended.hero}.` : state.msg, timer, streak, !!ended),
    );
  }
  if (!ended) throw new Error(`simulate: ${sc.variant} never finished ${data.id}`);
  const final = {
    save: JSON.parse(kv.getItem(SAVE_KEY) || 'null') as unknown,
    streak: JSON.parse(kv.getItem(STREAK_KEY) || 'null') as unknown,
    end: ended.detail,
    share: ended.share,
    note: ended.note,
    hero: ended.hero,
    title: 'Solved',
    kick: `Tally ${tallyNumber(data.id)}`,
    streakLine: line(ended.streak),
  };
  let reopened: Pick<typeof final, 'share' | 'note' | 'hero' | 'streakLine'> | null = null;
  if (sc.reopen) {
    const r = reopenInfo(data.id, saves.getDone(SAVE_KEY, data.id)!, kv, now);
    reopened = { share: r.share, note: r.note, hero: r.hero, streakLine: line(r.streak) };
  }
  return { snaps, final, reopened };
}
