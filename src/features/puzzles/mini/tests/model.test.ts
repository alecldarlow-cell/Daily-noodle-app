import {
  allCells,
  apply,
  clueBar,
  clueList,
  endDetail,
  finish,
  finishNote,
  init,
  numberGrid,
  recordSeconds,
  restore,
  status,
  timerText,
  validate,
  type MiniState,
  type Move,
} from '../model';
import { clone, mini105 } from './fixtures';

const play = (s: MiniState, ...ms: Move[]) => ms.reduce(apply, s);
const keys = (word: string): Move[] => [...word].map((ch) => ({ t: 'key', ch }));
const letters = (s: MiniState) => s.entries.map((r) => r.map((x) => x || '.').join('')).join('/');

describe('GIVEN a Mini’s data', () => {
  describe('WHEN it is validated', () => {
    it('THEN a published puzzle passes every check', () => {
      const v = validate(mini105);
      expect(v.ok).toBe(true);
      expect(Object.values(v.checks).every(Boolean)).toBe(true);
    });

    it.each([
      ['a run of two letters', (d: typeof mini105) => (d.grid[0]![3] = '#'), 'no_two_letter_runs'],
      ['a lower-case letter', (d: typeof mini105) => (d.grid[2]![2] = 'i'), 'letters_a_to_z'],
      ['a missing row', (d: typeof mini105) => d.grid.pop(), 'grid_5x5'],
      ['no clues', (d: typeof mini105) => ((d as { clues: unknown }).clues = null), 'clues_object'],
      ['another type', (d: typeof mini105) => ((d as { type: string }).type = 'lexi'), 'is_mini'],
      ['an id without a number', (d: typeof mini105) => (d.id = 'DP·MINI·X'), 'has_id'],
    ])('THEN %s is refused, as the page could not play it', (_, change, check) => {
      const d = clone(mini105);
      change(d);
      const v = validate(d);
      expect(v.ok).toBe(false);
      expect(v.checks[check]).toBe(false);
    });

    it('THEN a grid of blocks only has no words and is refused', () => {
      const d = clone(mini105);
      d.grid = d.grid.map((r) => r.map(() => '#'));
      expect(validate(d).checks.has_words).toBe(false);
      expect(validate(null).ok).toBe(false);
    });
  });

  describe('WHEN it is numbered and its clues listed', () => {
    it('THEN numbers run across the grid and clues sort by number', () => {
      expect(numberGrid(mini105.grid)[0]).toEqual([1, 0, 2, 3, 0]);
      const across = clueList(init(mini105).p, 'A');
      expect(across.map((c) => `${c.num}${c.ans}`)).toEqual([
        '1more',
        '4and',
        '6pride',
        '8sin',
        '9dyer',
      ]);
    });

    it('THEN a word without a clue shows its length', () => {
      const d = clone(mini105);
      delete d.clues.more;
      expect(clueList(init(d).p, 'A')[0]!.clue).toBe('(4)');
    });
  });
});

