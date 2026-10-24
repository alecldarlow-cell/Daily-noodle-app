import { acceptToday } from '../today';

const NOW = Date.parse('2026-10-24T09:00:00Z');
const item = { type: 'mini', id: 'DP·MINI·0105', name: 'Mini 105', path: 'reports/x.html' };

describe('GIVEN a list of today’s puzzles', () => {
  describe('WHEN it is dated today in London with items', () => {
    it('THEN it is accepted', () => {
      expect(acceptToday({ today: '2026-10-24', items: [item] }, NOW)).toBe(true);
    });
  });

  describe('WHEN it is 00:30 BST on 25 Oct (still 24 Oct in UTC)', () => {
    const halfPastMidnight = Date.parse('2026-10-24T23:30:00Z');
    it('THEN the 24th’s list is refused as yesterday’s', () => {
      expect(acceptToday({ today: '2026-10-24', items: [item] }, halfPastMidnight)).toBe(false);
    });
    it('THEN the 25th’s list is accepted', () => {
      expect(acceptToday({ today: '2026-10-25', items: [item] }, halfPastMidnight)).toBe(true);
    });
  });

  describe('WHEN it is empty, malformed or names an unknown type', () => {
    it.each([
      null,
      'x',
      { today: '2026-10-24', items: [] },
      { today: '2026-10-24' },
      { today: '2026-10-24', items: [{ ...item, type: 'lexi' }] },
      { today: '2026-10-24', items: [null] },
      { today: '2026-10-24', items: [{ ...item, path: 3 }] },
    ])('THEN %p is refused', (list) => {
      expect(acceptToday(list, NOW)).toBe(false);
    });
  });
});
