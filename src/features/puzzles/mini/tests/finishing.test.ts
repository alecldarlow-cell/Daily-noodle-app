import { createSaveStore } from '@noodle/core';

import { commitFinish, readStreak, reopenInfo } from '../finishing';
import { allCells, apply, init, SAVE_KEY, STREAK_KEY, type MiniState } from '../model';
import { memoryKV } from '../simulate';
import { mini105 } from './fixtures';

const NOW = Date.parse('2026-10-24T08:30:00Z');

function solved(): MiniState {
  let s = init(mini105);
  for (const [r, c] of allCells(s.p))
    s = apply(apply(s, { t: 'cell', r, c }), { t: 'key', ch: mini105.grid[r]![c]! });
  return s;
}

describe('GIVEN a Mini just solved', () => {
  describe('WHEN it is the puzzle’s first finish', () => {
    it('THEN the record, streak and sheet are written and it counts as the first', () => {
      const kv = memoryKV();
      const saves = createSaveStore(kv, { now: () => NOW });
      const f = commitFinish(solved(), 87, saves, kv, NOW);
      expect(f.first).toBe(true);
      expect(JSON.parse(kv.getItem(SAVE_KEY)!)).toEqual({
        v: 1,
        done: { 'DP·MINI·0105': { s: 87, d: '2026-10-24' } },
      });
      expect(readStreak(kv)).toMatchObject({ last: '2026-10-24', streak: 1, best: 1 });
      expect(f).toMatchObject({ hero: '1:27', share: '✏️ Mini #105 — 1:27', played: 1, streak: 1 });
      expect(f.detail).toMatchObject({ type: 'crossword-mini', outcome: 'solved', secs: 87 });
    });
  });

  describe('WHEN it had been finished before (played again on another screen)', () => {
    it('THEN the first record is kept and it does not count as a first finish', () => {
      const kv = memoryKV({
        [SAVE_KEY]: { v: 1, done: { 'DP·MINI·0105': { s: 40, d: '2026-10-24' } } },
        [STREAK_KEY]: { last: '2026-10-24', streak: 3, best: 3, dates: ['2026-10-24'], tz: 'L' },
      });
      const saves = createSaveStore(kv, { now: () => NOW });
      const f = commitFinish(solved(), 99, saves, kv, NOW);
      expect(f.first).toBe(false);
      expect(f.rec).toEqual({ s: 40, d: '2026-10-24' });
      expect(f.streak).toBe(3);
      expect(f.share).toBe('✏️ Mini #105 — 1:39 · 🔥3');
    });
  });
});

describe('GIVEN a finished Mini reopened', () => {
  it('THEN it shows the saved time and streak with no note', () => {
    const kv = memoryKV({ [STREAK_KEY]: { last: '2026-10-24', streak: 2, best: 5, dates: [] } });
    expect(reopenInfo('DP·MINI·0105', { s: 605, d: '2026-10-24' }, kv)).toEqual({
      id: 'DP·MINI·0105',
      hero: '10:05',
      note: '',
      share: '✏️ Mini #105 — 10:05 · 🔥2',
      streak: 2,
      best: 5,
      played: 0,
      rec: { s: 605, d: '2026-10-24' },
    });
  });

  it('THEN an unreadable streak counts as none', () => {
    const kv = memoryKV();
    kv.setItem(STREAK_KEY, '{oops');
    expect(readStreak(kv)).toBeNull();
    expect(reopenInfo('DP·MINI·0105', { s: 5 }, kv)).toMatchObject({ streak: 0, best: 0 });
  });
});
