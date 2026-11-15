import { createSaveStore } from '@noodle/core';

import {
  commitFinish,
  finishNote,
  liveStreak,
  outMsg,
  recordTime,
  reopenInfo,
  restoreCur,
  saveCur,
  shareTilt,
} from '../finishing';
import { apply, init, RESUME_MSG, SAVE_KEY, STREAK_KEY } from '../model';
import { route } from '../oracle';
import { memoryKV } from '../simulate';
import { tilt5 } from './fixtures';

const ID = 'DP·TILT·0005';
const AT = Date.parse('2026-11-01T10:00:00Z');
const setup = (seed: Record<string, unknown> = {}) => {
  const kv = memoryKV(seed);
  return { kv, saves: createSaveStore(kv, { now: () => AT }) };
};
const doc = (kv: ReturnType<typeof memoryKV>, k: string) =>
  JSON.parse(kv.getItem(k) || 'null') as Record<string, unknown>;

describe('GIVEN a maze part-turned', () => {
  it('WHEN it is kept THEN cur has the page’s shape, and it comes back as it was', () => {
    const { kv, saves } = setup();
    const s = apply(apply(init(tilt5), { t: 'turn', dir: 1 }), { t: 'turn', dir: 1 });
    saveCur(kv, s, 12.4, saves, AT);
    expect(doc(kv, SAVE_KEY)).toEqual({
      v: 1,
      cur: { id: ID, pos: s.pos, g: s.g, rot: 2, n: 2, trail: s.trail, s: 12, at: AT },
    });
    const back = restoreCur(kv, tilt5)!;
    expect(back.secs).toBe(12);
    expect(back.state).toMatchObject({ pos: s.pos, g: s.g, rot: 2, turns: 2, msg: RESUME_MSG });
    expect(back.state.trail).toEqual(s.trail);
  });
  it('WHEN it is turned back to nothing THEN its slot is given up; nothing kept for nothing', () => {
    const { kv, saves } = setup();
    saveCur(kv, init(tilt5), 0, saves, AT);
    expect(kv.getItem(SAVE_KEY)).toBeNull();
    saveCur(kv, apply(init(tilt5), { t: 'turn', dir: 1 }), 3, saves, AT);
    saveCur(kv, init(tilt5), 4, saves, AT);
    expect(doc(kv, SAVE_KEY).cur).toBeUndefined();
  });
  it('WHEN the kept maze is another’s or broken THEN nothing is restored', () => {
    const cur = (c: unknown) => setup({ [SAVE_KEY]: { v: 1, cur: c } }).kv;
    expect(restoreCur(cur({ id: 'DP·TILT·0004', pos: [1, 1], g: 0 }), tilt5)).toBeNull();
    expect(restoreCur(cur({ id: ID, pos: [11, 1], g: 0 }), tilt5)).toBeNull();
    expect(restoreCur(cur({ id: ID, pos: [1, 1], g: 5 }), tilt5)).toBeNull();
    expect(restoreCur(cur({ id: ID, pos: [1] }), tilt5)).toBeNull();
    const ok = restoreCur(
      cur({ id: ID, pos: [1, 1], g: 1, rot: 'x', trail: ['1,1', 2, '1,1'] }),
      tilt5,
    )!;
    expect(ok.state).toMatchObject({ rot: 0, turns: 0, trail: ['1,1'] });
    expect(ok.secs).toBe(0);
    expect(restoreCur(setup({ [SAVE_KEY]: 'nope' }).kv, tilt5)).toBeNull();
  });
});

describe('GIVEN the ball goes out', () => {
  const solved = () => {
    let s = init(tilt5);
    for (const dir of route(s)) s = apply(s, { t: 'turn', dir });
    return s;
  };
  it('WHEN it is the first finish THEN the record, streak, note and share line are the page’s', () => {
    const { kv, saves } = setup({
      [STREAK_KEY]: { last: '2026-10-31', streak: 2, best: 2, dates: ['2026-10-31'] },
    });
    saveCur(kv, apply(init(tilt5), { t: 'turn', dir: 1 }), 3, saves, AT);
    const f = commitFinish(solved(), 64.6, true, saves, kv, AT);
    expect(f.first).toBe(true);
    expect(f.hero).toBe('1:05');
    expect(f.streak).toBe(3);
    expect(f.note).toBe(
      '12 turns, against a shortest way out of 12. Picked up where you left off.',
    );
    expect(f.share).toBe('🌀 Tilt #5 — 1:05 · 12 turns · 🔥3');
    expect(f.detail).toEqual({
      type: 'logic-tilt',
      tv: 3,
      outcome: 'solved',
      secs: 65,
      checks: 0,
      reveals: 0,
      hints: 0,
    });
    const save = doc(kv, SAVE_KEY);
    expect((save.done as Record<string, unknown>)[ID]).toMatchObject({ t: '1:05', s: 65, n: 12 });
    expect(save.cur).toBeUndefined();
    expect(f.played).toBe(1);
    expect(liveStreak(kv, AT)).toBe(3);
    // reopened: its time and turns, no "picked up"
    const r = reopenInfo(tilt5, saves.getDone(SAVE_KEY, ID)!, kv, AT);
    expect(r).toMatchObject({ hero: '1:05', turns: 12, streak: 3, best: 3 });
    expect(r.note).toBe('12 turns, against a shortest way out of 12.');
    // and a finished maze keeps no round
    saveCur(kv, apply(init(tilt5), { t: 'turn', dir: 1 }), 1, saves, AT);
    expect(doc(kv, SAVE_KEY).cur).toBeUndefined();
  });
  it('THEN the small words read as the page’s', () => {
    expect(recordTime({ t: 'x' })).toBe('0:00');
    expect(recordTime({ t: '2:10' })).toBe('2:10');
    expect(outMsg('1:05', 0)).toBe('Out in 1:05.');
    expect(outMsg('1:05', 1)).toBe('Out in 1:05, 1 turn.');
    expect(finishNote(3, 12, false)).toBe('3 turns, against a shortest way out of 12.');
    expect(shareTilt(ID, '0:41', 1, '1')).toBe('🌀 Tilt #5 — 0:41 · 1 turn');
    const { kv } = setup();
    expect(reopenInfo(tilt5, { t: '0:30' }, kv, AT)).toMatchObject({ turns: 0, best: 0 });
  });
});
