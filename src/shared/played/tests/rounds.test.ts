import { fileOf, heldElsewhere, isKept, progressKey, roundOf } from '../rounds';

const slot = (id: string, secs: unknown = 245, moves: unknown[] = [{ t: 'key' }]) => ({
  v: 1,
  id,
  secs,
  moves,
});

describe('GIVEN the keys a round is kept under', () => {
  it('THEN the grid types keep the app’s own progress keys, unchanged', () => {
    expect(progressKey('mini')).toBe('noodle-app-progress-mini');
    expect(progressKey('path')).toBe('noodle-app-progress-path');
  });
  it('THEN a card’s path gives the puzzle’s file', () => {
    expect(fileOf('reports/2026-10-24-crossword-mini-0105.html')).toBe(
      '2026-10-24-crossword-mini-0105',
    );
  });
  it('THEN only a JSON document counts as a downloaded puzzle', () => {
    expect(isKept('{"id":"x"}')).toBe(true);
    expect(isKept('null')).toBe(false);
    expect(isKept('')).toBe(false);
    expect(isKept(null)).toBe(false);
  });
});

describe('GIVEN a grid type’s progress slot', () => {
  describe('WHEN it holds this puzzle with moves', () => {
    it('THEN the card has a round with its clock', () => {
      expect(roundOf('mini', 'A', null, slot('A'))).toEqual({ time: '4:05' });
      expect(roundOf('doku', 'A', null, slot('A', 59.9))).toEqual({ time: '0:59' });
    });
    it('THEN a slot without a usable clock still counts, with no time', () => {
      expect(roundOf('sweep', 'A', null, slot('A', 'x'))).toEqual({});
    });
  });
  describe('WHEN it holds another puzzle, no moves, or nothing', () => {
    it('THEN this card has no round', () => {
      expect(roundOf('mini', 'A', null, slot('B'))).toBeNull();
      expect(roundOf('mini', 'A', null, slot('A', 5, []))).toBeNull();
      expect(roundOf('mini', 'A', null, null)).toBeNull();
      expect(roundOf('mini', 'A', null, '')).toBeNull();
    });
  });
  describe('WHEN the puzzle is already finished', () => {
    it('THEN it has no round, whatever the slot says', () => {
      expect(roundOf('path', 'A', { v: 1, done: { A: { s: 1 } } }, slot('A'))).toBeNull();
    });
  });
});

describe('GIVEN Tangle’s save', () => {
  it('THEN a day being played is a round with the time left', () => {
    const site = { v: 1, days: { T: { state: 'playing', left: 48.2 } }, done: {} };
    expect(roundOf('tangle', 'T', site, null)).toEqual({ time: '0:49 left' });
    expect(roundOf('tangle', 'T', { days: { T: { state: 'suspended' } } }, null)).toEqual({});
  });
  it('THEN a day ready or done is not', () => {
    expect(roundOf('tangle', 'T', { days: { T: { state: 'ready', left: 90 } } }, null)).toBeNull();
    expect(roundOf('tangle', 'T', { days: {} }, null)).toBeNull();
    expect(roundOf('tangle', 'T', null, null)).toBeNull();
  });
});

describe('GIVEN Borders’ or Reckon’s save', () => {
  it('THEN its cur for this puzzle is a round (no time shown)', () => {
    expect(roundOf('borders', 'B', { cur: { id: 'B' } }, null)).toEqual({});
    expect(roundOf('reckon', 'R', { cur: { id: 'X' } }, null)).toBeNull();
    expect(roundOf('reckon', 'R', { cur: null }, null)).toBeNull();
  });
});

describe('GIVEN Link’s save (its cur since 29 Oct 2026, AF-029/AF-020)', () => {
  it('THEN its cur for this puzzle is a round, with the time played', () => {
    expect(roundOf('link', 'L', { cur: { id: 'L', s: 75 } }, null)).toEqual({ time: '1:15' });
    expect(roundOf('link', 'L', { cur: { id: 'L' } }, null)).toEqual({});
    expect(roundOf('link', 'L', { cur: { id: 'X', s: 5 } }, null)).toBeNull();
    expect(roundOf('link', 'L', { cur: null }, null)).toBeNull();
  });
  it('THEN a finished Link has none, even with a stale cur', () => {
    expect(
      roundOf('link', 'L', { done: { L: { o: 'win' } }, cur: { id: 'L', s: 3 } }, null),
    ).toBeNull();
  });
});

describe('GIVEN a type with one kept round', () => {
  describe('WHEN another puzzle of the type holds it', () => {
    it('THEN starting this one would replace that one', () => {
      expect(heldElsewhere('mini', 'A', null, slot('B'))).toBe('B');
      expect(heldElsewhere('borders', 'A', { cur: { id: 'B' } }, null)).toBe('B');
      expect(heldElsewhere('reckon', 'A', { cur: { id: 'B' } }, null)).toBe('B');
      expect(heldElsewhere('link', 'A', { cur: { id: 'B', s: 9 } }, null)).toBe('B');
    });
  });
  describe('WHEN this puzzle holds it, nobody does, or the holder is finished', () => {
    it('THEN nothing is replaced', () => {
      expect(heldElsewhere('mini', 'A', null, slot('A'))).toBeNull();
      expect(heldElsewhere('mini', 'A', null, slot('B', 3, []))).toBeNull();
      expect(heldElsewhere('mini', 'A', null, null)).toBeNull();
      expect(heldElsewhere('borders', 'A', { cur: null }, null)).toBeNull();
      expect(heldElsewhere('doku', 'A', { done: { B: { s: 3 } } }, slot('B'))).toBeNull();
    });
  });
  describe('WHEN the type keeps rounds side by side (Tangle)', () => {
    it('THEN nothing is ever replaced', () => {
      const site = { days: { B: { state: 'playing' } }, cur: { id: 'B' } };
      expect(heldElsewhere('tangle', 'A', site, null)).toBeNull();
    });
  });
});
