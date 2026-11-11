import {
  apply,
  clue,
  init,
  letter,
  lineLabel,
  lineWord,
  restoreDone,
  START_MSG,
  submitsText,
  timerText,
  tumblerNumber,
  validate,
  type TumblerState,
} from '../model';
import { tumbler25 } from './fixtures';

const turnTo = (s: TumblerState, word: string) => {
  let x = s;
  for (let k = 0; k < 4; k++)
    for (let n = 0; n < 7 && letter(x, k, 1) !== word[k]!.toUpperCase(); n++)
      x = apply(x, { t: 'turn', k });
  return x;
};

describe('GIVEN a Tumbler board', () => {
  describe('WHEN it is checked (the page’s gate)', () => {
    it('THEN a good board passes', () => {
      expect(validate(tumbler25)).toEqual({ ok: true, checks: [] });
    });
    it('THEN malformed wheels, a secret off the list or out of reach are refused', () => {
      expect(validate(null).ok).toBe(false);
      expect(validate({ ...tumbler25, wheels: ['ABC'] }).checks).toEqual(['malformed wheels']);
      expect(
        validate({ ...tumbler25, wheels: ['RTEDLAW', 'BEYJOXU', 'MDNETFO', 'USIAORR'] }).ok,
      ).toBe(false);
      expect(validate({ ...tumbler25, secret: 'zzzz' }).checks).toEqual([
        'the hidden word is not in the word list',
      ]);
      expect(
        validate({ ...tumbler25, wheels: ['RTEDKAW', 'BEYJOXU', 'MDNETFO', 'USIAORK'] }).checks,
      ).toEqual(["wheel 1 can't make the hidden word"]);
    });
  });

  describe('WHEN it opens', () => {
    it('THEN the yellow line reads the second row and the page’s message shows', () => {
      const s = init(tumbler25);
      expect(lineWord(s)).toBe('teds');
      expect(s.msg).toBe(START_MSG);
      expect(lineLabel(s, 0)).toBe('Line letter 1: T');
    });
  });

  describe('WHEN a wheel turns', () => {
    it('THEN it moves down one, wrapping, and counts the turn', () => {
      let s = apply(init(tumbler25), { t: 'turn', k: 0 });
      expect(letter(s, 0, 1)).toBe('R');
      expect(s.turns).toBe(1);
      expect(s.msg).toBe('');
      for (let i = 0; i < 6; i++) s = apply(s, { t: 'turn', k: 0 });
      expect(letter(s, 0, 1)).toBe('T');
      expect(apply(s, { t: 'turn', k: 9 })).toBe(s);
    });
  });

  describe('WHEN words are submitted', () => {
    it('THEN a non-word, a repeat and a real word say what the page says', () => {
      let s = apply(init(tumbler25), { t: 'submit' });
      expect(s.msg).toBe('TEDS isn’t a word we know, so it doesn’t count.');
      expect(s.tries).toEqual([]);
      s = apply(turnTo(s, 'toes'), { t: 'submit' });
      expect(s.tries).toEqual(['toes']);
      expect(s.msg).toBe('');
      s = apply(s, { t: 'submit' });
      expect(s.msg).toBe('You’ve tried TOES already.');
      s = apply(turnTo(s, 'lets'), { t: 'submit' });
      expect(s.solved).toBe(true);
      expect(s.tries).toEqual(['toes', 'lets']);
      expect(apply(s, { t: 'submit' })).toBe(s);
    });
  });

  describe('WHEN clues are worked out', () => {
    it('THEN green, amber and grey follow Wordle’s rule for repeats', () => {
      expect(clue('lets', 'lets')).toEqual(['g', 'g', 'g', 'g']);
      expect(clue('tels', 'lets')).toEqual(['a', 'g', 'a', 'g']);
      expect(clue('toot', 'tost')).toEqual(['g', 'g', 'x', 'g']);
      expect(clue('ttxx', 'atxx')).toEqual(['x', 'g', 'g', 'g']);
    });
  });

  it('THEN a finished board reopens with the word on the line and its submits', () => {
    const s = restoreDone(tumbler25, ['toes', 'lets']);
    expect(lineWord(s)).toBe('lets');
    expect(s.tries).toEqual(['toes', 'lets']);
    expect(restoreDone(tumbler25, null).tries).toEqual(['lets']);
  });

  it('THEN its words read as the page writes them', () => {
    expect(tumblerNumber('DP·TUMB·0025')).toBe(25);
    expect(timerText(62.4)).toBe('1:02');
    expect(timerText(-3)).toBe('0:00');
    expect(submitsText(1)).toBe('1 submit');
    expect(submitsText(3)).toBe('3 submits');
  });
});