describe('GIVEN a new game', () => {
  const s0 = init(mini105);

  it('THEN the cursor is on 1 Across and the clock waits', () => {
    expect(s0.sel).toEqual({ r: 0, c: 0, dir: 'A' });
    expect(status(s0)).toMatchObject({ solved: false, started: false });
    expect(clueBar(s0)).toEqual({ label: '1A', clue: "'Please, sir, I want some ___'" });
  });

  describe('WHEN letters are typed', () => {
    // AF-031 (29 Oct 2026; was: the cursor stopped at the word's end, so "morex" ended MORX).
    it('THEN each goes in, and a full word moves on to the next clue with a gap', () => {
      const s = play(s0, ...keys('morex'));
      expect(letters(s).split('/').slice(0, 2)).toEqual(['MORE#', '.#X..']);
      expect(s.sel).toEqual({ r: 1, c: 3, dir: 'A' });
      expect(s.started).toBe(true);
    });
  });

  describe('WHEN a word already has letters from crossing answers (AF-031, engines/mini.js)', () => {
    it('THEN typing skips the filled squares instead of typing over them', () => {
      // 1 Down M-A-P-S gives 6 Across its P and 8 Across its S.
      const down = play(s0, { t: 'cell', r: 0, c: 0 }, ...keys('maps'));
      expect(letters(down)).toBe('M...#/A#.../P..../S..#./#....');
      // A full 1 Down moves on to the next clue in the bar's order with a gap: 2 Down.
      expect(down.sel).toEqual({ r: 0, c: 2, dir: 'D' });
      // 1 Across from its second square: O, R, E.
      const s = play(down, { t: 'cell', r: 0, c: 1 }, { t: 'bar' }, ...keys('ore'));
      expect(letters(s).split('/')[0]).toBe('MORE#');
      // 6 Across from its second square: R, I, D, E, then the P is already there.
      const t = play(s, { t: 'cell', r: 2, c: 1 }, ...keys('ride'));
      expect(t.sel.dir).toBe('A');
      expect(letters(t).split('/')[2]).toBe('PRIDE');
    });

    it('THEN the gaps earlier in the word are filled after the later ones (wrapping round)', () => {
      let s = play(s0, { t: 'cell', r: 2, c: 3 }, ...keys('de')); // 6 Across: ...DE
      expect(s.sel).toEqual({ r: 2, c: 0, dir: 'A' });
      s = play(s, ...keys('pri'));
      expect(letters(s).split('/')[2]).toBe('PRIDE');
    });

    it('THEN a full word goes to the next clue, in the bar’s order, that has an empty square', () => {
      const s = play(s0, ...keys('more'), ...keys('and'), ...keys('pride'));
      expect(s.sel).toEqual({ r: 3, c: 0, dir: 'A' }); // 8 Across, its first square
      // Every across full: round to the downs, 1 Down's first empty square.
      const all = play(s, ...keys('sin'), ...keys('dyer'));
      expect(letters(all)).toBe('MORE#/.#AND/PRIDE/SIN#./#DYER');
      expect(all.sel).toEqual({ r: 1, c: 0, dir: 'D' });
    });

    it('THEN Backspace still steps back one square, and a tapped filled square takes a letter', () => {
      const s = play(s0, ...keys('mo'), { t: 'del' });
      expect(letters(s).split('/')[0]).toBe('M...#');
      expect(s.sel).toEqual({ r: 0, c: 1, dir: 'A' });
      const o = play(s0, ...keys('more'), { t: 'cell', r: 0, c: 1 }, { t: 'key', ch: 'x' });
      expect(letters(o).split('/')[0]).toBe('MXRE#');
    });
  });

  describe('WHEN a square is tapped', () => {
    it('THEN the same square again switches direction', () => {
      const s = play(s0, { t: 'cell', r: 0, c: 0 });
      expect(s.sel.dir).toBe('D');
      expect(status(s).active?.cells).toHaveLength(4);
    });

    it('THEN a square with no word that way turns the cursor the way it has one', () => {
      const s = play(s0, { t: 'cell', r: 1, c: 0 });
      expect(s.sel).toEqual({ r: 1, c: 0, dir: 'D' });
    });

    it('THEN a block is ignored', () => {
      expect(play(s0, { t: 'cell', r: 0, c: 4 })).toBe(s0);
    });
  });

  describe('WHEN the clue bar is tapped', () => {
    it('THEN it switches direction, unless the square has no word the other way', () => {
      expect(play(s0, { t: 'bar' }).sel.dir).toBe('D');
      const lone = play(s0, { t: 'cell', r: 1, c: 0 }, { t: 'bar' });
      expect(lone.sel.dir).toBe('D');
    });
  });

  describe('WHEN delete is pressed', () => {
    it('THEN a filled square is cleared where the cursor is', () => {
      const s = play(s0, ...keys('mo'), { t: 'cell', r: 0, c: 1 }, { t: 'del' });
      expect(letters(s).split('/')[0]).toBe('M...#');
      expect(s.sel).toMatchObject({ r: 0, c: 1 });
    });

    it('THEN on an empty square it steps back and clears that one', () => {
      const s = play(s0, ...keys('mo'), { t: 'del' });
      expect(letters(s).split('/')[0]).toBe('M...#');
      expect(s.sel).toMatchObject({ r: 0, c: 1 });
      expect(s.started).toBe(true);
    });
  });

  describe('WHEN ‹ and › are pressed', () => {
    it('THEN they step through across then down, wrapping, landing on the first empty square', () => {
      const typed = play(s0, ...keys('mo'));
      const s = play(typed, { t: 'step', delta: -1 });
      expect(s.sel).toEqual({ r: 2, c: 1, dir: 'D' }); // 7 Down, the last clue
      const back = play(s, { t: 'step', delta: 1 });
      expect(back.sel).toEqual({ r: 0, c: 2, dir: 'A' }); // 1 Across, first empty square
    });
  });
});

