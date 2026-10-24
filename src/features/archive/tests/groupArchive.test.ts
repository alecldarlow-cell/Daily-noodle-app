import { groupArchive } from '../hooks/groupArchive';
import { ITEMS } from './fixtures';

describe('GIVEN the released puzzles', () => {
  describe('WHEN grouped with no filter', () => {
    it('THEN months run newest first, puzzles newest first within them', () => {
      const s = groupArchive(ITEMS, null, '');
      expect(s.map((x) => x.title)).toEqual(['October 2026', 'September 2026', 'July 2026']);
      expect(s[0]!.data.map((x) => x.headline)).toEqual(['Mini 105', 'Sweep 100', 'Mini 100']);
    });
  });

  describe('WHEN filtered to one type', () => {
    it('THEN only that type remains', () => {
      const s = groupArchive(ITEMS, 'mini', '');
      expect(s.flatMap((x) => x.data).every((x) => x.type === 'mini')).toBe(true);
      expect(s.flatMap((x) => x.data)).toHaveLength(3);
    });
  });

  describe('WHEN searched by number', () => {
    it('THEN numbers starting with the digits match, across types', () => {
      expect(groupArchive(ITEMS, null, '10').flatMap((x) => x.data.map((d) => d.headline))).toEqual(
        ['Mini 105', 'Sweep 100', 'Mini 100', 'Mini 10'],
      );
      expect(
        groupArchive(ITEMS, 'mini', '#105').flatMap((x) => x.data.map((d) => d.headline)),
      ).toEqual(['Mini 105']);
      expect(groupArchive(ITEMS, null, '999')).toEqual([]);
    });
  });
});
