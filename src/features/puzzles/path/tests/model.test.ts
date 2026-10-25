import {
  apply,
  endDetail,
  endMark,
  finish,
  finishNote,
  init,
  lines,
  mmssSecs,
  NOT_FORCED_MSG,
  recordTime,
  restore,
  START_MSG,
  timerText,
  validate,
  type Move,
  type PathState,
} from '../model';
import { clone, path92 } from './fixtures';

const at: [number, number][] = [];
path92.solution.forEach((row, r) => row.forEach((v, c) => (at[v] = [r, c])));
const cell = (r: number, c: number): Move => ({ t: 'cell', r, c });
const to = (v: number) => cell(...at[v]!);
const play = (s: PathState, ...ms: Move[]) => ms.reduce(apply, s);
/** The low end grown to `v` along the answer. */
const lowTo = (v: number) => {
  let s = play(init(path92), to(1));
  for (let k = 2; k <= v; k++) s = play(s, to(k));
  return s;
};

describe('GIVEN a Path’s data', () => {
  describe('WHEN it is validated', () => {
    it('THEN a published puzzle passes the engine’s own gate', () => {
      const v = validate(path92);
      expect(v.ok).toBe(true);
      expect(v.checks).toMatchObject({ unique_solution: true, solve_no_guess: true });
    });

    it.each([
      ['a number twice', (d: typeof path92) => (d.solution[0]![0] = 29), 'solution_1_to_36'],
      [
        'a given that disagrees',
        (d: typeof path92) => (d.locked[2]![2] = 24),
        'locks_match_solution',
      ],
      ['no 36 given', (d: typeof path92) => d.locked.splice(1, 1), 'endpoints_locked'],
      ['a given off the board', (d: typeof path92) => (d.locked[3]![0] = 9), 'locked_on_board'],
      ['another type', (d: typeof path92) => ((d as { type: string }).type = 'mini'), 'is_path'],
      ['an id without a number', (d: typeof path92) => (d.id = 'DP·PATH·X'), 'has_id'],
    ])('THEN %s is refused, as the page refuses to render it', (_, change, check) => {
      const d = clone(path92);
      change(d);
      const v = validate(d);
      expect(v.ok).toBe(false);
      expect(v.checks[check]).toBe(false);
    });

    it('THEN a thread with too few turns is refused, as the gate refuses it', () => {
      // a plain snake, every square given: unique and forced, but only 10 turns
      const snake = Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => r * 6 + (r % 2 ? 6 - c : c + 1)),
      );
      const d = {
        ...clone(path92),
        solution: snake,
        locked: snake.flatMap((row, r) =>
          row.map((v, c) => [r + 1, c + 1, v] as [number, number, number]),
        ),
      };
      const v = validate(d);
      expect(v.ok).toBe(false);
      expect(v.checks).toMatchObject({ sufficiently_varied: false, unique_solution: true });
      expect(validate(undefined).ok).toBe(false);
    });
  });
});

describe('GIVEN a new board', () => {
  it('THEN the 1 is the active end and the 36 is ringed', () => {
    const s = init(path92);
    expect(s.msg).toBe(START_MSG);
    expect(endMark(s, 5, 4)).toBe('active');
    expect(endMark(s, 3, 5)).toBe('endsel');
    expect(endMark(s, 0, 0)).toBeNull();
    expect(lines(s)).toEqual({ low: [[5, 4]], high: [[3, 5]], solved: false });
  });

  it('THEN tapping the 1 or the 36 chooses the end, and a touching square takes the next number', () => {
    let s = play(init(path92), to(36));
    expect(s.activeEnd).toBe('high');
    expect(s.msg).toBe('Counting down from 36 — tap an adjacent square to place 35.');
    s = play(s, to(1));
    expect(s.msg).toBe('Counting up from 1 — tap an adjacent square to place 2.');
    s = play(s, to(2));
    expect(s.cellValue[5]![5]).toBe(2);
    expect(s.msg).toBe('');
    expect(s.started).toBe(true);
    expect(lines(s).low).toEqual([
      [5, 4],
      [5, 5],
    ]);
    expect(apply(s, cell(9, 9))).toBe(s);
  });
});

describe('GIVEN a tap the rules refuse', () => {
  it.each([
    [
      'not next to the end',
      () => play(init(path92), cell(0, 0)),
      'Not next to the active end — the thread grows one square at a time.',
    ],
    ['on the thread', () => play(lowTo(3), to(2)), 'That square is already part of the thread.'],
    [
      'a given that isn’t next',
      () => play(lowTo(8), to(7)),
      'That given is 7, but the thread needs 9 next.',
    ],
    [
      'a number given elsewhere',
      () => play(lowTo(6), cell(2, 3)),
      '7 is already given elsewhere — the thread has to pass through it.',
    ],
    [
      'a number left stranded',
      () => play(lowTo(5), cell(2, 4)),
      'Placing 6 there would leave it stranded from 7.',
    ],
  ])('THEN %s says why and shakes the square', (_, make, msg) => {
    const s = make();
    expect(s.msg).toBe(msg);
    expect(s.shake).not.toBeNull();
  });

  it('THEN a given that is next is passed through, and a given out of turn is named', () => {
    const s = play(lowTo(6), to(7));
    expect(s.msg).toBe('Through the 7 checkpoint — keep going.');
    expect(s.lowHead).toBe(7);
    const t = play(lowTo(12), to(13), cell(4, 0), cell(4, 1));
    expect(t.lowHead).toBe(15);
    const u = play(lowTo(26), cell(1, 0), cell(0, 0));
    expect(u.lowHead).toBe(28);
    const wrong = play(lowTo(8), to(9), to(10), to(11), to(12), to(13));
    expect(play(wrong, cell(3, 1)).msg).toBe(
      'Not next to the active end — the thread grows one square at a time.',
    );
    const given = play(lowTo(4), cell(3, 4));
    expect(play(given, cell(3, 5)).activeEnd).toBe('high');
  });
});

