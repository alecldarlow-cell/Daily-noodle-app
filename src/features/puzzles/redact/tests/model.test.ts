import {
  apply,
  cellLabel,
  clearOff,
  connectedNow,
  init,
  lines,
  redactNumber,
  restoreDone,
  ruleSentence,
  runsOf,
  START_MSG,
  timerText,
  undoOff,
  validate,
  whyNot,
  type Move,
  type RedactState,
} from '../model';
import { redact5 } from './fixtures';

const play = (moves: Move[], s: RedactState = init(redact5)) => moves.reduce(apply, s);
const taps = (...i: number[]): Move[] => i.map((x) => ({ t: 'cell', i: x }));
const ANSWER = redact5.black;
const WRONG = 3; // 'S', not in the answer

describe('GIVEN a Redact board', () => {
  describe('WHEN it is checked (the page’s gate)', () => {
    it('THEN a real board passes', () => {
      expect(validate(redact5)).toEqual({ ok: true, checks: [] });
    });
    it('THEN a malformed one, a short run or mismatched words fail', () => {
      expect(validate(null).ok).toBe(false);
      expect(validate({ ...redact5, letters: 'abc' }).checks).toEqual(['malformed board']);
      expect(validate({ ...redact5, black: [1] }).checks).toContain('a run of 1');
      expect(validate({ ...redact5, words: ['x'] }).checks).toContain(
        "the words don't match the grid",
      );
    });
  });

  describe('WHEN it opens', () => {
    it('THEN nothing is blacked out and the page’s first line shows', () => {
      const s = init(redact5);
      expect(s.k).toBe(10);
      expect(s.black).toEqual([]);
      expect(s.msg).toBe(START_MSG);
      expect(undoOff(s)).toBe(true);
      expect(clearOff(s)).toBe(true);
    });
  });

  describe('WHEN the answer is blacked out in any order', () => {
    it('THEN it is solved and takes no more moves', () => {
      const s = play(taps(...ANSWER.slice().reverse()));
      expect(s.solved).toBe(true);
      expect(s.misses).toBe(0);
      expect(apply(s, { t: 'cell', i: 4 })).toBe(s);
      expect(undoOff(s)).toBe(true);
    });
  });

  describe('WHEN a wrong square makes the full count', () => {
    it('THEN it counts a miss, shakes, and says the first rule broken', () => {
      const s = play(taps(...ANSWER.slice(0, -1), WRONG));
      expect(s.misses).toBe(1);
      expect(s.shake).toBe(1);
      expect(s.msg).toMatch(/is on its own|only two letters|Not yet/);
      const more = apply(s, { t: 'cell', i: 4 });
      expect(more.msg).toBe('That’s more than 10.');
    });
  });

  describe('WHEN Undo and Clear are used', () => {
    it('THEN Undo takes back a tap, Clear empties the board, and Undo brings it back', () => {
      let s = play(taps(0, 1, 5));
      s = apply(s, { t: 'undo' });
      expect(s.black).toEqual([0, 1]);
      s = apply(s, { t: 'clear' });
      expect(s.black).toEqual([]);
      expect(apply(s, { t: 'clear' })).toBe(s);
      s = apply(s, { t: 'undo' });
      expect(s.black).toEqual([0, 1]);
      // a square tapped twice comes back
      s = play(taps(2, 2), s);
      expect(s.black).toEqual([0, 1]);
      expect(apply(init(redact5), { t: 'undo' }).black).toEqual([]);
    });
    it('THEN Undo keeps at most 300 steps', () => {
      let s = init(redact5);
      for (let k = 0; k < 320; k++) s = apply(s, { t: 'cell', i: 4 });
      expect(s.hist.length).toBe(300);
    });
  });
});

describe('GIVEN the board’s rules', () => {
  it('THEN runs, lines and joined-up whites read as the engine reads them', () => {
    expect(lines(2)).toEqual([
      [0, 1],
      [2, 3],
      [0, 2],
      [1, 3],
    ]);
    expect(runsOf([0, 1, 2, 3], new Set([1]))).toEqual([[0], [2, 3]]);
    expect(connectedNow(3, [1, 4, 7])).toBe(false);
    expect(connectedNow(3, [4])).toBe(true);
  });
  it('THEN each reason reads as the page says it', () => {
    const s = init(redact5);
    expect(whyNot({ ...s, black: [1] })).toBe(
      'P is on its own in row 1: every run needs three letters or more.',
    );
    expect(whyNot({ ...s, black: [2] })).toBe(
      'PE is only two letters in row 1: every run needs three letters or more.',
    );
    expect(whyNot({ ...s, black: [7, 8, 9, 10, 11, 1, 13, 25, 31] })).toMatch(/Not yet|column|row/);
    // the answer but words wrong elsewhere: a row or column doesn't read as words
    const n3 = {
      ...s,
      n: 3,
      p: { ...s.p, n: 3, letters: 'ABCDEFGHI' },
      black: [],
    };
    expect(whyNot(n3)).toBe('Not yet: a row or column doesn’t read as words.');
    // 7×7 with the middle row black: every run is long enough, but the halves don't meet
    const n7 = { ...s, n: 7, p: { ...s.p, n: 7, letters: 'A'.repeat(49) } };
    expect(whyNot({ ...n7, black: [21, 22, 23, 24, 25, 26, 27] })).toBe(
      'Not yet: the white squares must all join up.',
    );
  });
  it('THEN the screen reader, number, clock and rule sentence read right', () => {
    const s = play(taps(0));
    expect(cellLabel(s, 0)).toBe('Row 1, column 1, P, blacked out');
    expect(cellLabel(s, 7)).toBe('Row 2, column 2, A');
    expect(redactNumber('DP·REDA·0025')).toBe(25);
    expect(timerText(125.4)).toBe('2:05');
    expect(timerText(-3)).toBe('0:00');
    expect(ruleSentence(redact5)).toBe(
      'Ten of these letters don’t belong. Black them out and the grid becomes a crossword.',
    );
    expect(ruleSentence({ ...redact5, black: Array(30).fill(0) })).toMatch(/^30 of these/);
  });
  it('THEN a finished board reopens solved, the answer blacked out', () => {
    const s = restoreDone(redact5);
    expect(s.solved).toBe(true);
    expect(s.black).toEqual(ANSWER);
  });
});
