/**
 * The puzzle pages' polish of 8 Nov 2026 (Alec's layout review): Path's clues boldest and
 * its far end ringed in blue, Tally's cage walls on one shared grid, Borders' scale bar
 * labelled at its ends.
 */
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/shared/testing';
import { FONT, puzzleTokensFor } from '@/shared/theme';

import type { BordersColors } from '../borders/components/colors';
import { mapHtml } from '../borders/components/drawing';
import { borders15 } from '../borders/tests/fixtures';
import { PathBoard } from '../path/components/PathBoard';
import { endMark, init as pathInit } from '../path/model';
import { path92 } from '../path/tests/fixtures';
import { cageLines } from '../tally/components/TallyBoard';
import { init as tallyInit, view } from '../tally/model';
import { tally1 } from '../tally/tests/fixtures';

const pt = puzzleTokensFor('light');

describe('GIVEN a Path on the board', () => {
  it('THEN its given checkpoints are full ink and heaviest, and the far end is ringed in blue, not marigold', async () => {
    const state = pathInit(path92);
    await renderWithProviders(<PathBoard state={state} side={360} onCell={jest.fn()} />);
    const [r, c] = path92.locked
      .map(([a, b]) => [a - 1, b - 1] as const)
      .find(([a, b]) => endMark(state, a, b) === null)!;
    const v = String(state.cellValue[r]![c]);
    const num = StyleSheet.flatten(screen.getByText(v).props.style);
    expect(num.color).toBe(pt.ink);
    expect(num.fontFamily).toBe(FONT.displayHeavy);
    const far = [...state.p.endKeys]
      .map((k) => k.split(',').map(Number) as [number, number])
      .find(([a, b]) => endMark(state, a, b) === 'endsel')!;
    const sq = StyleSheet.flatten(screen.getByTestId(`sq-${far[0]}-${far[1]}`).props.style);
    expect(sq.borderColor).toBe(pt.brand);
    expect(sq.borderColor).not.toBe(pt.active);
  });
});

describe('GIVEN a Tally board’s lines', () => {
  const state = tallyInit(tally1);
  const cells = view(state);
  const size = 80;
  const { inner, walls } = cageLines(cells, state.n, size);

  it('THEN every line between squares is drawn once, a full point thick', () => {
    expect(inner).toHaveLength(2 * (state.n - 1));
    for (const l of inner) expect(Math.min(l.width, l.height)).toBe(1);
  });

  it('THEN each cage wall is drawn once, on the shared grid, and runs past its corners so walls join', () => {
    const want = cells.reduce(
      (k, cell, i) =>
        k +
        (cell.br && i % state.n < state.n - 1 ? 1 : 0) +
        (cell.bb && i < cells.length - state.n ? 1 : 0),
      0,
    );
    expect(walls).toHaveLength(want);
    expect(new Set(walls.map((w) => w.key)).size).toBe(walls.length);
    for (const w of walls) {
      const long = Math.max(w.width, w.height);
      expect(long).toBe(size + 2.5);
      // a wall's thick axis is centred on a grid line
      const across = w.width < w.height ? w.left + w.width / 2 : w.top + w.height / 2;
      expect(across % size).toBeCloseTo(0);
    }
  });
});

describe('GIVEN a Borders map’s scale bar', () => {
  it('THEN its labels sit on the bar’s two ends: 0 at the start, the distance centred on the end, km after it', () => {
    const html = mapHtml(borders15.qs[0]!, false, {} as BordersColors); // colours don't matter here
    expect(html).toContain('<span style="left:0">0</span>');
    expect(html).toContain(
      "'px\">'+(nice>=1000?nice.toLocaleString('en-GB'):nice)+'<b>km</b></span>'",
    );
    expect(html).toContain('.lab span{position:absolute;top:0;transform:translateX(-50%)');
  });
});
