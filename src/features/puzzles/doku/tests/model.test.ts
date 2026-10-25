import {
  apply,
  bankTiles,
  countSolutions,
  endDetail,
  findSlots,
  finish,
  finishNote,
  fullNoteText,
  goodSquares,
  init,
  letterAt,
  message,
  recapSub,
  recordSeconds,
  restore,
  status,
  timerText,
  validate,
  type DokuData,
  type DokuState,
  type Move,
} from '../model';
import { clone, doku104, doku97, openSquares } from './fixtures';

const play = (s: DokuState, ...moves: Move[]) => moves.reduce(apply, s);
/** Tile then square for every open square, with the letters given (default: the answer). */
function fill(d: DokuData, letters = openSquares(d).map(([r, c]) => d.grid[r]![c]!)) {
  let s = init(d);
  openSquares(d).forEach(([r, c], k) => {
    const t = s.tiles.find((t) => !t.at && t.ch === letters[k]);
    s = play(s, { t: 'tile', id: t!.id }, { t: 'cell', r, c });
  });
  return s;
}

describe('GIVEN the page’s ship gate', () => {
  describe('WHEN a published Doku is checked', () => {
    it('THEN it passes, with exactly one solution', () => {
      expect(validate(doku97).ok).toBe(true);
      expect(validate(doku104).ok).toBe(true);
      const g = doku97.grid.map((r) => r.map((x) => (x === '#' ? '#' : x.toLowerCase())));
      const lk = doku97.locked.map(([r, c]) => [r! - 1, c! - 1]);
      expect(
        countSolutions(
          g,
          lk,
          doku97.bank.map((x) => x.toLowerCase()),
        ),
      ).toBe(1);
    });
  });

  describe('WHEN the data is something the page would throw on', () => {
    it.each([
      ['not lexi', (d: DokuData) => Object.assign(d, { type: 'mini' })],
      ['an id the share line cannot use', (d: DokuData) => Object.assign(d, { id: 'X' })],
      ['a short grid', (d: DokuData) => void d.grid.pop()],
      ['a number in the grid', (d: DokuData) => void (d.grid[0]![1] = 7 as unknown as string)],
      ['a lock that is not a pair of integers', (d: DokuData) => void (d.locked[0] = [1.5, 2])],
      ['a bank that is not letters', (d: DokuData) => void (d.bank[0] = 3 as unknown as string)],
      ['a band the engine does not know', (d: DokuData) => Object.assign(d, { band: 'tricky' })],
    ])('THEN %s is refused', (_label, edit) => {
      const d = clone(doku97);
      edit(d);
      expect(validate(d).ok).toBe(false);
    });
    it('THEN data that is not an object is refused', () => {
      expect(validate(null).ok).toBe(false);
      expect(validate([]).ok).toBe(false);
    });
  });

  describe('WHEN the gate itself would refuse to render it', () => {
    it('THEN a bank that does not match the open squares is refused', () => {
      const d = clone(doku97);
      d.bank[0] = 'Z';
      expect(validate(d).checks).toMatchObject({ bank_conserves_letters: false });
    });
    it('THEN a run that is not a word, or a two-letter run, is refused', () => {
      const d = clone(doku97);
      d.grid[0]![2] = 'X';
      expect(validate(d).checks).toMatchObject({ grid_is_valid_mini: false });
      const e = clone(doku97);
      e.grid[0]![3] = '#';
      expect(findSlots(e.grid)).toBeNull();
      expect(validate(e).ok).toBe(false);
    });
    it('THEN too few or misplaced locks are refused', () => {
      const d = clone(doku97);
      d.locked = [[1, 1]]; // a block
      expect(validate(d).checks).toMatchObject({ locks_wellformed: false });
    });
    it('THEN a puzzle with more than one answer is refused', () => {
      // CELLO / ARBOR / PASTE with one lock fewer: still words, no longer unique or dense enough
      const d = clone(doku104);
      d.locked = [[4, 4]];
      d.bank = [...d.bank, 'O'];
      expect(validate(d).ok).toBe(false);
    });
  });
});

