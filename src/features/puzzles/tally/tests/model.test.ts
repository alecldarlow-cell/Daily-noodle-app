import {
  apply,
  cellLabel,
  init,
  label,
  restoreDone,
  satisfies,
  tallyNumber,
  timerText,
  validate,
  view,
  type Move,
  type TallyState,
} from '../model';
import { tally1 } from './fixtures';

const play = (s: TallyState, ...ms: Move[]) => ms.reduce(apply, s);
const put = (i: number, d: number): Move[] => [
  { t: 'cell', i },
  { t: 'digit', d },
];

describe('GIVEN the clue rules', () => {
  it('THEN each sign works as the engine reads it', () => {
    expect(satisfies('+', 9, [4, 3, 2])).toBe(true);
    expect(satisfies('*', 12, [3, 4])).toBe(true);
    expect(satisfies('-', 2, [1, 3])).toBe(true);
    expect(satisfies('-', 2, [1, 3, 2])).toBe(false);
    expect(satisfies('/', 2, [4, 2])).toBe(true);
    expect(satisfies('/', 2, [3, 2])).toBe(false);
    expect(satisfies('/', 2, [4, 2, 1])).toBe(false);
    expect(satisfies('=', 3, [3])).toBe(true);
    expect(label({ c: [0], op: '=', t: 3 })).toBe('3');
    expect(label({ c: [0, 1], op: '-', t: 2 })).toBe('2−');
  });
});

describe('GIVEN the ship gate', () => {
  it('THEN a good board passes and each broken one says why', () => {
    expect(validate(tally1).ok).toBe(true);
    expect(validate(null).checks).toEqual(['malformed puzzle']);
    expect(validate({ ...tally1, sol: '12' }).ok).toBe(false);
    const cages = tally1.cages.slice(1);
    expect(validate({ ...tally1, cages }).checks).toContain('a cell belongs to no cage');
    const twice = [...tally1.cages, tally1.cages[0]!];
    expect(validate({ ...tally1, cages: twice }).checks).toContain('cell in two cages');
    const threeMinus = [
      { c: [0, 4, 5], op: '-' as const, t: 1 },
      ...tally1.cages.slice(0, 2),
      ...tally1.cages.slice(3),
    ];
    expect(validate({ ...tally1, cages: threeMinus }).checks).toContain('- on 3 cells');
    expect(validate({ ...tally1, sol: '1111'.repeat(4) }).checks).toContain(
      'solution is not a Latin square',
    );
  });
});

describe('GIVEN a fresh board', () => {
  const s = init(tally1);
  it('WHEN a number comes with no square THEN it asks for one', () => {
    expect(apply(s, { t: 'digit', d: 1 }).msg).toBe('Tap a square first.');
    expect(apply(s, { t: 'erase' })).toBe(s);
    expect(apply(s, { t: 'undo' })).toBe(s);
  });
  it('WHEN a number is tapped twice THEN it comes out again', () => {
    const a = play(s, ...put(5, 2));
    expect(a.g[5]).toBe(2);
    expect(apply(a, { t: 'digit', d: 2 }).g[5]).toBe(0);
  });
  it('WHEN a number repeats in a row or a column THEN both squares go bad', () => {
    const v = view(play(s, ...put(0, 1), ...put(1, 1), ...put(4, 1)));
    expect([v[0]!.bad, v[1]!.bad, v[4]!.bad, v[2]!.bad]).toEqual([true, true, true, false]);
  });
  it('WHEN notes go in THEN a placed number clears them along its row and column only', () => {
    const on = play(
      s,
      { t: 'cell', i: 1 },
      { t: 'notes' },
      { t: 'digit', d: 3 },
      { t: 'cell', i: 6 },
      { t: 'digit', d: 3 },
      { t: 'notes' },
    );
    expect(on.msg).toBe('');
    const n = play(on, ...put(0, 3));
    expect(n.notes[1]).toBe(0);
    expect(n.notes[6]).toBe(1 << 3);
  });
  it('WHEN a note lands on a placed number THEN the number goes', () => {
    const a = play(s, ...put(0, 3), { t: 'notes' }, { t: 'digit', d: 1 });
    expect(a.notes[0]).toBe(1 << 1);
    expect(a.g[0]).toBe(0);
  });
  it('WHEN Undo is pressed THEN the board goes back a move and the selection stays', () => {
    const a = play(s, ...put(0, 3), { t: 'erase' }, { t: 'undo' });
    expect(a.g[0]).toBe(3);
    expect(a.sel).toBe(0);
    expect(apply(a, { t: 'undo' }).g[0]).toBe(0);
  });
  it('WHEN more than 200 moves pass THEN only 200 can be undone', () => {
    let a = apply(s, { t: 'cell', i: 0 });
    for (let k = 0; k < 205; k++) a = apply(a, { t: 'digit', d: 1 + (k % 4) });
    expect(a.undo).toHaveLength(200);
  });
  it('WHEN the selection moves THEN cage, row and column are tinted, and matching numbers marked', () => {
    const v = view(play(s, ...put(1, 1), ...put(10, 1)));
    expect(v[10]!.sel).toBe(true);
    expect(v[6]!.cage).toBe(true);
    expect(v[9]!.peer).toBe(true);
    expect(v[1]!.same).toBe(true);
    expect(v[0]!.cage || v[0]!.peer).toBe(false);
  });
  it('THEN a full cage turns its clue green or red, and cage edges follow the cages', () => {
    const ok = view(play(s, ...put(8, 1), ...put(9, 3)));
    expect(ok[8]!.clueState).toBe('ok');
    const bad = view(play(s, ...put(8, 1), ...put(9, 1)));
    expect(bad[8]!.clueState).toBe('bad');
    expect(ok[8]).toMatchObject({ bt: true, bb: true, bl: true, br: false });
    expect(ok[9]).toMatchObject({ bl: false, br: true });
  });
  it('THEN the right numbers solve it, nothing stays selected and no move is taken after', () => {
    const moves = tally1.sol.split('').flatMap((d, i) => put(i, +d));
    const done = play(s, ...moves);
    expect(done.solved).toBe(true);
    expect(done.sel).toBe(-1);
    expect(apply(done, { t: 'notes' })).toBe(done);
    expect(restoreDone(tally1).g).toEqual(done.g);
  });
  it('THEN a full board that breaks a rule is not solved', () => {
    const wrong = tally1.sol.split('').flatMap((_, i) => put(i, 1));
    expect(play(s, ...wrong).solved).toBe(false);
    // a Latin square that breaks a cage: two rows of the answer swapped
    const swapped = `${tally1.sol.slice(4, 8)}${tally1.sol.slice(0, 4)}${tally1.sol.slice(8)}`;
    expect(play(s, ...swapped.split('').flatMap((d, i) => put(i, +d))).solved).toBe(false);
  });
});

describe('GIVEN the small words', () => {
  it('THEN the clock, the number and the screen reader’s label read as the page’s', () => {
    expect(timerText(62.4)).toBe('1:02');
    expect(timerText(-3)).toBe('0:00');
    expect(tallyNumber('DP·TALLY·0012')).toBe(12);
    const s = play(init(tally1), ...put(1, 2));
    const v = view(s);
    expect(cellLabel(s, 1, v[1]!)).toBe('Row 1, column 2, 2, cage 12×');
    expect(cellLabel(s, 0, v[0]!)).toBe('Row 1, column 1, empty, cage 24×');
    expect(cellLabel(s, 5, v[5]!)).toBe('Row 2, column 2, empty');
  });
});
