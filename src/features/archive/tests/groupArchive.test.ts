import { groupArchive } from '../hooks/groupArchive';
import { ITEMS } from './fixtures';

describe('GIVEN the released puzzles', () => {
  describe('WHEN grouped with no filter', () => {
    it('THEN months run newest first, puzzles newest first within them', () => {
      const s = groupArchive(ITEMS, null);
      expect(s.map((x) => x.title)).toEqual(['October 2026', 'September 2026', 'July 2026']);
      expect(s[0]!.data.map((x) => x.headline)).toEqual(['Mini 105', 'Sweep 100', 'Mini 100']);
    });
  });

  describe('WHEN filtered to one type', () => {
    it('THEN only that type remains', () => {
      const s = groupArchive(ITEMS, 'mini');
      expect(s.flatMap((x) => x.data).every((x) => x.type === 'mini')).toBe(true);
      expect(s.flatMap((x) => x.data)).toHaveLength(3);
    });
  });

  describe('WHEN filtered by done or not', () => {
    it('THEN Done keeps only finished puzzles, Not done the rest, alongside the type', () => {
      const done = new Set(['DP·MINI·0105', 'DP·PATH·0050']);
      const ids = (s: ReturnType<typeof groupArchive>) => s.flatMap((x) => x.data.map((d) => d.id));
      expect(ids(groupArchive(ITEMS, null, 'done', done)).sort()).toEqual([...done].sort());
      expect(ids(groupArchive(ITEMS, null, 'todo', done))).toEqual([
        'DP·SWEEP·2026-10-24',
        'DP·MINI·0100',
        'DP·MINI·0010',
      ]);
      expect(ids(groupArchive(ITEMS, 'mini', 'todo', done))).toEqual([
        'DP·MINI·0100',
        'DP·MINI·0010',
      ]);
      expect(ids(groupArchive(ITEMS, null, 'all', done))).toHaveLength(ITEMS.length);
    });
  });
});
