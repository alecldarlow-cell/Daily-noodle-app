import {
  apply,
  cascade,
  CELLS,
  counts,
  endDetail,
  finish,
  finishNote,
  hintPick,
  hintWhy,
  init,
  LOSS_MSG,
  LOSS_REPLAY_MSG,
  minesLeft,
  NB,
  msgText,
  NOTHING_MSG,
  overCount,
  provable,
  recapCell,
  recordSeconds,
  REPLAY_MSG,
  restore,
  savedRecord,
  START_MSG,
  timerText,
  unmark,
  validate,
  validateSweep,
  WRONG_FLAG,
  type Constraint,
  type Move,
  type SweepState,
} from '../model';
import { clone, sweep81, sweep94 } from './fixtures';

const START = 3 * 6 + 4; // r4c5
const MINES = [2, 4, 13, 19, 26, 33, 35];
const play = (s: SweepState, ...ms: Move[]) => ms.reduce((x, m) => apply(x, m, { secs: 42 }), s);
const fresh = () => init(sweep94, { ranked: true });
const opened = () => play(fresh(), { t: 'tap', i: START });
const safes = () => [...Array(CELLS).keys()].filter((i) => !MINES.includes(i));

describe('GIVEN a Sweep’s data', () => {
  describe('WHEN it is validated', () => {
    it('THEN a published board passes the engine’s own gate', () => {
      const v = validate(sweep94);
      expect(v.ok).toBe(true);
      expect(v.checks).toMatchObject({ unique_solution: true, solvable_without_guessing: true });
    });

    it.each([
      ['six mines', (d: typeof sweep94) => d.mines.pop(), 'mine_count'],
      ['a mine on the start', (d: typeof sweep94) => (d.mines[0] = [4, 5]), 'no_mine_on_opening'],
      ['a square off the board', (d: typeof sweep94) => (d.start = [7, 1]), 'squares_on_board'],
      ['another type', (d: typeof sweep94) => ((d as { type: string }).type = 'path'), 'is_sweep'],
      ['an id of another type', (d: typeof sweep94) => (d.id = 'DP·MINI·0001'), 'has_id'],
    ])('THEN %s is refused, as the page refuses to render it', (_, change, check) => {
      const d = clone(sweep94);
      change(d);
      const v = validate(d);
      expect(v.ok).toBe(false);
      expect(v.checks[check]).toBe(false);
    });

    it('THEN a start beside a mine opens no area and is refused', () => {
      const d = clone(sweep94);
      d.start = [2, 2];
      expect(validate(d).checks.opening_is_zero).toBe(false);
      expect(validate(null).ok).toBe(false);
    });
  });

  describe('WHEN its numbers and opening are worked out', () => {
    it('THEN they are the page’s', () => {
      const ms = new Set(MINES);
      const n = counts(ms);
      expect(n[2]).toBe(-1);
      expect(n[3]).toBe(2);
      const g = validateSweep(
        sweep94.mines.map(([r, c]) => [r - 1, c - 1] as const),
        [3, 4],
      );
      expect([...g.opening]).toEqual([...cascade(START, n)]);
      expect(g.opening.has(START)).toBe(true);
    });
  });
});

describe('GIVEN a fresh board', () => {
  it('THEN only the start square answers, and it opens the proved area', () => {
    const s = fresh();
    expect(s.msg).toBe(START_MSG);
    expect(apply(s, { t: 'tap', i: 0 })).toBe(s);
    expect(apply(s, { t: 'press', i: 0 })).toBe(s);
    const o = opened();
    expect(o.startDug).toBe(true);
    expect(o.started).toBe(true);
    expect(o.revealed.size).toBeGreaterThan(5);
    expect(o.msg).toBe('');
    expect(apply(o, { t: 'tap', i: 99 })).toBe(o);
    expect(apply(o, { t: 'press', i: -1 })).toBe(o);
  });

  it('THEN a day already played is a replay, said once and marked', () => {
    const s = init(sweep94, { ranked: false });
    expect(s.rank).toBe('· replay');
    expect(s.msg).toBe(REPLAY_MSG);
    const done = init(sweep94, { ranked: false, done: true });
    expect(done.rank).toBe('');
  });
});