describe('GIVEN letters on the board', () => {
  const s0 = play(init(mini105), ...keys('mxre'));

  describe('WHEN Check word is pressed', () => {
    it('THEN right letters go good and wrong ones bad, counted once', () => {
      const s = play(s0, { t: 'cell', r: 0, c: 0 }, { t: 'checkWord' });
      expect(s.checked[0]).toEqual(['good', 'bad', 'good', 'good', null]);
      expect(s.used.checks).toBe(1);
      expect(s.track.checks).toBe(1);
    });

    it('THEN on a square with no word that way only the press is counted', () => {
      const s = apply({ ...s0, sel: { r: 1, c: 0, dir: 'A' } }, { t: 'checkWord' });
      expect(s.used.checks).toBe(0);
      expect(s.track.checks).toBe(1);
      const r = apply({ ...s0, sel: { r: 1, c: 0, dir: 'A' } }, { t: 'revealWord' });
      expect(r.used.reveals).toBe(0);
      expect(r.track.reveals).toBe(1);
    });
  });

  describe('WHEN Check all is pressed and a marked letter retyped', () => {
    it('THEN empty squares stay unmarked and the retyped square loses its mark', () => {
      let s = play(s0, { t: 'checkAll' });
      expect(s.checked[1]![0]).toBeNull();
      s = play(s, { t: 'cell', r: 0, c: 1 }, { t: 'key', ch: 'o' });
      expect(s.checked[0]![1]).toBeNull();
    });
  });

  describe('WHEN Reveal word is pressed', () => {
    it('THEN the word fills in as good and is counted', () => {
      // After "mxre" fills 1 Across the cursor is already on 4 Across (AF-031; was ›, then Reveal).
      expect(s0.sel).toEqual({ r: 1, c: 2, dir: 'A' });
      const s = play(s0, { t: 'revealWord' });
      expect(letters(s).split('/')[1]).toBe('.#AND');
      expect(s.used.reveals).toBe(1);
      expect(s.track.reveals).toBe(1);
    });
  });
});

describe('GIVEN a game played to the end', () => {
  const solveAll = () => {
    let s = init(mini105);
    for (const [r, c] of allCells(s.p))
      s = play(s, { t: 'cell', r, c }, { t: 'key', ch: mini105.grid[r]![c]! });
    return s;
  };

  describe('WHEN the last letter goes in', () => {
    it('THEN it is solved, every square good, and later keys do nothing', () => {
      const s = solveAll();
      expect(s.solved).toBe(true);
      expect(allCells(s.p).every(([r, c]) => s.checked[r]![c] === 'good')).toBe(true);
      expect(apply(s, { t: 'key', ch: 'Z' })).toBe(s);
      expect(apply(s, { t: 'del' })).toBe(s);
    });

    it('THEN finish gives the web’s record, outcome and tracker detail', () => {
      const s = solveAll();
      expect(finish(s, 87.9)).toEqual({
        rec: { s: 87 },
        outcome: 'solved',
        end: { secs: 87, checks: 0, reveals: 0, hints: 0 },
      });
      expect(endDetail(s, 87)).toEqual({
        type: 'crossword-mini',
        tv: 3,
        outcome: 'solved',
        secs: 87,
        checks: 0,
        reveals: 0,
        hints: 0,
      });
    });
  });

  describe('WHEN a finished puzzle is reopened', () => {
    it('THEN the grid is shown solved', () => {
      const s = restore(mini105);
      expect(s.solved).toBe(true);
      expect(letters(s)).toBe('MORE#/A#AND/PRIDE/SIN#A/#DYER');
    });
  });
});

describe('GIVEN the finish sheet’s line and clock', () => {
  const at = (checks: number, reveals: number) =>
    finishNote({ ...init(mini105), used: { checks, reveals } });

  it('THEN the note reads as the page writes it', () => {
    expect(at(0, 0)).toBe('No checks, no reveals.');
    expect(at(1, 0)).toBe('One check, no reveals.');
    expect(at(2, 1)).toBe('Two checks, one word revealed.');
    expect(at(0, 3)).toBe('No checks, three words revealed.');
    expect(at(11, 0)).toBe('11 checks, no reveals.');
  });

  it('THEN the clock is MM:SS and saved times are clamped', () => {
    expect(timerText(14)).toBe('00:14');
    expect(timerText(725)).toBe('12:05');
    expect(timerText(6000)).toBe('100:00');
    expect(recordSeconds({ s: 87.6 })).toBe(87);
    expect(recordSeconds({ s: -3 })).toBe(0);
    expect(recordSeconds({ s: 'x' })).toBe(0);
    expect(recordSeconds(null)).toBe(0);
    expect(recordSeconds({ s: 1e9 })).toBe(359999);
  });
});
