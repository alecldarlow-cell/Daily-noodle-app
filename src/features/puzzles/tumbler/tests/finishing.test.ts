import { createSaveStore } from '@noodle/core';

import {
  commitFinish,
  liveStreak,
  playedCount,
  recordTime,
  reopenInfo,
  restoreCur,
  saveCur,
  shareTumbler,
} from '../finishing';
import { apply, init, RESUME_MSG, SAVE_KEY, STREAK_KEY } from '../model';
import { memoryKV } from '../simulate';
import { tumbler25 } from './fixtures';

const AT = Date.parse('2026-11-11T09:00:00Z');
const ID = 'DP·TUMB·0025';

describe('GIVEN a Tumbler part-played', () => {
  it('WHEN it is kept and read back THEN the board, its words and the time return', () => {
    const kv = memoryKV();
    const saves = createSaveStore(kv, { now: () => AT });
    let s = apply(init(tumbler25), { t: 'turn', k: 1 });
    // nothing turned yet: nothing kept
    saveCur(kv, init(tumbler25), 5, saves, AT);
    expect(kv.getItem(SAVE_KEY)).toBeNull();
    saveCur(kv, s, 12.4, saves, AT);
    expect(JSON.parse(kv.getItem(SAVE_KEY)!).cur).toEqual({
      id: ID,
      o: [0, 6, 0, 0],
      w: [],
      t: 1,
      s: 12,
      at: AT,
    });
    s = { ...s, tries: ['toes', 'nope'] };
    saveCur(kv, s, 20, saves, AT);
    const back = restoreCur(kv, tumbler25)!;
    expect(back.secs).toBe(20);
    expect(back.state.off).toEqual([0, 6, 0, 0]);
    expect(back.state.tries).toEqual(['toes']); // a word off the list is dropped, as the page does
    expect(back.state.msg).toBe(RESUME_MSG);
    // another puzzle's board, or a broken one, isn't this one's
    expect(
      restoreCur(memoryKV({ [SAVE_KEY]: { v: 1, cur: { id: 'x', o: [0, 0, 0, 0] } } }), tumbler25),
    ).toBeNull();
    expect(
      restoreCur(memoryKV({ [SAVE_KEY]: { v: 1, cur: { id: ID, o: [0] } } }), tumbler25),
    ).toBeNull();
  });
  it('WHEN it is turned back to nothing kept THEN its slot is given up', () => {
    const kv = memoryKV({ [SAVE_KEY]: { v: 1, cur: { id: ID, o: [1, 0, 0, 0], w: [], t: 1 } } });
    const saves = createSaveStore(kv, { now: () => AT });
    saveCur(kv, init(tumbler25), 3, saves, AT);
    expect(JSON.parse(kv.getItem(SAVE_KEY)!).cur).toBeUndefined();
    expect(memoryKV({ [SAVE_KEY]: 'x' }).getItem(SAVE_KEY)).toBe('"x"');
  });
});

describe('GIVEN a Tumbler solved', () => {
  it('WHEN it is committed THEN the result, streak, note and share line are the page’s', () => {
    const kv = memoryKV({ [SAVE_KEY]: { v: 1, cur: { id: ID, o: [], w: [], t: 2 } } });
    const saves = createSaveStore(kv, { now: () => AT });
    const s = { ...init(tumbler25), tries: ['toes', 'lets'], turns: 9, solved: true };
    const f = commitFinish(s, 61.6, true, saves, kv, AT);
    expect(f.hero).toBe('1:02');
    expect(f.note).toBe('2 submits, 9 turns. Picked up where you left off.');
    expect(f.share).toBe('🎛️ Tumbler #25 — 1:02 · 2 submits');
    expect(f.first).toBe(true);
    expect(f.detail).toEqual({
      type: 'word-tumbler',
      tv: 3,
      outcome: 'solved',
      secs: 62,
      checks: 0,
      reveals: 0,
      hints: 0,
    });
    const save = JSON.parse(kv.getItem(SAVE_KEY)!);
    expect(save.done[ID]).toEqual({ t: '1:02', s: 62, n: 2, w: ['toes', 'lets'], d: '2026-11-11' });
    expect(save.cur).toBeUndefined();
    expect(JSON.parse(kv.getItem(STREAK_KEY)!)).toMatchObject({ last: '2026-11-11', streak: 1 });
    expect(playedCount(kv)).toBe(1);
    // reopened
    const r = reopenInfo(tumbler25, save.done[ID], kv, AT);
    expect(r).toMatchObject({
      hero: '1:02',
      note: '2 submits.',
      tries: ['toes', 'lets'],
      streak: 1,
    });
    expect(reopenInfo(tumbler25, { t: 'x' }, kv, AT).tries).toEqual(['lets']);
    expect(recordTime({ t: 'x' })).toBe('0:00');
  });
  it('WHEN the streak runs THEN the share line carries the flame from two', () => {
    expect(shareTumbler(ID, '0:41', 1, 1)).toBe('🎛️ Tumbler #25 — 0:41 · 1 submit');
    expect(shareTumbler(ID, '0:41', 3, 4)).toBe('🎛️ Tumbler #25 — 0:41 · 3 submits · 🔥4');
    const kv = memoryKV({ [STREAK_KEY]: { last: '2026-11-10', streak: 3, best: 3 } });
    expect(liveStreak(kv, AT)).toBe(3);
    expect(liveStreak(memoryKV({ [STREAK_KEY]: 'x' }), AT)).toBe(0);
  });
});
