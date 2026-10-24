import { isPuzzleType, puzzleNumber, saveKey, streakKey, typeOfId, PUZZLE_TYPES } from '../ids';

describe('GIVEN puzzle ids', () => {
  describe('WHEN their type is read', () => {
    it.each([
      ['DP·MINI·0105', 'mini'],
      ['DP·LEXI·0103', 'doku'],
      ['DP·SWEEP·2026-10-24', 'sweep'],
      ['DP·PATH·0098', 'path'],
      ['DP·LINK·0077', 'link'],
      ['DP·TANG·0018', 'tangle'],
      ['DP·BORD·0020', 'borders'],
      ['DP·RECK·0005', 'reckon'],
    ])('THEN %s is %s', (id, type) => {
      expect(typeOfId(id)).toBe(type);
    });
    it('THEN an unknown or malformed id has no type', () => {
      expect(typeOfId('DP·NOPE·0001')).toBeNull();
      expect(typeOfId('MINI 105')).toBeNull();
    });
  });

  describe('WHEN their player number is read', () => {
    it('THEN leading zeros are dropped', () => {
      expect(puzzleNumber('DP·MINI·0105')).toBe(105);
    });
    it('THEN Sweep takes its number from the headline', () => {
      expect(puzzleNumber('DP·SWEEP·2026-10-24', 'Sweep 100')).toBe(100);
      expect(puzzleNumber('DP·SWEEP·2026-10-24')).toBeNull();
    });
    it('THEN an id with no number gives none', () => {
      expect(puzzleNumber('DP·MINI·')).toBeNull();
    });
  });

  describe('WHEN keys and types are checked', () => {
    it('THEN keys are the verbatim storage keys', () => {
      expect(saveKey('doku')).toBe('digi-doku-v1');
      expect(streakKey('path')).toBe('digi-path-streak');
    });
    it('THEN the daily set is in the site’s order and validated', () => {
      expect(PUZZLE_TYPES).toEqual([
        'mini',
        'doku',
        'sweep',
        'path',
        'link',
        'tangle',
        'borders',
        'reckon',
      ]);
      expect(isPuzzleType('reckon')).toBe(true);
      expect(isPuzzleType('lexi')).toBe(false);
    });
  });
});
