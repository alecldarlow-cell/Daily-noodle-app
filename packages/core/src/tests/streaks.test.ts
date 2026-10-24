import { bumpRoundStreak, liveRoundStreak, recordResultStreak } from '../streaks';

describe('GIVEN a round streak (Tangle, Borders, Reckon)', () => {
  describe('WHEN a round is finished the day after the last', () => {
    it('THEN the streak grows and best follows', () => {
      expect(bumpRoundStreak({ last: '2026-10-23', n: 4, best: 4 }, '2026-10-24')).toEqual({
        last: '2026-10-24',
        n: 5,
        best: 5,
      });
    });
  });
  describe('WHEN a second round is finished the same day', () => {
    it('THEN nothing changes', () => {
      expect(bumpRoundStreak({ last: '2026-10-24', n: 5, best: 9 }, '2026-10-24')).toEqual({
        last: '2026-10-24',
        n: 5,
        best: 9,
      });
    });
  });
  describe('WHEN there is a gap, or no streak yet', () => {
    it('THEN it restarts at one', () => {
      expect(bumpRoundStreak({ last: '2026-10-20', n: 5, best: 9 }, '2026-10-24').n).toBe(1);
      expect(bumpRoundStreak(undefined, '2026-10-24')).toEqual({
        last: '2026-10-24',
        n: 1,
        best: 1,
      });
    });
  });
  describe('WHEN the live count is read', () => {
    it('THEN it holds through yesterday and lapses after', () => {
      expect(liveRoundStreak({ last: '2026-10-23', n: 3 }, '2026-10-24')).toBe(3);
      expect(liveRoundStreak({ last: '2026-10-22', n: 3 }, '2026-10-24')).toBe(0);
      expect(liveRoundStreak(null, '2026-10-24')).toBe(0);
    });
  });
});

describe('GIVEN a Sweep or Link streak', () => {
  describe('WHEN today is already recorded', () => {
    it('THEN a replay changes nothing', () => {
      const s = { last: '2026-10-24', streak: 3, best: 3, dates: ['2026-10-24'], tz: 'L' as const };
      expect(recordResultStreak(s, '2026-10-24', false)).toBe(s);
    });
  });
  describe('WHEN a loss is recorded', () => {
    it('THEN the run ends but the day is marked played', () => {
      const s = { last: '2026-10-23', streak: 3, best: 3, dates: ['2026-10-23'], tz: 'L' as const };
      expect(recordResultStreak(s, '2026-10-24', false)).toMatchObject({
        streak: 0,
        best: 3,
        last: '2026-10-24',
        dates: ['2026-10-23', '2026-10-24'],
      });
    });
  });
});