describe('GIVEN Undo', () => {
  it('THEN it takes back the last step, a pass-through keeping its given, and nothing when empty', () => {
    const s0 = init(path92);
    expect(apply(s0, { t: 'undo' })).toBe(s0);
    let s = play(lowTo(7), { t: 'undo' });
    expect(s.lowHead).toBe(6);
    expect(s.cellValue[3]![2]).toBe(7);
    expect(s.msg).toBe('Undone.');
    s = play(s, { t: 'undo' });
    expect(s.cellValue[3]![3]).toBeNull();
    const high = play(init(path92), to(36), to(35), { t: 'undo' });
    expect(high.activeEnd).toBe('high');
    expect(high.highHead).toBe(36);
  });
});

describe('GIVEN Hint', () => {
  it('THEN it places a square forced at either end, or says neither is forced', () => {
    const s = play(init(path92), { t: 'hint' });
    expect(s.cellValue[2]![5]).toBe(35);
    expect(s.activeEnd).toBe('high');
    expect(s.usedHints).toBe(1);
    expect(s.hints).toBe(1);
    let t = s;
    for (let k = 0; k < 5; k++) t = play(t, { t: 'hint' });
    const stuck = [t, ...Array.from({ length: 30 }, () => 0)].reduce((x) =>
      (x as PathState).msg === NOT_FORCED_MSG ? x : play(x as PathState, { t: 'hint' }),
    ) as PathState;
    expect([NOT_FORCED_MSG, '']).toContain(stuck.msg);
  });
});

describe('GIVEN Hint picks a square the rules then refuse (Path 422)', () => {
  const p422 = {
    ...path92,
    id: 'DP·PATH·0422',
    solution: [
      [34, 33, 32, 5, 4, 3],
      [35, 30, 31, 6, 1, 2],
      [36, 29, 8, 7, 12, 13],
      [27, 28, 9, 10, 11, 14],
      [26, 23, 22, 19, 18, 15],
      [25, 24, 21, 20, 17, 16],
    ],
    locked: [
      [2, 5, 1],
      [3, 1, 36],
      [1, 1, 34],
      [1, 4, 5],
      [1, 6, 3],
      [3, 2, 29],
      [3, 3, 8],
      [5, 1, 26],
      [5, 2, 23],
      [6, 3, 21],
      [6, 6, 16],
    ] as [number, number, number][],
  };
  it('THEN the end it switched to grows next, but the old end stays lit, as the page paints it', () => {
    let s = play(init(p422), { t: 'hint' }, cell(1, 4)); // 35 placed, then the 1 chosen
    expect(s.activeEnd).toBe('low');
    s = play(s, { t: 'hint' });
    expect(s.msg).toBe('34 is already given elsewhere — the thread has to pass through it.');
    expect(s.activeEnd).toBe('high');
    expect(endMark(s, 1, 4)).toBe('active');
    expect(endMark(s, 1, 0)).toBeNull();
    s = play(s, cell(0, 0)); // through the 34: repainted
    expect(endMark(s, 0, 0)).toBe('active');
  });
});

describe('GIVEN the thread complete', () => {
  const done = () => {
    let s = lowTo(35);
    if (!s.solved) s = play(s, to(36));
    return s;
  };
  it('THEN the board is solved, one green thread, no lit ends', () => {
    const s = done();
    expect(s.solved).toBe(true);
    expect(lines(s).solved).toBe(true);
    expect(lines(s).low).toHaveLength(36);
    expect(endMark(s, 5, 4)).toBeNull();
    expect(apply(s, to(1))).toBe(s);
    expect(apply(s, { t: 'undo' })).toBe(s);
    const h = apply(s, { t: 'hint' });
    expect(h.hints).toBe(1);
    expect(h.usedHints).toBe(0);
  });

  it('THEN the record is the clock’s text and the tracker reads its seconds', () => {
    const s = done();
    expect(finish(s, 102)).toEqual({
      rec: { t: '1:42' },
      end: { secs: 102, checks: 0, reveals: 0, hints: 0 },
    });
    expect(endDetail(s, 7)).toMatchObject({ type: 'logic-path', outcome: 'solved', secs: 7 });
    expect(finishNote(s, true)).toBe('One to 36 without a hint.');
    expect(finishNote({ ...s, usedHints: 1 }, true)).toBe('One to 36 with one hint.');
    expect(finishNote({ ...s, usedHints: 3 }, true)).toBe('One to 36 with three hints.');
    expect(finishNote(s, false)).toBe('');
  });

  it('THEN a saved one reopens complete with its time', () => {
    const s = restore(path92, { t: '1:27' });
    expect(s.solved).toBe(true);
    expect(s.msg).toBe('Thread complete in 1:27.');
    expect(recordTime({ t: 'soon' })).toBe('0:00');
    expect(recordTime(null)).toBe('0:00');
    expect(timerText(65)).toBe('1:05');
    expect(timerText(725)).toBe('12:05');
    expect(mmssSecs('12:05')).toBe(725);
    expect(mmssSecs('')).toBe(0);
  });
});
