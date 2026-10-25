import { createSaveStore } from '@noodle/core';

import { commitFinish, ensureStreak, readStreak, reopenInfo } from '../finishing';
import { apply, init, SAVE_KEY, STREAK_KEY, type DokuState } from '../model';
import { memoryKV } from '../simulate';
import { doku97, openSquares } from './fixtures';

const NOW = Date.parse('2026-10-18T08:30:00Z');

function solved(): DokuState {
  let s = init(doku97);
  for (const [r, c] of openSquares(doku97)) {
    const t = s.tiles.find((t) => !t.at && t.ch === doku97.grid[r]![c]);
    s = apply(apply(s, { t: 'tile', id: t!.id }), { t: 'cell', r, c });
  }
  return s;
}

describe('GIVEN Doku’s own streak', () => {
  describe('WHEN it is read for the first time and Doku has dated results', () => {
    it('THEN it is rebuilt from them and written', () => {
      const kv = memoryKV({
        [SAVE_KEY]: {
          v: 1,
          done: {
            'DP·LEXI·0095': { s: 40, d: '2026-10-16' },
            'DP·LEXI·0096': { s: 50, d: '2026-10-17' },
            'DP·LEXI·0001': { s: 50 },
          },
        },
        'digi-mini-streak': { last: '2026-10-17', streak: 5, best: 5, dates: [], tz: 'L' },
      });
      expect(readStreak(kv)).toEqual({
        last: '2026-10-17',
        streak: 2,
        best: 2,
        dates: ['2026-10-16', '2026-10-17'],
        tz: 'L',
        seeded: 1,
      });
      expect(JSON.parse(kv.getItem(STREAK_KEY)!)).toMatchObject({ seeded: 1 });
      expect(JSON.parse(kv.getItem('digi-mini-streak')!)).toMatchObject({ streak: 5 });
    });
  });

  describe('WHEN there is nothing to seed from, or a streak already', () => {
    it('THEN nothing is written', () => {
      const empty = memoryKV();
      ensureStreak(empty);
      expect(empty.getItem(STREAK_KEY)).toBeNull();
      expect(readStreak(empty)).toBeNull();
      const kept = memoryKV({
        [SAVE_KEY]: { v: 1, done: { 'DP·LEXI·0095': { s: 40, d: '2026-10-16' } } },
        [STREAK_KEY]: { last: '2026-10-10', streak: 9, best: 9, dates: [], tz: 'L' },
      });
      expect(readStreak(kept)).toMatchObject({ streak: 9 });
    });
    it('THEN a storage that throws is ignored, as the page ignores it', () => {
      const broken = {
        getItem: () => {
          throw new Error('no storage');
        },
        setItem: () => undefined,
      };
      expect(() => ensureStreak(broken)).not.toThrow();
    });
  });
});

describe('GIVEN a Doku just solved', () => {
  describe('WHEN it is the puzzle’s first finish on a fresh phone', () => {
    it('THEN the record is saved, the streak seeded from it, and it counts as the first', () => {
      const kv = memoryKV();
      const saves = createSaveStore(kv, { now: () => NOW });
      const f = commitFinish(solved(), 87, saves, kv, NOW);
      expect(f.first).toBe(true);
      expect(JSON.parse(kv.getItem(SAVE_KEY)!)).toEqual({
        v: 1,
        done: { 'DP·LEXI·0097': { s: 87, d: '2026-10-18' } },
      });
      expect(JSON.parse(kv.getItem(STREAK_KEY)!)).toEqual({
        last: '2026-10-18',
        streak: 1,
        best: 1,
        dates: ['2026-10-18'],
        tz: 'L',
        seeded: 1,
      });
      expect(f).toMatchObject({
        hero: '1:27',
        note: 'All twelve tiles placed.',
        share: '🔢 Doku #97 — 1:27',
        played: 1,
        streak: 1,
        best: 1,
      });
      expect(f.detail).toMatchObject({ type: 'logic-doku', outcome: 'solved', secs: 87 });
    });
  });

  describe('WHEN a streak runs on from yesterday', () => {
    it('THEN it grows and the share line shows the flame', () => {
      const kv = memoryKV({
        [STREAK_KEY]: { last: '2026-10-17', streak: 3, best: 4, dates: ['2026-10-17'], tz: 'L' },
      });
      const saves = createSaveStore(kv, { now: () => NOW });
      const f = commitFinish(solved(), 61, saves, kv, NOW);
      expect(f).toMatchObject({ streak: 4, best: 4, share: '🔢 Doku #97 — 1:01 · 🔥4' });
    });
  });

  describe('WHEN it had been finished before and today is already counted', () => {
    it('THEN the first record is kept, the streak untouched, and it is not a first finish', () => {
      const streak = { last: '2026-10-18', streak: 3, best: 3, dates: ['2026-10-18'], tz: 'L' };
      const kv = memoryKV({
        [SAVE_KEY]: { v: 1, done: { 'DP·LEXI·0097': { s: 40, d: '2026-10-18' } } },
        [STREAK_KEY]: streak,
      });
      const saves = createSaveStore(kv, { now: () => NOW });
      const f = commitFinish(solved(), 99, saves, kv, NOW);
      expect(f.first).toBe(false);
      expect(f.rec).toEqual({ s: 40, d: '2026-10-18' });
      expect(JSON.parse(kv.getItem(STREAK_KEY)!)).toEqual(streak);
    });
  });

  describe('WHEN a finished Doku is reopened', () => {
    it('THEN its sheet shows the first time, the saved streak and no note', () => {
      const kv = memoryKV({
        [SAVE_KEY]: { v: 1, done: { 'DP·LEXI·0097': { s: 125, d: '2026-10-18' } } },
      });
      const info = reopenInfo('DP·LEXI·0097', { s: 125, d: '2026-10-18' }, kv);
      expect(info).toMatchObject({
        hero: '2:05',
        note: '',
        share: '🔢 Doku #97 — 2:05',
        streak: 1,
        best: 1,
        played: 1,
      });
      // reading it seeded the streak, as the page's restoreDone does
      expect(kv.getItem(STREAK_KEY)).not.toBeNull();
    });
  });
});