describe('GIVEN a new Doku', () => {
  it('THEN the cursor is on the first open square, across, the bank full, Hints on', () => {
    const s = init(doku97);
    expect(s.sel).toEqual({ r: 0, c: 2, dir: 'A' });
    expect(s.view).toEqual(s.sel);
    expect(s.entries[0]![1]).toBe('L');
    expect(letterAt(s, 0, 1)).toBe('S');
    expect(bankTiles(s).map((t) => t.ch)).toEqual(doku97.bank);
    expect(s.hints).toBe(true);
    expect(status(s)).toEqual({ solved: false, started: false, full: false });
    expect(message(s, '00:00')).toBe('');
  });

  describe('WHEN a tile is chosen and a square tapped', () => {
    it('THEN the tile goes down, the clock starts and the cursor moves to the next empty square', () => {
      let s = play(init(doku97), { t: 'tile', id: 't0' });
      expect(s.selTile).toBe('t0');
      expect(s.started).toBe(false);
      s = apply(s, { t: 'cell', r: 0, c: 2 });
      expect(s.entries[0]![2]).toBe('t0');
      expect(s.selTile).toBeNull();
      expect(s.started).toBe(true);
      expect(s.sel).toEqual({ r: 0, c: 3, dir: 'A' });
      expect(bankTiles(s).map((t) => t.id)).not.toContain('t0');
    });
    it('THEN tapping the same tile again puts it down, another tile replaces it', () => {
      const s = play(init(doku97), { t: 'tile', id: 't0' }, { t: 'tile', id: 't1' });
      expect(s.selTile).toBe('t1');
      expect(apply(s, { t: 'tile', id: 't1' }).selTile).toBeNull();
      expect(apply(s, { t: 'tile', id: 'nope' })).toBe(s);
    });
  });

  describe('WHEN the word is right and the cursor runs out of the word', () => {
    it('THEN the word turns green and the cursor jumps to the next empty square in the grid', () => {
      const s = play(
        init(doku97),
        { t: 'tile', id: 't0' },
        { t: 'cell', r: 0, c: 2 },
        { t: 'key', ch: 'e' },
      );
      expect(letterAt(s, 0, 3)).toBe('E');
      expect(s.sel).toEqual({ r: 1, c: 0, dir: 'A' });
      expect([...goodSquares(s)].sort()).toEqual(['0,1', '0,2', '0,3', '0,4']);
      // Hints off: no green
      expect(goodSquares(apply(s, { t: 'hints' })).size).toBe(0);
    });
  });

  describe('WHEN a placed letter is tapped', () => {
    it('THEN it goes back to the bank and the cursor lands there', () => {
      let s = play(init(doku97), { t: 'tile', id: 't0' }, { t: 'cell', r: 0, c: 2 });
      s = apply(s, { t: 'cell', r: 0, c: 2 });
      expect(s.entries[0]![2]).toBe('');
      expect(s.sel).toMatchObject({ r: 0, c: 2 });
      expect(bankTiles(s)[0]!.id).toBe('t0');
    });
    it('THEN with a tile chosen, the tile stays chosen for the next square', () => {
      let s = play(init(doku97), { t: 'tile', id: 't0' }, { t: 'cell', r: 0, c: 2 });
      s = play(s, { t: 'tile', id: 't1' }, { t: 'cell', r: 0, c: 2 });
      expect(s.selTile).toBe('t1');
      expect(s.entries[0]![2]).toBe('');
    });
  });

  describe('WHEN a given square or a block is tapped', () => {
    it('THEN a given square only moves the cursor; a block does nothing but take the keyboard down', () => {
      let s = apply(init(doku97), { t: 'cell', r: 2, c: 0 });
      expect(s.sel).toEqual({ r: 2, c: 0, dir: 'A' });
      expect(s.entries[2]![0]).toBe('L');
      s = play(s, { t: 'cell', r: 0, c: 2 });
      expect(s.kbd).toBe(true);
      const b = apply(s, { t: 'cell', r: 0, c: 0 });
      expect(b.kbd).toBe(false);
      expect(b.sel).toEqual(s.sel);
      expect(apply(s, { t: 'cell', r: 9, c: 9 })).toBe(s);
    });
  });

  describe('WHEN an empty square is tapped with no tile chosen', () => {
    it('THEN the keyboard comes up; tapping it again switches across and down where it can', () => {
      let s = apply(init(doku97), { t: 'cell', r: 1, c: 0 });
      // (1,0) has no across word, so it turns down
      expect(s.sel).toEqual({ r: 1, c: 0, dir: 'D' });
      expect(s.kbd).toBe(true);
      s = apply(s, { t: 'cell', r: 1, c: 0 });
      expect(s.sel.dir).toBe('D');
      s = play(s, { t: 'cell', r: 2, c: 2 }, { t: 'cell', r: 2, c: 2 });
      expect(s.sel).toEqual({ r: 2, c: 2, dir: 'A' });
      expect(apply(s, { t: 'space' }).sel.dir).toBe('D');
      expect(apply(s, { t: 'tile', id: 't0' }).kbd).toBe(false);
      expect(apply(s, { t: 'hints' }).kbd).toBe(false);
    });
  });

  describe('WHEN letters are typed', () => {
    it('THEN each one is pulled from the bank; one the bank lacks shakes the square, unpainted', () => {
      let s = play(init(doku97), { t: 'cell', r: 0, c: 2 }, { t: 'key', ch: 't' });
      expect(letterAt(s, 0, 2)).toBe('T');
      expect(apply(s, { t: 'key', ch: '1' })).toBe(s);
      s = apply(s, { t: 'cell', r: 0, c: 1 }); // a given square
      const z = apply(s, { t: 'key', ch: 'z' });
      expect(z.shakes).toBe(s.shakes + 1);
      // the engine moved its cursor on to an empty square but never repainted
      expect(z.sel).toEqual({ r: 0, c: 3, dir: 'A' });
      expect(z.view).toEqual({ r: 0, c: 1, dir: 'A' });
    });
    it('THEN on a full grid a letter does nothing', () => {
      const s = fill(doku97, swapped(doku97));
      expect(apply(s, { t: 'key', ch: 'a' })).toEqual(s);
    });
  });

  describe('WHEN delete is pressed', () => {
    it('THEN on an empty square at the start it does nothing but start the clock', () => {
      const s = play(init(doku97), { t: 'cell', r: 0, c: 2 }, { t: 'del' });
      expect(s.started).toBe(true);
      expect(bankTiles(s)).toHaveLength(12);
    });
    it('THEN on a placed letter it sends it back; on an empty one it walks back through the word', () => {
      let s = play(
        init(doku97),
        { t: 'cell', r: 2, c: 2 },
        { t: 'cell', r: 2, c: 2 },
        { t: 'key', ch: 'n' },
        { t: 'key', ch: 'd' },
      );
      expect(s.sel).toEqual({ r: 2, c: 4, dir: 'A' });
      s = apply(s, { t: 'del' });
      expect(s.sel).toEqual({ r: 2, c: 3, dir: 'A' });
      expect(letterAt(s, 2, 3)).toBe('');
      s = apply(s, { t: 'key', ch: 'd' });
      s = play(s, { t: 'cell', r: 2, c: 3 }, { t: 'cell', r: 2, c: 3 }); // tap D: back to bank, then on it
      s = play(s, { t: 'key', ch: 'd' });
      // a placed letter under the cursor
      const on = play(
        init(doku97),
        { t: 'tile', id: 't0' },
        { t: 'cell', r: 0, c: 2 },
        { t: 'cell', r: 0, c: 1 },
      );
      const back = play(on, { t: 'cell', r: 0, c: 3 }, { t: 'del' });
      expect(letterAt(back, 0, 2)).toBe('');
    });
  });
});

