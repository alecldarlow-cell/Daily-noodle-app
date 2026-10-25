import {
  allTiles,
  apply,
  disabled,
  endDetail,
  finishNote,
  finishing,
  groupsByRank,
  guessSquares,
  init,
  OUT_NOTE,
  rankLabel,
  record,
  recordTime,
  REPLAY_NOTE,
  settles,
  showsShare,
  shownSeconds,
  shuffle,
  timerText,
  validate,
  type LinkState,
  type Move,
} from '../model';
import { clone, link78 } from './fixtures';

const fresh = (ranked = true) => init(link78, allTiles(link78), { ranked, rec: null });
const play = (s: LinkState, ...moves: Move[]) => moves.reduce(apply, s);
const pick = (s: LinkState, ws: string[]) =>
  play(s, ...ws.map((w): Move => ({ t: 'tile', w })), { t: 'submit' });
const G = link78.groups.map((g) => g.members);

describe('GIVEN the Link ship gate', () => {
  it('THEN a published Link passes every check', () => {
    expect(validate(link78)).toMatchObject({ ok: true });
  });

  it.each([
    ['three groups', (d: typeof link78) => d.groups.pop(), 'four_groups'],
    [
      'a repeated tile',
      (d: typeof link78) => (d.groups[1]!.members[0] = 'APPLES'),
      'no_duplicate_tiles',
    ],
    ['a rank missing', (d: typeof link78) => (d.groups[0]!.rank = 2), 'ranks_are_1_to_4'],
    [
      'a tile in its own name',
      (d: typeof link78) => (d.groups[1]!.name = 'Swords and the like'),
      'no_giveaway',
    ],
    [
      'a blocked word',
      (d: typeof link78) => (d.groups[0]!.members[0] = 'CRAPS'),
      'family_friendly',
    ],
    [
      'a trap that does not resolve',
      (d: typeof link78) => (d.traps![0]!.not = 'Nowhere'),
      'traps_resolve',
    ],
    [
      'a tile with a digit',
      (d: typeof link78) => (d.groups[0]!.members[0] = 'PLUM9'),
      'tiles_render',
    ],
    [
      'a number for a tile',
      (d: typeof link78) => ((d.groups[0]!.members as unknown[])[0] = 7),
      'members_are_text',
    ],
  ])('THEN %s fails it', (_label, change, check) => {
    const d = clone(link78);
    change(d);
    const v = validate(d);
    expect(v.ok).toBe(false);
    expect(v.checks[check]).toBe(false);
  });

  it('THEN something that is not a Link at all fails', () => {
    expect(validate(null).ok).toBe(false);
    expect(validate({ type: 'link', id: 'DP·LINK·0001', groups: 'no' }).ok).toBe(false);
  });
});

