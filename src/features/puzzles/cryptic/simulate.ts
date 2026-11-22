/**
 * The native half of the differential replay: plays a scenario's moves through the model on
 * a fake clock, as the screen does on a real one, and reports the board after every move and
 * the finish in the shape `scripts/replay/cryptic.js` reads from the page. The clock follows
 * the page's: it starts on Play and its text moves on a 250 ms tick.
 */
import { createSaveStore, type KV } from '@noodle/core';

import { commitFinish, liveStreak, reopenInfo, restoreCur, saveCur } from './finishing';
import {
  apply,
  crypticNumber,
  hintsText,
  init,
  locked,
  message,
  revealed,
  SAVE_KEY,
  spanChars,
  STREAK_KEY,
  timerText,
  tip,
  TYPE_NAME,
  type CrypticData,
  type CrypticState,
} from './model';
import type { Scenario } from './oracle';

const TICK_MS = 250;

export interface Snapshot {
  letters: string[];
  cur: number;
  locks: number;
  def: string;
  hint: string;
  hintOff: boolean;
  panel: string;
  msg: string;
  timer: string;
  streak: string;
  sheet: boolean;
}

export function snapshot(
  s: CrypticState,
  msg: string,
  timer: string,
  streak: number,
  sheet: boolean,
): Snapshot {
  const p = s.p;
  const d = s.hints >= 1 ? spanChars(p.clue, p.def) : null;
  return {
    letters: s.letters.slice(),
    cur: !s.solved && !locked(s, s.cur) ? s.cur : -1,
    locks: revealed(s),
    def: d ? p.clue.slice(d[0], d[1]) : '',
    hint: s.hints < 2 ? `Hint ${s.hints + 1} of 3` : 'Reveal a letter',
    hintOff: s.solved || revealed(s) >= p.n,
    panel: s.hints < 2 ? '' : `${TYPE_NAME[p.kind]}|${tip(p)}|${hintsText(s.hints)} used`,
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

const changed = (a: CrypticState, b: CrypticState) =>
  a.letters !== b.letters || a.hints !== b.hints;

export function simulate(
  data: CrypticData,
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
      ended = commitFinish(state, elapsed, !!resumed, saves, kv, now, resumed?.state.hints ?? 0);
      streak = ended.streak;
    }
    now += step.ms;
    const ticks = Math.floor((now - playAt) / TICK_MS);
    const timer = ended ? ended.hero : timerText(base + (ticks * TICK_MS) / 1000);
    snaps.push(
      snapshot(state, ended ? `Solved in ${ended.hero}.` : message(state), timer, streak, !!ended),
    );
  }
  if (!ended) throw new Error(`simulate: ${sc.variant} never finished ${data.id}`);
  const d = spanChars(data.clue, data.def)!;
  const sol = state.sol;
  const recap = [
    sol.a,
    `${data.clue.slice(d[0], d[1])}, ${data.def[0] === 0 ? 'at the start' : 'at the end'}`,
    sol.explain[0],
    sol.explain[1],
    `Clue type: ${TYPE_NAME[data.kind]}`,
  ];
  const final = {
    save: JSON.parse(kv.getItem(SAVE_KEY) || 'null') as unknown,
    streak: JSON.parse(kv.getItem(STREAK_KEY) || 'null') as unknown,
    end: ended.detail,
    share: ended.share,
    // the web's note is only the resume line; the app also puts the hints there (the web shows them by the time)
    note: resumed ? 'Picked up where you left off.' : '',
    hero: ended.hero,
    hints: hintsText(ended.hints),
    title: 'Solved',
    kick: `Cryptic ${crypticNumber(data.id)}`,
    recap,
  };
  let reopened: Pick<typeof final, 'share' | 'hero' | 'hints' | 'recap'> | null = null;
  if (sc.reopen) {
    const r = reopenInfo(data, saves.getDone(SAVE_KEY, data.id)!, kv, now);
    reopened = { share: r.share, hero: r.hero, hints: hintsText(r.hints), recap };
  }
  return { snaps, final, reopened };
}