/** The answer's letters with the first and the next different letter swapped. */
function swapped(d: DokuData) {
  const want = openSquares(d).map(([r, c]) => d.grid[r]![c]!);
  const j = want.findIndex((ch) => ch !== want[0]);
  [want[0], want[j]] = [want[j]!, want[0]!];
  return want;
}

describe('GIVEN a full grid that isn’t the answer', () => {
  it('THEN the note says how many squares are off, in its Hints-off words too, and clears when one goes back', () => {
    let s = fill(doku97, swapped(doku97));
    expect(s.solved).toBe(false);
    expect(status(s).full).toBe(true);
    expect(s.msg).toBe(
      "The grid's full, but 2 squares aren't today's answer. Tap a letter to send it back.",
    );
    s = apply(s, { t: 'hints' });
    expect(s.msg).toBe(fullNoteText(2, false));
    expect(fullNoteText(1, true)).toContain("1 square isn't");
    s = apply(s, { t: 'cell', r: 0, c: 2 });
    expect(s.msg).toBe('');
    expect(s.fullShown).toBe(false);
  });
});

describe('GIVEN the last tile goes down right', () => {
  it('THEN it is solved, every square green, and nothing else moves', () => {
    const s = fill(doku97);
    expect(s.solved).toBe(true);
    expect(goodSquares(s).size).toBe(17);
    expect(message(s, '01:27')).toBe('Solved in 01:27. Nice.');
    for (const m of [
      { t: 'tile', id: 't0' },
      { t: 'cell', r: 0, c: 2 },
      { t: 'key', ch: 'a' },
      { t: 'del' },
    ] as Move[])
      expect(apply(s, m).entries).toEqual(s.entries);
    // the Hints switch still repaints, as on the page
    expect(apply(s, { t: 'hints' }).allGood).toBe(false);
    expect(finish(s, 87.9)).toEqual({
      rec: { s: 87 },
      outcome: 'solved',
      end: { secs: 87, checks: 0, reveals: 0, hints: 0 },
    });
    expect(endDetail(s, 87)).toEqual({
      type: 'logic-doku',
      tv: 3,
      outcome: 'solved',
      secs: 87,
      checks: 0,
      reveals: 0,
      hints: 0,
    });
    expect(finishNote(s)).toBe('All twelve tiles placed.');
    expect(finishNote({ tiles: Array(20).fill({}) })).toBe('All 20 tiles placed.');
    expect(recapSub(s.p)).toBe('The five given letters are shaded.');
  });

  it('THEN reopening shows the solved board', () => {
    const r = restore(doku97);
    expect(r.solved).toBe(true);
    expect(goodSquares(r).size).toBe(17);
    expect(bankTiles(r)).toHaveLength(0);
    // a bank that can't rebuild it leaves a fresh board, as the page does
    const bad = clone(doku97);
    bad.bank[0] = 'Z';
    expect(restore(bad).solved).toBe(false);
  });
});

describe('GIVEN the clock and saved times', () => {
  it('THEN they read as the page writes them', () => {
    expect(timerText(14)).toBe('00:14');
    expect(timerText(6000)).toBe('100:00');
    expect(recordSeconds({ s: 87.6 })).toBe(87);
    expect(recordSeconds({ s: -3 })).toBe(0);
    expect(recordSeconds(null)).toBe(0);
    expect(recordSeconds({ s: 1e9 })).toBe(359999);
  });
});