describe('GIVEN a fresh board', () => {
  describe('WHEN tiles are held', () => {
    it('THEN the clock starts, a fifth is refused, and a held tile lets go when tapped again', () => {
      let s = fresh();
      expect(s.timer).toBe('idle');
      s = play(s, ...G[0]!.map((w): Move => ({ t: 'tile', w })));
      expect(s.timer).toBe('running');
      expect(disabled(s)).toEqual({ submit: false, clear: false, shuffle: false });
      s = apply(s, { t: 'tile', w: 'SWORD' });
      expect(s.msg).toEqual({ text: 'Four at a time', tone: '' });
      expect(s.sel).toHaveLength(4);
      s = apply(s, { t: 'tile', w: 'APPLES' });
      expect(s.sel).not.toContain('APPLES');
      expect(s.msg.text).toBe('');
      s = apply(s, { t: 'deselect' });
      expect(s.sel).toEqual([]);
      expect(disabled(s)).toMatchObject({ submit: true, clear: true });
    });

    it('THEN a tile not on the board, Submit with three, and Deselect with none do nothing', () => {
      const s = fresh();
      expect(apply(s, { t: 'tile', w: 'NOPE' })).toBe(s);
      expect(apply(s, { t: 'submit' })).toBe(s);
      expect(apply(s, { t: 'deselect' })).toBe(s);
    });
  });

  describe('WHEN a wrong four is submitted', () => {
    it('THEN three of a group is one away and costs a mistake, and the same four again costs nothing', () => {
      let s = pick(fresh(), [G[0]![0]!, G[0]![1]!, G[0]![2]!, G[1]![0]!]);
      expect(s.msg).toEqual({ text: 'One away', tone: 'bad' });
      expect(s.mistakes).toBe(1);
      expect(s.guesses).toEqual([[1, 1, 1, 2]]);
      s = apply(s, { t: 'submit' });
      expect(s.msg.text).toBe('Already tried that one');
      expect(s.mistakes).toBe(1);
      s = pick(apply(s, { t: 'deselect' }), [G[0]![0]!, G[0]![1]!, G[1]![0]!, G[1]![1]!]);
      expect(s.msg).toEqual({ text: 'Not a group', tone: 'bad' });
      expect(s.mistakes).toBe(2);
    });

    it('THEN the guess is recorded in board order, not tap order', () => {
      const s = pick(fresh(), [G[1]![0]!, G[0]![0]!, G[0]![1]!, G[0]![2]!]);
      expect(s.guesses).toEqual([[1, 1, 1, 2]]);
    });
  });

  describe('WHEN a right four is submitted', () => {
    it('THEN it settles (the board takes no taps) and becomes a band when it lands', () => {
      let s = fresh();
      s = play(s, ...G[2]!.map((w): Move => ({ t: 'tile', w })));
      expect(settles(s, { t: 'submit' })).toBe(true);
      s = apply(s, { t: 'submit' });
      expect(s.settling).toEqual({ group: 2, tiles: ['STRIKE', 'GUTTER', 'ALLEY', 'SPLIT'] });
      expect(disabled(s)).toEqual({ submit: true, clear: true, shuffle: true });
      expect(apply(s, { t: 'tile', w: 'APPLES' })).toBe(s);
      expect(apply(s, { t: 'shuffle', order: [] })).toBe(s);
      s = apply(s, { t: 'land' });
      expect(s.solved).toEqual([2]);
      expect(s.live).toHaveLength(12);
      expect(apply(s, { t: 'land' })).toBe(s);
    });

    it('THEN the fourth group wins and stops the clock', () => {
      let s = fresh();
      for (const g of G) s = apply(pick(s, g), { t: 'land' });
      expect(s).toMatchObject({ won: true, over: true, timer: 'stopped' });
      expect(finishing(s)).toBe(true);
      expect(record(s, '01:05')).toEqual({
        o: 'win',
        t: '01:05',
        m: 0,
        r: [1, 2, 3, 4],
        g: [
          [1, 1, 1, 1],
          [2, 2, 2, 2],
          [3, 3, 3, 3],
          [4, 4, 4, 4],
        ],
      });
      expect(endDetail(s, '01:05')).toEqual({
        type: 'word-link',
        tv: 3,
        outcome: 'solved',
        secs: 65,
        checks: 0,
        reveals: 0,
        hints: 0,
        mistakes: 0,
      });
    });
  });

  describe('WHEN the fourth mistake is made', () => {
    it('THEN the board is over, the rest are laid out by rank, and Play again starts a fresh, unranked board', () => {
      let s = apply(pick(fresh(), G[3]!), { t: 'land' });
      const wrongs = [
        [G[0]![0]!, G[0]![1]!, G[0]![2]!, G[1]![0]!],
        [G[0]![0]!, G[0]![1]!, G[1]![0]!, G[1]![1]!],
        [G[0]![0]!, G[1]![0]!, G[2]![0]!, G[2]![1]!],
        [G[1]![1]!, G[1]![2]!, G[2]![0]!, G[0]![3]!],
      ];
      for (const w of wrongs) s = pick(apply(s, { t: 'deselect' }), w);
      expect(s).toMatchObject({ over: true, revealing: true, timer: 'stopped', mistakes: 4 });
      expect(finishing(s)).toBe(false);
      s = apply(s, { t: 'revealed' });
      expect(s.solved).toEqual([3, 0, 1, 2]);
      expect(s.msg.text).toBe(OUT_NOTE);
      expect(finishing(s)).toBe(true);
      expect(endDetail(s, '00:40')).toMatchObject({ outcome: 'failed', mistakes: 4 });
      expect(apply(s, { t: 'revealed' })).toBe(s);
      s = { ...s, ranked: false, hasRecord: true };
      const again = apply(s, { t: 'again', order: allTiles(link78).reverse() });
      expect(again).toMatchObject({
        over: false,
        mistakes: 0,
        solved: [],
        timer: 'running',
        replayStarted: true,
        label: true,
      });
      expect(again.live[0]).toBe('REAPS');
    });
  });

  describe('WHEN Shuffle is pressed', () => {
    it('THEN the board takes the order dealt (the engine’s Fisher–Yates)', () => {
      const seq = [0.9, 0.1, 0.5, 0.3];
      let k = 0;
      const order = shuffle(['A', 'B', 'C', 'D'], () => seq[k++]!);
      expect(order).toEqual(['C', 'B', 'A', 'D']);
      expect(apply(fresh(), { t: 'shuffle', order: ['X'] }).live).toEqual(['X']);
    });
  });
});