describe('GIVEN the board open', () => {
  it('THEN a long press or Flag mode flags, the counter goes below zero, crowded numbers are struck', () => {
    let s = opened();
    s = play(s, { t: 'press', i: 0 }, { t: 'mode', flag: true }, { t: 'tap', i: 1 });
    expect([...s.flagged]).toEqual([0, 1]);
    expect(s.flagMode).toBe(true);
    s = play(s, { t: 'tap', i: 1 });
    expect(s.flagged.has(1)).toBe(false);
    const hid = (j: number) => !s.revealed.has(j) && !s.flagged.has(j);
    const busy = [...s.revealed].find((i) => NB[i]!.filter(hid).length > s.p.NUM[i]!)!;
    for (const j of NB[busy]!.filter(hid).slice(0, s.p.NUM[busy]! + 1))
      s = play(s, { t: 'tap', i: j });
    expect(overCount(s, busy)).toBe(true);
    for (const j of safes()) if (hid(j)) s = play(s, { t: 'tap', i: j });
    expect(minesLeft(s)).toBeLessThan(0);
    expect(play(s, { t: 'tap', i: [...s.revealed][0]! })).toBe(s); // an open square can't be flagged
  });

  it('THEN every square called with a flag on a safe one is named, and fixing it sweeps', () => {
    let s = opened();
    s = play(s, { t: 'mode', flag: true }, ...MINES.map((i): Move => ({ t: 'tap', i })));
    s = play(s, { t: 'mode', flag: false });
    const left = () => safes().filter((i) => !s.revealed.has(i));
    while (left().length > 1) s = play(s, { t: 'tap', i: left()[0]! });
    const last = left()[0]!;
    s = play(s, { t: 'press', i: last });
    expect(msgText(s.msg)).toBe(
      "All 36 squares called, but the sweep isn't done — a flag is sitting on a safe square. The counter reads -1.",
    );
    s = play(s, { t: 'press', i: last }, { t: 'tap', i: last });
    expect(s.over && s.won).toBe(true);
    expect(s.msg).toBe('Swept in <b>00:42</b>. Nice.');
    expect(s.endSecs).toBe(42);
    expect(finishNote(s, true)).toBe('All seven mines found, no hints.');
    expect(finishNote(s, false)).toBe('All seven mines found.');
    expect(finish(s).rec).toEqual({ o: 'win', s: 42 });
    expect(endDetail(s)).toEqual({
      type: 'logic-sweep',
      tv: 3,
      outcome: 'solved',
      secs: 42,
      checks: 0,
      reveals: 0,
      hints: 0,
    });
    expect(apply(s, { t: 'tap', i: 0 })).toBe(s);
    expect(apply(s, { t: 'again' })).toBe(s); // no Play again after a win
  });
});

describe('GIVEN Hint', () => {
  it('THEN it finds the next step from the board and says why, ringing the number', () => {
    const s = play(opened(), { t: 'hint' });
    expect(s.msg).toBe('This 1 has only one hidden square next to it, so that square is a mine.');
    expect(s.why).toHaveLength(1);
    expect(MINES).toContain(s.mark!.i);
    expect(s.usedHints).toBe(1);
    // the next move clears the line and the ring, not the mark
    const t = play(s, { t: 'press', i: s.mark!.i });
    expect(t.msg).toBe('');
    expect(t.why).toEqual([]);
    expect(t.mark).toEqual(s.mark);
    expect(unmark(t, s.mark!.n).mark).toBeNull();
    expect(unmark(t, 99)).toBe(t);
  });

  it('THEN a flag on a provably safe square is named, with no ring', () => {
    const s = play(opened(), { t: 'press', i: 3 }, { t: 'hint' });
    expect(provable(opened()).S.has(3)).toBe(true);
    expect(s.msg).toBe(WRONG_FLAG);
    expect(s.mark!.i).toBe(3);
    expect(s.why).toEqual([]);
  });

  it('THEN an unproved flag is ignored and a real mine is never called safe', () => {
    let s = init(sweep81, { ranked: true });
    s = play(s, { t: 'tap', i: 4 * 6 + 3 }, { t: 'mode', flag: true }, { t: 'tap', i: 12 });
    s = play(s, { t: 'hint' });
    expect(s.mark!.i).toBe(16);
    expect(s.msg).toMatch(/mines?\.$/);
  });

  it('THEN solving by Hint alone works, and an exhausted board says so', () => {
    let s = opened();
    for (let k = 0; k < 60 && !s.over; k++) {
      s = play(s, { t: 'hint' });
      const i = s.mark!.i;
      s = MINES.includes(i) ? play(s, { t: 'press', i }) : play(s, { t: 'tap', i });
    }
    expect(s.won).toBe(true);
    expect(finishNote(s, true)).toMatch(/^All seven mines found, with \w+ hints\.$/);
    const after = play(s, { t: 'hint' });
    expect(after.usedHints).toBe(s.usedHints);
    expect(after.hints).toBe(s.hints + 1);
    // every square flagged but none proved: nothing deducible
    let f = opened();
    f = play(f, { t: 'mode', flag: true });
    for (let i = 0; i < CELLS; i++)
      if (!f.revealed.has(i) && !MINES.includes(i)) f = play(f, { t: 'tap', i });
    for (const i of MINES) f = play(f, { t: 'tap', i });
    expect(hintPick(f)).not.toBeNull(); // the wrong flags are named first
  });

  it('THEN with nothing new to find it says to check the flags', () => {
    let s = opened();
    for (const i of MINES) s = play(s, { t: 'press', i });
    s = { ...s, revealed: new Set([...Array(CELLS).keys()].filter((i) => !MINES.includes(i))) };
    s = play(s, { t: 'hint' });
    expect(s.msg).toBe(NOTHING_MSG);
    expect(s.mark).toBeNull();
  });
});

