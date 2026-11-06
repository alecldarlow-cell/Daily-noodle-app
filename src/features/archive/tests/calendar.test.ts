import { PUZZLE_TYPES } from '@noodle/core';

import { addMonth, archiveDays, monthCells, monthRange } from '../hooks/calendar';
import { FEED_LITE } from './fixtures';

const items = FEED_LITE.items;

describe('GIVEN the archive list', () => {
  describe('WHEN it is grouped into days before today', () => {
    it('THEN today and later never appear, and each day is in the daily order', () => {
      const days = archiveDays(items, '2026-10-24', null, PUZZLE_TYPES);
      expect(days['2026-10-24']).toBeUndefined();
      expect(Object.keys(days).sort()).toEqual(['2026-07-19', '2026-09-01', '2026-10-19']);
      const all = archiveDays(items, '2026-10-25', null, PUZZLE_TYPES);
      expect(all['2026-10-24']!.map((it) => it.type)).toEqual(['mini', 'sweep']);
      expect(archiveDays(items, '2026-10-25', 'sweep', PUZZLE_TYPES)['2026-10-24']!.length).toBe(1);
      expect(monthRange(all)).toEqual({ first: '2026-07', last: '2026-10' });
      expect(monthRange({})).toBeNull();
    });
  });

  describe('WHEN a month is laid out', () => {
    it('THEN it starts on Monday and counts what is finished each day', () => {
      const days = archiveDays(items, '2026-10-25', null, PUZZLE_TYPES);
      const cells = monthCells('2026-10', days, new Set(['DP·MINI·0105']));
      // 1 Oct 2026 is a Thursday: three blanks before it.
      expect(cells.slice(0, 4).map((c) => c.kind)).toEqual(['blank', 'blank', 'blank', 'none']);
      expect(cells.length).toBe(3 + 31);
      expect(cells.find((c) => c.key === '2026-10-24')).toMatchObject({
        kind: 'day',
        total: 2,
        done: 1,
      });
      expect(cells.find((c) => c.key === '2026-10-19')).toMatchObject({
        kind: 'day',
        total: 1,
        done: 0,
      });
    });
  });

  describe('WHEN months are stepped across a year', () => {
    it('THEN they roll over both ways', () => {
      expect(addMonth('2026-12', 1)).toBe('2027-01');
      expect(addMonth('2027-01', -1)).toBe('2026-12');
      expect(addMonth('2026-10', -10)).toBe('2025-12');
    });
  });
});
