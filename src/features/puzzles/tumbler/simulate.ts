/**
 * The native half of the differential replay: plays a scenario's moves through the model on
 * a fake clock, as the screen does on a real one, and reports the board after every move and
 * the finish in the shape `scripts/replay.js` reads from the page. The clock follows the
 * page's: it starts on Play and its text moves on a 250 ms tick.
 */
import { createSaveStore, type KV } from '@noodle/core';

import { commitFinish, liveStreak, reopenInfo, restoreCur, saveCur } from './finishing';
import {
  apply,
  clue,
  init,
  letter,
  SAVE_KEY,
  STREAK_KEY,
  timerText,
  tumblerNumber,
  type TumblerData,
  type TumblerState,
} from './model';
import type { Scenario } from './oracle';

const TICK_MS = 250;

export interface Snapshot {
  wheels: string[];
  tries: string[];
  msg: string;
  timer: string;
  streak: string;
  sheet: boolean;
}

/** Each submitted row as the page draws it, newest first: letters with their clue, its number. */
export function triesRows(s: Pick<TumblerState, 'tries' | 'p'>): string[] {
  const n = s.tries.length;
  return s.tries
    .slice()
    .reverse()
    .map(
      (w, j) =>
        clue(w, s.p.secret)
          .map((c, i) => w[i]!.toUpperCase() + c)
          .join('') + `|submit ${n - j}`,
    );
}

export function snapshot(
  s: TumblerState,
  msg: string,
  timer: string,
  streak: number,
  sheet: boolean,
): Snapshot {
  return {
    wheels: s.p.wheels.map((_, k) =>
      Array.from({ length: s.size }, (_x, i) => letter(s, k, i)).join(''),
    ),
    tries: triesRows(s),
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

const changed = (a: TumblerState, b: TumblerState) =>
  a.off !== b.off || a.tries !== b.tries || a.turns !== b.turns;

export function simulate(
  data: TumblerData,
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
    if (changed(before, state) && !state.solved) saveCur(kv, state, elapsed, saves, now);
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
    kick: `Tumbler ${tumblerNumber(data.id)}`,
    recap: ended.tries,
  };
  let reopened: Pick<typeof final, 'share' | 'note' | 'hero' | 'recap'> | null = null;
  if (sc.reopen) {
    const r = reopenInfo(data, saves.getDone(SAVE_KEY, data.id)!, kv, now);
    reopened = { share: r.share, note: r.note, hero: r.hero, recap: r.tries };
  }
  return { snaps, final, reopened };
}