describe('GIVEN a mine', () => {
  it('THEN one ends it: the other mines shown, the result a loss, Play again a replay', () => {
    let s = play(opened(), { t: 'tap', i: 2 });
    expect(s.over && !s.won).toBe(true);
    expect(s.msg).toBe(LOSS_MSG);
    expect([...s.boomed]).toEqual([2]);
    expect(s.flagged.size).toBe(6);
    expect(s.flagCheck).toBe(false);
    expect(finish(s)).toMatchObject({ rec: { o: 'loss', s: 42, b: 2 }, outcome: 'failed' });
    expect(finishNote(s, true)).toBe(
      'That was a mine. The grid never needed a guess; the step was there to find.',
    );
    expect(recapCell(s, 2)).toBe('boom');
    expect(recapCell(s, 4)).toBe('flag');
    expect(recapCell(s, 3)).toBe(2);
    s = apply(s, { t: 'again' }, { ranked: false });
    expect(s.round).toBe(2);
    expect(s.rank).toBe('· replay');
    expect(s.msg).toBe(REPLAY_MSG);
    expect(s.flagCheck).toBe(false); // the page never turns it back on
    s = play(s, { t: 'tap', i: START }, { t: 'tap', i: 2 });
    expect(s.msg).toBe(LOSS_REPLAY_MSG);
  });

  it('THEN Play again on a later day counts again', () => {
    const lost = play(opened(), { t: 'tap', i: 2 });
    const s = apply(lost, { t: 'again' }, { ranked: true });
    expect(s.rank).toBe('');
    expect(s.msg).toBe(START_MSG);
  });
});

describe('GIVEN a saved result', () => {
  it.each([
    [{ o: 'win', s: 87 }, true, 'Swept in <b>01:27</b>.'],
    [{ o: 'loss', s: 12, b: 4 }, false, LOSS_MSG],
    [{ o: 'gave', s: 3 }, false, 'Revealed.'],
  ])('THEN %j reopens finished, as restoreDone does', (rec, won, msg) => {
    const s = restore(sweep94, rec, true)!;
    expect(s.over).toBe(true);
    expect(s.won).toBe(won);
    expect(s.msg).toBe(msg);
    expect(s.revealed.size).toBe(29);
  });

  it('THEN one the page wouldn’t reopen plays again', () => {
    expect(restore(sweep94, { o: 'loss', s: 3, b: 0 }, true)).toBeNull();
    expect(restore(sweep94, { o: 'won' }, true)).toBeNull();
    expect(savedRecord(null, init(sweep94, { ranked: true }).p)).toBeNull();
  });

  it('THEN its seconds are clamped and the clock reads MM:SS', () => {
    expect(recordSeconds({ s: 1e9 })).toBe(359999);
    expect(recordSeconds({ s: 'x' })).toBe(0);
    expect(recordSeconds(null)).toBe(0);
    expect(timerText(65)).toBe('01:05');
  });
});

