import { createSaveStore } from '@noodle/core';

import {
  commitFinish,
  finishNote,
  liveStreak,
  playedCount,
  recordTime,
  reopenInfo,
  restoreCur,
  saveCur,
  shareRedact,
} from '../finishing';
import { apply, init, SAVE_KEY, STREAK_KEY, type RedactState } from '../model';
import { memoryKV } from '../simulate';
import { redact5 } from './fixtures';

const ID = 'DP·REDA·0005';
const NOW = Date.parse('2026-11-01T10:00:00Z');
const solved = (): RedactState =>
  redact5.black.reduce<RedactState>((s, i) => apply(s, { t: 'cell', i }), init(redact5));

describe('GIVEN a Redact being played', () => {
  it('WHEN a tap is made THEN the board is kept as the page keeps it; an emptied board gives its slot up', () => {
    const kv = memoryKV();
    const saves = createSaveStore(kv, { now: () => NOW });
    const s = apply(init(redact5), { t: 'cell', i: 0 });
    saveCur(kv, s, 41.6, saves, NOW);
    expect(JSON.parse(kv.getItem(SAVE_KEY)!).cur).toEqual({
      id: ID,
      b: [0],
      t: 1,
      m: 0,
      s: 42,
      at: NOW,
    });
    const back = restoreCur(kv, redact5)!;
    expect(back.state.black).toEqual([0]);
    expect(back.state.msg).toBe('Carrying on where you left off.');
    expect(back.secs).toBe(42);
    // untouched again (no taps): the slot goes
    saveCur(kv, init(redact5), 50, saves, NOW);
    expect(JSON.parse(kv.getItem(SAVE_KEY)!).cur).toBeUndefined();
    // nothing kept, nothing to clear: no write
    saveCur(kv, init(redact5), 50, saves, NOW);
    expect(restoreCur(kv, redact5)).toBeNull();
  });
  it('WHEN a kept board is another puzzle’s or junk THEN it isn’t used; bad squares are dropped', () => {
    const kv = memoryKV({ [SAVE_KEY]: { v: 1, cur: { id: 'DP·REDA·0001', b: [1] } } });
    expect(restoreCur(kv, redact5)).toBeNull();
    const kv2 = memoryKV({ [SAVE_KEY]: { v: 1, cur: { id: ID, b: [1, 1, -1, 99, 'x'] } } });
    expect(restoreCur(kv2, redact5)!.state.black).toEqual([1]);
    expect(restoreCur(memoryKV({ [SAVE_KEY]: 'junk' }), redact5)).toBeNull();
    const broken = { getItem: () => '{oops', setItem: () => {} };
    expect(restoreCur(broken, redact5)).toBeNull();
  });
});

describe('GIVEN a Redact solved', () => {
  it('THEN the result and streak are saved, the kept board cleared, and the sheet’s words made', () => {
    const kv = memoryKV({
      [SAVE_KEY]: { v: 1, cur: { id: ID, b: [0], t: 1, m: 0, s: 5 } },
      [STREAK_KEY]: { last: '2026-10-31', streak: 2, best: 4, dates: ['2026-10-31'] },
    });
    const saves = createSaveStore(kv, { now: () => NOW });
    const s = { ...solved(), misses: 2 };
    const f = commitFinish(s, 100.4, true, saves, kv, NOW);
    expect(f.first).toBe(true);
    expect(f.hero).toBe('1:40');
    expect(f.streak).toBe(3);
    expect(f.best).toBe(4);
    expect(f.share).toBe('⬛ Redact #5 — 1:40 · 🔥3');
    expect(f.note).toBe('2 wrong tries at the full count. Picked up where you left off.');
    expect(f.detail).toEqual({
      type: 'word-redact',
      tv: 3,
      outcome: 'solved',
      secs: 100,
      checks: 0,
      reveals: 0,
      hints: 0,
    });
    const save = JSON.parse(kv.getItem(SAVE_KEY)!);
    expect(save.cur).toBeUndefined();
    expect(save.done[ID]).toMatchObject({ t: '1:40', s: 100, m: 2 });
    expect(playedCount(kv)).toBe(1);
    // the same day again: the streak doesn't move, and it's no longer first
    const again = commitFinish(s, 50, false, saves, kv, NOW);
    expect(again.first).toBe(false);
    expect(again.streak).toBe(3);
    expect(liveStreak(kv, NOW)).toBe(3);
  });
  it('WHEN reopened THEN the saved time and tries show, no resumed note', () => {
    const kv = memoryKV({
      [STREAK_KEY]: { last: '2026-11-01', streak: 1, best: 1, dates: ['2026-11-01'] },
    });
    const r = reopenInfo(ID, { t: '2:05', s: 125, m: 1 }, kv, NOW);
    expect(r).toMatchObject({ hero: '2:05', note: '1 wrong try at the full count.', streak: 1 });
    expect(r.share).toBe('⬛ Redact #5 — 2:05');
    expect(recordTime({ t: 'nope' })).toBe('0:00');
    expect(reopenInfo(ID, {}, memoryKV(), NOW)).toMatchObject({ hero: '0:00', streak: 0, best: 0 });
  });
  it('THEN the note and share line read as the page’s', () => {
    expect(finishNote(0, false)).toBe('Right first time at the full count.');
    expect(finishNote(1, false)).toBe('1 wrong try at the full count.');
    expect(shareRedact('DP·REDA·0010', '0:59', 1)).toBe('⬛ Redact #10 — 0:59');
  });
});
