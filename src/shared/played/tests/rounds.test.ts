import { fileOf, isKept, progressKey, roundOf } from '../rounds';

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

describe('GIVEN every puzzle keeps its own round (22 Nov 2026)', () => {
  describe('WHEN the latest round (slot or cur) is another puzzle’s', () => {
    it('THEN this puzzle’s own round in rounds is still found, with its time', () => {
      const rounds = { A: slot('A'), B: slot('B') };
      expect(roundOf('mini', 'A', null, slot('B'), rounds)).toEqual({ time: '4:05' });
      expect(roundOf('mini', 'B', null, slot('B'), rounds)).toEqual({ time: '4:05' });
      expect(roundOf('mini', 'C', null, slot('B'), rounds)).toBeNull();
      const site = {
        rounds: { A: { id: 'A', s: 30 }, B: { id: 'B', s: 9 } },
        cur: { id: 'B', s: 9 },
      };
      expect(roundOf('tally', 'A', site, null)).toEqual({ time: '0:30' });
      expect(roundOf('link', 'A', site, null)).toEqual({ time: '0:30' });
      expect(roundOf('borders', 'A', site, null)).toEqual({});
      expect(roundOf('reckon', 'A', site, null)).toEqual({});
    });
  });
  describe('WHEN the puzzle is finished', () => {
    it('THEN its kept round is not offered', () => {
      const site = { done: { A: { s: 1 } }, rounds: { A: { id: 'A', s: 30 } } };
      expect(roundOf('tally', 'A', site, null)).toBeNull();
      expect(roundOf('doku', 'A', site, null, { A: slot('A') })).toBeNull();
    });
  });
});

describe('GIVEN Tally’s save', () => {
  it('THEN a save from before rounds still reads its round from `cur`, with its time', () => {
    expect(roundOf('tally', 'T', { cur: { id: 'T', s: 95 } }, null)).toEqual({ time: '1:35' });
    expect(roundOf('tally', 'T', { cur: { id: 'T' } }, null)).toEqual({});
    expect(roundOf('tally', 'T', { cur: { id: 'U', s: 95 } }, null)).toBeNull();
  });
});