describe('GIVEN Hint’s wording (engines/sweep.js hintWhy)', () => {
  // NUM: the number on each square named below.
  const NUM = Array<number>(CELLS).fill(0);
  NUM[1] = 1;
  NUM[2] = 2;
  NUM[3] = 3;
  NUM[5] = 2;
  const c = (n: number, cells: number, src: number, fl = 0): Constraint => ({
    cells: new Set(Array.from({ length: cells }, (_, k) => 20 + k)),
    n,
    src,
    fl,
  });
  const d = (n: number, cells: number, A: Constraint, B: Constraint) => ({
    cells: new Set(Array.from({ length: cells }, (_, k) => 30 + k)),
    n,
    A,
    B,
  });
  it.each([
    [c(0, 5, -1), 'All seven mines are flagged, so every other square is safe.'],
    [c(1, 1, -1), "Only one mine is left and only one square is still hidden, so it's a mine."],
    [
      c(2, 2, -1),
      'Only two mines are left and only two squares are still hidden, so both are mines.',
    ],
    [
      c(3, 3, -1),
      "Only three mines are left and only three squares are still hidden, so they're all mines.",
    ],
    [c(0, 1, 1, 1), 'This 1 already touches its flagged mine, so its other hidden square is safe.'],
    [
      c(0, 2, 2, 2),
      'This 2 already touches its two flagged mines, so its other hidden squares are safe.',
    ],
    [c(1, 1, 1), 'This 1 has only one hidden square next to it, so that square is a mine.'],
    [c(2, 2, 2), 'This 2 has exactly two hidden squares left, so both are mines.'],
    [c(3, 3, 3), 'This 3 has exactly three hidden squares left, so all three are mines.'],
    [
      c(2, 2, 3, 1),
      'This 3 already has one flagged mine and only two hidden squares left, so both are mines.',
    ],
    [
      c(1, 1, 3, 2),
      'This 3 already has two flagged mines and only one hidden square left, so that square is a mine.',
    ],
    [
      d(0, 3, c(2, 2, 2), c(2, 5, -1)),
      'Only two mines are left, and this 2 needs both, so every hidden square not touching it is safe.',
    ],
    [
      d(0, 3, c(1, 2, 2, 1), c(1, 5, -1)),
      'Only one mine is left, and this 2 still needs it, so every hidden square not touching it is safe.',
    ],
    [
      d(0, 3, c(3, 3, 3), c(3, 5, -1)),
      'Only three mines are left, and this 3 needs all three, so every hidden square not touching it is safe.',
    ],
    [
      d(1, 1, c(2, 3, 2), c(3, 5, -1)),
      'Three mines are left and this 2 needs two, so the one hidden square not touching it is a mine.',
    ],
    [
      d(2, 2, c(1, 3, 1), c(3, 5, -1)),
      'Three mines are left and this 1 needs one, so the two hidden squares not touching it are both mines.',
    ],
    [
      d(3, 3, c(1, 2, 2, 1), c(4, 5, -1)),
      'Four mines are left and this 2 still needs one, so the three hidden squares not touching it are all mines.',
    ],
    [
      d(0, 1, c(1, 2, 1), c(1, 3, 1)),
      "These two 1s share two hidden squares, and one of them touches no others, so its mine is there. That's all the other 1 needs, so its other hidden square is safe.",
    ],
    [
      d(0, 2, c(1, 2, 1, 1), c(1, 4, 2)),
      "This 2 and this 1 share two hidden squares, and the 1 touches no others, so its last mine is there. That's all the 2 needs, so its other hidden squares are safe.",
    ],
    [
      d(0, 2, c(2, 2, 2), c(2, 4, 3, 1)),
      "This 3 and this 2 share two hidden squares, and the 2 touches no others, so its two mines are there. That's all the 3 still needs, so its other hidden squares are safe.",
    ],
    [
      d(1, 1, c(1, 2, 2), c(2, 3, 5)),
      'These two 2s share two hidden squares. One of them needs one more mine than the other, and it can only be in its other square.',
    ],
    [
      d(1, 1, c(1, 2, 1), c(2, 3, 2)),
      'This 2 and this 1 share two hidden squares. The 2 needs one more mine than the 1, and it can only be in its other square.',
    ],
    [
      d(2, 2, c(1, 2, 1, 1), c(3, 4, 3)),
      'This 3 and this 1 share two hidden squares. The 3 still needs two more mines than the 1, and they can only be in its other two squares.',
    ],
  ])('THEN %# reads as the page’s', (why, line) => {
    expect(hintWhy(why, NUM, 7)).toBe(line);
  });
});
