import {
  apply,
  clue,
  init,
  letter,
  lineLabel,
  LINE,
  lineWord,
  pickSteps,
  READ,
  restoreDone,
  START_MSG,
  submitsText,
  timerText,
  tumblerNumber,
  validate,
  wheelMarks,
  type TumblerState,
} from '../model';
import { tumbler25 } from './fixtures';

const turnTo = (s: TumblerState, word: string) => {
  let x = s;
  for (let k = 0; k < 4; k++)
    for (let n = 0; n < 7 && letter(x, k, READ) !== word[k]!.toUpperCase(); n++)
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
    it('THEN the outlined line is the middle row, starts on the same word as before the move, and the page’s message shows', () => {
      const s = init(tumbler25);
      expect(lineWord(s)).toBe('teds');
      expect(s.msg).toBe(START_MSG);
      expect(lineLabel(s, 0)).toBe('Line letter 1: T');
      // 26 Nov 2026: drawn at row 3, read from the wheels' old line position (LINE), so saves hold
      expect(READ).toBe(3);
      expect(
        tumbler25.wheels
          .map((w) => w[LINE])
          .join('')
          .toLowerCase(),
      ).toBe('teds');
      expect(letter(s, 0, 0)).toBe(tumbler25.wheels[0]![(LINE - READ + 7) % 7]);
    });
  });

  describe('WHEN a letter off the line is tapped (tap to pick, Alec 26 Nov 2026)', () => {
    it('THEN it comes to the line the shortest way round, at most three tiles, and counts one turn', () => {
      expect([0, 1, 2, 4, 5, 6].map((i) => pickSteps(7, i))).toEqual([3, 2, 1, -1, -2, -3]);
      const s0 = init(tumbler25);
      for (let k = 0; k < 4; k++)
        for (let i = 0; i < 7; i++) {
          if (i === READ) continue;
          const want = letter(s0, k, i);
          const s = apply(s0, { t: 'pick', k, i });
          expect(letter(s, k, READ)).toBe(want);
          expect(s.turns).toBe(1);
          expect(s.glide).toEqual({ k, d: pickSteps(7, i), seq: 1 });
          // the other wheels don't move
          for (let j = 0; j < 4; j++) if (j !== k) expect(s.off[j]).toBe(s0.off[j]);
        }
    });
    it('THEN each pick counts on, a turn keeps the last glide, and the line, a bad wheel or a solved board are ignored', () => {
      const s0 = init(tumbler25);
      const a = apply(apply(s0, { t: 'pick', k: 0, i: 0 }), { t: 'pick', k: 1, i: 6 });
      expect(a.glide).toEqual({ k: 1, d: -3, seq: 2 });
      expect(apply(a, { t: 'turn', k: 2 }).glide).toBe(a.glide);
      expect(apply(s0, { t: 'pick', k: 0, i: READ })).toBe(s0);
      expect(apply(s0, { t: 'pick', k: 9, i: 0 })).toBe(s0);
      expect(apply(s0, { t: 'pick', k: 0, i: 7 })).toBe(s0);
      const won = restoreDone(tumbler25, ['teds']);
      expect(apply(won, { t: 'pick', k: 0, i: 0 })).toBe(won);
    });
  });

  describe('WHEN a wheel turns', () => {
    it('THEN it moves down one, wrapping, and counts the turn', () => {
      let s = apply(init(tumbler25), { t: 'turn', k: 0 });
      expect(letter(s, 0, READ)).toBe('R');
      expect(s.turns).toBe(1);
      expect(s.msg).toBe('');
      for (let i = 0; i < 6; i++) s = apply(s, { t: 'turn', k: 0 });
      expect(letter(s, 0, READ)).toBe('T');
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

  describe('WHEN a wrong word is submitted (clues on the wheels, Alec, 16 Nov 2026)', () => {
    const sub = (x: TumblerState, w: string) => apply(turnTo(x, w), { t: 'submit' });
    const s = sub(init(tumbler25), 'toes'); // against LETS: amber, grey, amber, green
    const m = wheelMarks(s);
    it('THEN the line shows the submit row: amber, grey, amber, green', () => {
      expect(s.tries).toEqual(['toes']);
      expect([0, 1, 2, 3].map((k) => m(k, letter(s, k, READ)))).toEqual(['n', 'x', 'n', 'g']);
    });
    it('THEN a grey letter fades on every wheel and an amber one is dotted where it could go', () => {
      expect(m(2, 'O')).toBe('x');
      expect(m(2, 'T')).toBe('a');
      expect(m(1, 'E')).toBe('a');
    });
    it('THEN nothing is deduced: a found letter elsewhere and a solved wheel’s others stay plain', () => {
      const n = wheelMarks(sub(init(tumbler25), 'lens'));
      expect(n(2, 'E')).toBe('');
      expect(n(1, 'B')).toBe('');
      expect(n(0, 'R')).toBe('');
    });
    it('THEN a repeated letter greyed in one place is still in the word', () => {
      const n = wheelMarks(sub(init(tumbler25), 'leek'));
      expect(n(2, 'E')).toBe('x');
      expect(n(0, 'E')).toBe('');
      expect(n(0, 'L')).toBe('g');
    });
    it('THEN an amber letter found later loses its dots', () => {
      const t = wheelMarks(sub(s, 'lets'));
      expect(t(2, 'T')).toBe('g');
      expect(t(0, 'T')).toBe('x');
      expect(t(1, 'E')).toBe('g');
    });
  });
});