describe('GIVEN today’s result is already in (another Link played today)', () => {
  it('THEN the board is labelled a replay with the page’s note', () => {
    const s = fresh(false);
    expect(rankLabel(s)).toBe(true);
    expect(s.label).toBe(true);
    expect(s.msg.text).toBe(REPLAY_NOTE);
  });
});

describe('GIVEN a finished Link reopened from its save', () => {
  it('THEN it opens over, in the saved order, with its time and the page’s line', () => {
    const rec = {
      o: 'win',
      t: '02:14',
      m: 2,
      r: [2, 1, 3, 4],
      g: [
        [1, 1, 1, 2],
        [2, 2, 2, 2],
      ],
      d: '2026-10-25',
    };
    const s = init(link78, allTiles(link78), { ranked: false, rec });
    expect(s).toMatchObject({
      restored: true,
      over: true,
      won: true,
      mistakes: 2,
      solved: [1, 0, 2, 3],
      live: [],
    });
    expect(s.label).toBe(false);
    expect(s.msg.text).toBe('Linked in 02:14 · 2 mistakes');
    expect(showsShare(s)).toBe(true);
    const perfect = init(link78, [], { ranked: true, rec: { ...rec, m: 0 } });
    expect(perfect.msg.text).toBe('Linked in 02:14 · perfect');
    const lost = init(link78, [], { ranked: true, rec: { ...rec, o: 'loss', t: 'nonsense' } });
    expect(lost.msg.text).toBe(OUT_NOTE);
    expect(recordTime({ t: 'nonsense' })).toBe('00:00');
  });

  it('THEN a record the page can’t read leaves the board to play', () => {
    for (const rec of [
      { o: 'gave', r: [1, 2, 3, 4] },
      { o: 'win', r: [1, 1, 3, 4] },
      { o: 'win', r: [1, 2] },
      { o: 'win' },
    ]) {
      const s = init(link78, allTiles(link78), { ranked: true, rec });
      expect(s.restored).toBe(false);
      expect(s.live).toHaveLength(16);
    }
  });
});

describe('GIVEN the finish sheet’s words', () => {
  const p = init(link78, [], { ranked: true, rec: null }).p;
  it('THEN the note says how it went and which group caught you out', () => {
    expect(
      finishNote(
        p,
        [
          [1, 1, 1, 1],
          [2, 2, 2, 2],
        ],
        true,
      ),
    ).toBe('All four groups, no mistakes.');
    expect(
      finishNote(
        p,
        [
          [1, 1, 1, 1],
          [2, 2, 3, 3],
          [2, 2, 2, 2],
        ],
        true,
      ),
    ).toBe('All four groups with one mistake. Weapons caught you out.');
    expect(
      finishNote(
        p,
        [
          [4, 4, 1, 4],
          [4, 3, 4, 4],
          [1, 1, 1, 1],
        ],
        false,
      ),
    ).toBe('You found one group of four. Anagrams of one another caught you out.');
    expect(
      finishNote(
        p,
        [
          [1, 2, 3, 4],
          [1, 2, 2, 4],
          [1, 2, 3, 3],
          [2, 2, 2, 1],
        ],
        false,
      ),
    ).toBe('You found no groups of four. Weapons caught you out.');
    expect(
      finishNote(
        p,
        [
          [1, 1, 1, 1],
          [2, 2, 2, 2],
          [1, 3, 4, 3],
        ],
        false,
      ),
    ).toMatch(/^You found two groups/);
  });

  it('THEN the squares are one per four-tile guess, the rank or a miss', () => {
    expect(guessSquares([[1, 1, 1, 1], [1, 2, 1, 1], [3, 3], 'x', [4, 4, 4, 4]])).toEqual([
      1, 0, 4,
    ]);
    expect(groupsByRank(p).map((g) => g.rank)).toEqual([1, 2, 3, 4]);
  });

  it('THEN times read as the page writes and the tracker reads them', () => {
    expect(timerText(65.9)).toBe('01:05');
    expect(timerText(-3)).toBe('00:00');
    expect(shownSeconds('1:05')).toBe(65);
    expect(shownSeconds('1:02:03')).toBe(3723);
    expect(shownSeconds('')).toBeNull();
  });
});
