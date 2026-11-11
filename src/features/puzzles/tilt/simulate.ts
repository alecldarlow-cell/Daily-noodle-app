/**
 * The native half of the differential replay: plays a scenario's moves through the model
 * on a fake clock, as the screen does on a real one, and reports the board after every
 * move and the finish in the shape `scripts/replay.js` reads from the page. The clock
 * follows the page's: it starts on Play and its text moves on a 250 ms tick; the ball goes
 * out after the page's quarter turn, roll and exit.
 */
import { createSaveStore, type KV } from '@noodle/core';

import { streakLine } from '@/shared/finish-sheet/rules';

import { commitFinish, liveStreak, outMsg, reopenInfo, restoreCur, saveCur } from './finishing';
import {
  apply,
  ballAt,
  init,
  SAVE_KEY,
  STREAK_KEY,
  tiltNumber,
  timerText,
  turnTime,
  type TiltData,
  type TiltState,
} from './model';
import type { Scenario } from './oracle';

const TICK_MS = 250;

export interface Snapshot {
  /** The shaded squares, as indices r·n+c, ascending. */
  trail: string;
  /** The ball's centre in drawing units. */
  ball: string;
  rot: number;
  turns: string;
  undoOff: boolean;
  msg: string;
  timer: string;
  streak: string;
  sheet: boolean;
}

export const trailCode = (s: TiltState) =>
  s.trail
    .map((k) => {
      const [r, c] = k.split(',').map(Number);
      return r! * s.p.n + c!;
    })
    .sort((a, b) => a - b)
    .join(' ');

export function snapshot(
  s: TiltState,
  msg: string,
  timer: string,
  streak: number,
  sheet: boolean,
): Snapshot {
  const [x, y] = ballAt(s, sheet);
  return {
    trail: trailCode(s),
    ball: `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`,
    rot: s.rot,
    turns: String(s.turns),
    undoOff: !s.hist.length || s.solved,
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

const line = (n: number) => streakLine([{ value: n, label: 'day streak' }], 'Tilt');

export function simulate(
  data: TiltData,
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
    const before = state;
    state = apply(state, step.move);
    // the page saves once the turn has played out; Undo saves at once
    const at = now + (step.move.t === 'turn' ? turnTime(state) : 0);
    clockNow = at;
    const elapsed = base + (at - playAt) / 1000;
    if (state !== before && !state.solved) saveCur(kv, state, elapsed, saves, at);
    if (state.solved && !before.solved) {
      ended = commitFinish(state, elapsed, !!resumed, saves, kv, at);
      streak = ended.streak;
    }
    now += step.ms;
    const ticks = Math.floor((now - playAt) / TICK_MS);
    const timer = ended ? ended.hero : timerText(base + (ticks * TICK_MS) / 1000);
    snaps.push(
      snapshot(state, ended ? outMsg(ended.hero, state.turns) : state.msg, timer, streak, !!ended),
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
    title: 'Out',
    kick: `Tilt ${tiltNumber(data.id)}`,
    streakLine: line(ended.streak),
  };
  let reopened: Pick<typeof final, 'share' | 'note' | 'hero' | 'streakLine'> | null = null;
  if (sc.reopen) {
    const r = reopenInfo(data, saves.getDone(SAVE_KEY, data.id)!, kv, now);
    reopened = { share: r.share, note: r.note, hero: r.hero, streakLine: line(r.streak) };
  }
  return { snaps, final, reopened };
}
