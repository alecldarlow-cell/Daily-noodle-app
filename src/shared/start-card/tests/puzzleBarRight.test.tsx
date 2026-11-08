import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '@/shared/testing';
import { puzzleTokensFor } from '@/shared/theme';

import { PuzzleBar } from '../PuzzleBar';

const pt = puzzleTokensFor('light');
const color = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).color;

describe('GIVEN the bar over a puzzle', () => {
  describe('WHEN the type is scored rather than timed (Reckon, Borders)', () => {
    it('THEN the right side shows the points in place of a clock, read with their number', async () => {
      await renderWithProviders(
        <PuzzleBar name="Borders 41" streak={2} score={100} clock="0:09" onBack={jest.fn()} />,
      );
      expect(screen.getByTestId('puzzle-score')).toHaveTextContent('100 pts');
      expect(screen.getByLabelText('100 points so far')).toBeOnTheScreen();
      expect(screen.queryByTestId('puzzle-clock')).toBeNull();
      expect(screen.getByLabelText('2-day streak')).toBeOnTheScreen();
    });
  });

  describe('WHEN the clock is running out', () => {
    it('THEN it turns the boards’ red, and is ink otherwise', async () => {
      const r = await renderWithProviders(
        <PuzzleBar name="Tangle 19" streak={0} clock="0:08" urgent onBack={jest.fn()} />,
      );
      expect(color('puzzle-clock')).toBe(pt.bad);
      await r.rerender(<PuzzleBar name="Tangle 19" streak={0} clock="0:40" onBack={jest.fn()} />);
      expect(color('puzzle-clock')).toBe(pt.ink);
    });
  });

  describe('WHEN a type brings its own palette', () => {
    it('THEN the name and clock take its ink', async () => {
      await renderWithProviders(
        <PuzzleBar
          name="Reckon 23"
          streak={0}
          clock="0:01"
          colors={{ ink: '#F2EBDF', inkSoft: '#A39A8C', card: '#25221D', line: '#4A443A' }}
          onBack={jest.fn()}
        />,
      );
      expect(color('puzzle-clock')).toBe('#F2EBDF');
      expect(StyleSheet.flatten(screen.getByRole('header').props.style).color).toBe('#F2EBDF');
    });
  });
});
