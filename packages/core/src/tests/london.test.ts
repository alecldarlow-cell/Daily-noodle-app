import { londonDay } from '../london';

describe('GIVEN an instant', () => {
  describe('WHEN it is 00:30 BST on 19 Oct 2026 (23:30 UTC the day before)', () => {
    it('THEN the London day is the 19th, not the UTC 18th', () => {
      expect(londonDay(new Date('2026-10-18T23:30:00Z'))).toBe('2026-10-19');
    });
  });

  describe('WHEN it is 23:30 GMT on 1 Dec 2026', () => {
    it('THEN the London day equals the UTC day', () => {
      expect(londonDay(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-01');
    });
  });
});

describe('GIVEN no instant', () => {
  describe('WHEN londonDay is called', () => {
    it('THEN it returns today as YYYY-MM-DD', () => {
      expect(londonDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
