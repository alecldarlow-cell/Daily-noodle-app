import {
  apply,
  clueRuns,
  hintsText,
  idleLine,
  init,
  message,
  revealed,
  spanChars,
  tip,
  TYPE_NAME,
  unwrap,
  validate,
  type CrypticData,
  type CrypticState,
  type Move,
} from '../model';
import answers from './answers.json';
import pages from './pages.json';

const PAGES = pages as unknown as { path: string; date: string; data: CrypticData }[];
const ANSWERS = answers as Record<string, string>;
const play = (s: CrypticState, moves: Move[]) => moves.reduce(apply, s);
const typeWord = (w: string): Move[] => [...w].map((ch) => ({ t: 'type', ch }) as Move);

describe('GIVEN every Cryptic page on the site (21 Nov – 19 Dec 2026)', () => {
  it.each(PAGES.map((p) => [p.data.id, p] as const))(
    'WHEN %s is unwrapped THEN it passes the gate and typing its answer solves it',
    (_id, page) => {
      expect(validate(page.data)).toEqual({ ok: true, checks: [] });
      const sol = unwrap(page.data.sol, page.data.id);
      expect(sol.a).toBe(ANSWERS[page.data.id]);
      expect(TYPE_NAME[page.data.kind]).toBeTruthy();
      const s = play(init(page.data), [...typeWord(sol.a), { t: 'enter' }]);
      expect(s.solved).toBe(true);
      expect(s.hints).toBe(0);
    },
  );
});

const P = PAGES[0]!.data; // Cryptic 1: "Pub profit is a steal" (7), BARGAIN
const A = ANSWERS[P.id]!;

describe('GIVEN Cryptic 1 (BARGAIN)', () => {
  it('WHEN the squares are not all filled and Enter is pressed THEN it asks for every square', () => {
    const s = play(init(P), [...typeWord('BAR'), { t: 'enter' }]);
    expect(s.solved).toBe(false);
    expect(message(s)).toBe('Fill every square, then press Enter.');
  });
  it('WHEN a wrong answer is checked THEN it shakes, costs nothing, and the letters stay', () => {
    const s = play(init(P), [...typeWord('BARGAIM'), { t: 'enter' }]);
    expect(s.solved).toBe(false);
    expect(s.wrong).toBe(1);
    expect(s.hints).toBe(0);
    expect(s.letters.join('')).toBe('BARGAIM');
    expect(message(s)).toBe('Not quite. Nothing lost: try again.');
    // typing clears the message back to the help line
    const t = apply(s, { t: 'del' });
    expect(message(t)).toBe(idleLine(t));
  });
  it('WHEN typing past the end THEN the last square is overwritten; Delete steps back', () => {
    let s = play(init(P), typeWord('ABCDEFGH'));
    expect(s.letters.join('')).toBe('ABCDEFH');
    s = play(s, [{ t: 'del' }, { t: 'del' }]);
    expect(s.letters.join('')).toBe('ABCDE');
    expect(s.cur).toBe(5);
  });
  it('WHEN a square is tapped THEN typing goes there; Clear empties everything', () => {
    let s = play(init(P), [...typeWord('BARGAIN'), { t: 'select', i: 2 }, { t: 'type', ch: 'X' }]);
    expect(s.letters.join('')).toBe('BAXGAIN');
    s = apply(s, { t: 'clear' });
    expect(s.letters.every((x) => x === '')).toBe(true);
    expect(s.cur).toBe(0);
  });
  it('WHEN hints are taken THEN the ladder is definition, clue type, then a letter each, left to right', () => {
    let s = init(P);
    expect(idleLine(s)).toMatch(/^Type your answer/);
    s = apply(s, { t: 'hint' });
    expect(s.hints).toBe(1);
    expect(message(s)).toBe('The definition is highlighted. The rest is the wordplay.');
    s = apply(s, { t: 'hint' });
    expect(s.hints).toBe(2);
    expect(message(s)).toBe('Still stuck? Reveal a letter: it counts as a hint.');
    expect(revealed(s)).toBe(0);
    s = apply(s, { t: 'hint' });
    expect(revealed(s)).toBe(1);
    expect(s.letters[0]).toBe(A[0]);
    expect(s.cur).toBe(1);
    // a revealed square can't be typed over or tapped
    s = play(s, [
      { t: 'select', i: 0 },
      { t: 'type', ch: 'Z' },
    ]);
    expect(s.letters[0]).toBe(A[0]);
    expect(s.letters[1]).toBe('Z');
    expect(hintsText(s.hints)).toBe('3 hints');
  });
  it('WHEN every letter is revealed THEN the clue finishes (no fail state)', () => {
    let s = init(P);
    for (let k = 0; k < A.length + 2; k++) s = apply(s, { t: 'hint' });
    expect(s.solved).toBe(true);
    expect(s.letters.join('')).toBe(A);
    expect(s.hints).toBe(A.length + 2);
    // nothing moves a finished clue
    expect(apply(s, { t: 'type', ch: 'Q' })).toBe(s);
  });
  it('WHEN the definition is marked THEN the runs underline exactly its words', () => {
    const def = spanChars(P.clue, P.def)!;
    expect(P.clue.slice(def[0], def[1])).toBe('a steal');
    const runs = clueRuns(P.clue, { def });
    expect(runs.filter((r) => r.d).map((r) => r.text)).toEqual(['a steal']);
    expect(runs.map((r) => r.text).join('')).toBe(P.clue);
    expect(tip(P)).toMatch(/^A charade/);
  });
});

describe('GIVEN broken data', () => {
  it('THEN the gate refuses it, as the page does', () => {
    expect(validate(null).ok).toBe(false);
    expect(validate({ ...P, sol: 'not base64 !!' }).ok).toBe(false);
    expect(validate({ ...P, id: 'DP·CRYP·9999' }).ok).toBe(false); // the wrong key can't unwrap it
    expect(validate({ ...P, n: 6 }).checks).toContain("the answer doesn't fit its squares");
    expect(validate({ ...P, def: [1, 2] }).checks).toContain("the definition isn't at one end");
    expect(validate({ ...P, kind: 'spoonerism' }).checks).toContain('unknown clue type');
    expect(validate({ ...P, enum: '3,3' }).checks).toContain(
      "the enumeration doesn't match the answer",
    );
  });
});
