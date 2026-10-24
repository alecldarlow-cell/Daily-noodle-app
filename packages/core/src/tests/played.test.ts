import { overallRun } from '../played';

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
