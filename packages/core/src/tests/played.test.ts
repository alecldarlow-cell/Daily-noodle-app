import { overallRun, resultText } from '../played';

const NOW = Date.parse('2026-10-24T09:00:00Z');

describe('GIVEN saves across the daily types', () => {
  describe('WHEN puzzles were played on consecutive days up to today', () => {
    it('THEN the run counts them, across types and streak dates', () => {
      const docs = {
        'digi-mini-v1': {
          v: 1,
          done: { a: { s: 60, d: '2026-10-24' }, b: { s: 70, d: '2026-10-22' } },
        },
        'digi-borders-v1': { v: 1, done: { c: { c: 7, on: '2026-10-23' } } },
        'digi-path-streak': { dates: ['2026-10-21'] },
      };
      expect(overallRun(docs, NOW)).toBe(4);
    });
  });

  describe('WHEN today has not been played yet', () => {
    it('THEN the run still counts up to yesterday (no pressure)', () => {
      const docs = {
        'digi-link-v1': { v: 1, done: { a: { d: '2026-10-23' }, b: { d: '2026-10-22' } } },
      };
      expect(overallRun(docs, NOW)).toBe(2);
    });
  });

  describe('WHEN the last play was two days ago or nothing is saved', () => {
    it('THEN the run is zero', () => {
      expect(overallRun({ 'digi-mini-v1': { v: 1, done: { a: { d: '2026-10-22' } } } }, NOW)).toBe(
        0,
      );
      expect(overallRun({}, NOW)).toBe(0);
      expect(overallRun({ 'digi-mini-v1': null, 'digi-mini-streak': { dates: 'x' } }, NOW)).toBe(0);
    });
  });
});

describe('GIVEN a finished Borders round', () => {
  describe('WHEN its save has points and right answers', () => {
    it('THEN the row shows the points, then the right answers', () => {
      expect(resultText('borders', { c: 7, p: 650 })).toBe('650 points · 7/10');
      expect(resultText('borders', { c: 0, p: 0 })).toBe('0 points · 0/10');
    });
  });

  describe('WHEN its save has points but no right-answer count', () => {
    it('THEN the row shows the points alone', () => {
      expect(resultText('borders', { p: 1000 })).toBe('1000 points');
    });
  });

  describe('WHEN its save has right answers but no points', () => {
    it('THEN the row keeps the right answers out of ten', () => {
      expect(resultText('borders', { c: 7 })).toBe('Scored 7/10');
    });
  });

  describe('WHEN its save has neither', () => {
    it('THEN there is no result line', () => {
      expect(resultText('borders', {})).toBe('');
    });
  });
});
