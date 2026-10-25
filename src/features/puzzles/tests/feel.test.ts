/**
 * Each type's haptics rule (hooks/feel.ts), fed the type's own model states: what a
 * move feels like is read from the state before and after it, never added to a model.
 */
import { dokuFeel } from '../doku/hooks/feel';
import * as doku from '../doku/model';
import { doku97, openSquares } from '../doku/tests/fixtures';
import { linkFeel } from '../link/hooks/feel';
import * as link from '../link/model';
import { link78 } from '../link/tests/fixtures';
import { miniFeel } from '../mini/hooks/feel';
import * as mini from '../mini/model';
import { mini105 } from '../mini/tests/fixtures';
import { pathFeel } from '../path/hooks/feel';
import * as path from '../path/model';
import { path92 } from '../path/tests/fixtures';
import { sweepFeel } from '../sweep/hooks/feel';
import * as sweep from '../sweep/model';
import { sweep94 } from '../sweep/tests/fixtures';
import { tangleFeel, tangleSnap } from '../tangle/hooks/feel';
import type { TangleEngine } from '../tangle/model';

describe('GIVEN a Mini', () => {
  const s0 = mini.apply(mini.init(mini105), { t: 'cell', r: 0, c: 0 });
  describe('WHEN a letter goes in', () => {
    it('THEN it is a light tap; moving the cursor is nothing', () => {
      expect(miniFeel(s0, mini.apply(s0, { t: 'key', ch: 'M' }))).toBe('tap');
      expect(miniFeel(s0, mini.apply(s0, { t: 'cell', r: 1, c: 0 }))).toBeNull();
    });
  });
  describe('WHEN a check finds a wrong letter', () => {
    it('THEN it is an error buzz; a check with nothing wrong is nothing', () => {
      const wrong = mini.apply(s0, { t: 'key', ch: 'X' });
      expect(miniFeel(wrong, mini.apply(wrong, { t: 'checkAll' }))).toBe('error');
      const right = mini.apply(s0, { t: 'key', ch: 'M' });
      expect(miniFeel(right, mini.apply(right, { t: 'checkAll' }))).toBeNull();
    });
  });
  describe('WHEN the last letter solves it', () => {
    it('THEN it is a success', () => {
      expect(miniFeel(s0, { ...s0, solved: true })).toBe('success');
    });
  });
});

describe('GIVEN a Doku', () => {
  describe('WHEN a tile is put down, and when the grid is solved', () => {
    it('THEN a tap, then a success; picking a tile up is nothing', () => {
      const s0 = doku.init(doku97);
      const tile = doku.bankTiles(s0)[0]!;
      const picked = doku.apply(s0, { t: 'tile', id: tile.id });
      expect(dokuFeel(s0, picked)).toBeNull();
      const [r, c] = openSquares(doku97)[0]!;
      expect(dokuFeel(picked, doku.apply(picked, { t: 'cell', r, c }))).toBe('tap');
      expect(dokuFeel(s0, { ...s0, solved: true })).toBe('success');
    });
  });
});

describe('GIVEN a Path', () => {
  describe('WHEN a number goes down, and when the last square fills', () => {
    it('THEN a tap, then a success; an Undo is nothing', () => {
      const s0 = path.init(path92);
      const next = { ...s0, history: [{} as (typeof s0.history)[number]] };
      expect(pathFeel(s0, next)).toBe('tap');
      expect(pathFeel(next, s0)).toBeNull();
      expect(pathFeel(next, { ...next, solved: true })).toBe('success');
    });
  });
});

describe('GIVEN a Sweep', () => {
  const START = 22;
  const s0 = sweep.init(sweep94, { ranked: true });
  const dug = sweep.apply(s0, { t: 'tap', i: START });
  describe('WHEN the start is dug', () => {
    it('THEN it is a light tap', () => {
      expect(sweepFeel(s0, dug)).toBe('tap');
    });
  });
  describe('WHEN a mine is dug', () => {
    it('THEN it is an error buzz', () => {
      expect(sweepFeel(dug, sweep.apply(dug, { t: 'tap', i: 2 }))).toBe('error');
    });
  });
  describe('WHEN the board is cleared, and when Play again deals a new board', () => {
    it('THEN a success, and the new board is silent', () => {
      expect(sweepFeel(dug, { ...dug, won: true })).toBe('success');
      expect(sweepFeel(dug, { ...dug, round: dug.round + 1, revealed: new Set([1, 2, 3]) })).toBe(
        null,
      );
    });
  });
});

describe('GIVEN a Link', () => {
  const G = link78.groups.map((g) => g.members.map((w) => w.toUpperCase()));
  const s0 = link.apply(link.init(link78, link.allTiles(link78), { ranked: true, rec: null }), {
    t: 'play',
  });
  const pick = (s: link.LinkState, ws: string[]) =>
    ws.reduce((x, w) => link.apply(x, { t: 'tile', w }), s);
  describe('WHEN a tile is picked up', () => {
    it('THEN it is a light tap', () => {
      expect(linkFeel(s0, link.apply(s0, { t: 'tile', w: G[0]![0]! }))).toBe('tap');
    });
  });
  describe('WHEN a wrong four is submitted', () => {
    it('THEN it is an error buzz', () => {
      const held = pick(s0, [G[0]![0]!, G[0]![1]!, G[0]![2]!, G[1]![0]!]);
      expect(linkFeel(held, link.apply(held, { t: 'submit' }))).toBe('error');
    });
  });
  describe('WHEN a right four lands, and when the board is won', () => {
    it('THEN a tap, then a success', () => {
      const held = link.apply(pick(s0, G[0]!), { t: 'submit' });
      const landed = link.apply(held, { t: 'land' });
      expect(linkFeel(held, landed)).toBe('tap');
      expect(linkFeel(landed, { ...landed, won: true, over: true })).toBe('success');
    });
  });
  describe('WHEN a lost board turns its groups over', () => {
    it('THEN nothing more buzzes', () => {
      const lost = { ...s0, over: true, won: false, revealing: true };
      expect(linkFeel(lost, link.apply(lost, { t: 'revealed' }))).toBeNull();
    });
  });
});

describe('GIVEN a Tangle', () => {
  const engine = (found: number, view: string, freshResult: boolean) =>
    ({
      s: { R: { found: Array.from({ length: found }, () => 'w') }, view, freshResult },
    }) as unknown as TangleEngine;
  describe('WHEN a word is found, and when the round ends', () => {
    it('THEN a tap, then a success; a result reopened is silent', () => {
      const a = tangleSnap(engine(1, 'play', false));
      expect(tangleFeel(a, tangleSnap(engine(2, 'play', false)))).toBe('tap');
      expect(tangleFeel(a, tangleSnap(engine(1, 'winModal', true)))).toBe('success');
      expect(tangleFeel(a, tangleSnap(engine(1, 'winModal', false)))).toBeNull();
      expect(tangleSnap({ s: { R: null, view: 'home' } } as unknown as TangleEngine)).toEqual({
        found: 0,
        ended: false,
      });
    });
  });
});
