import * as core from '../index';

// The barrel after the dead-export sweep (queue #173): what it still re-exports is all real,
// and the helpers nothing used are gone rather than left as undefined pass-throughs.

describe('GIVEN the @noodle/core barrel', () => {
  describe('WHEN it is loaded', () => {
    it('THEN every value it exports is defined', () => {
      const missing = Object.entries(core)
        .filter(([, v]) => v === undefined)
        .map(([k]) => k);
      expect(missing).toEqual([]);
    });

    it('THEN the unused helpers are no longer part of it', () => {
      const gone = [
        'isDay',
        'boardLeagues',
        'clockSecs',
        'savedResults',
        'MOVE_TAG',
        'MOVE_BASE',
        'mergeMoved',
        'adoptBoard',
        'TYPE_OF_ID',
        'LAB_OF_ID',
        'followsOn',
        'STATS_MIN_TREND',
        'STATS_MIN_YEAR',
      ];
      expect(gone.filter((k) => k in core)).toEqual([]);
    });

    it('THEN the helpers the app does use are still there', () => {
      expect(typeof core.londonDay).toBe('function');
      expect(typeof core.dayBefore).toBe('function');
      expect(core.GRID_STREAK_TYPES).toContain('mini');
    });
  });
});
