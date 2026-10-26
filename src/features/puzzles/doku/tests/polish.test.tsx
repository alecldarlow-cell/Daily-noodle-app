import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';

import { appStorage } from '@/shared/storage';
import { heldStyle, mockSite, renderWithProviders } from '@/shared/testing';
import { puzzleTokensFor } from '@/shared/theme';
import { PRESSED } from '@/shared/ui';

import { DokuScreen } from '../components/DokuScreen';
import { STREAK_KEY } from '../model';
import { file97 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const pt = puzzleTokensFor('light');
const play = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));
const tileFor = (ch: string) => screen.getAllByRole('button', { name: `Tile ${ch}` })[0]!;

let appState: ((s: AppStateStatus) => void)[] = [];
const setAppState = (s: AppStateStatus) => appState.forEach((fn) => fn(s));

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  mockSite({});
  appState = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
    appState.push(fn as (s: AppStateStatus) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Doku on the board', () => {
  describe('WHEN the cursor lands on a given square', () => {
    it('THEN the square keeps its shade and soft ink, ringed in marigold, so letter and cursor both show', async () => {
      await renderWithProviders(<DokuScreen file={file97} />);
      await play();
      await fireEvent.press(screen.getByTestId('cell-0-1'));
      const cell = screen.getByTestId('cell-0-1');
      expect(cell.props.accessibilityState).toMatchObject({ selected: true });
      const style = StyleSheet.flatten(cell.props.style);
      expect(style).toMatchObject({ borderWidth: 3, borderColor: pt.active });
      expect(style.backgroundColor).not.toBe(pt.active);
      expect(StyleSheet.flatten(within(cell).getByText('S').props.style).color).toBe(pt.inkSoft);
    });
  });

  describe('WHEN Hints is held', () => {
    it('THEN it shows the pressed look, as back does', async () => {
      await renderWithProviders(<DokuScreen file={file97} />);
      await play();
      expect(await heldStyle(screen.getByRole('button', { name: 'Hints: on' }))).toMatchObject(
        PRESSED,
      );
      expect(
        await heldStyle(screen.getByRole('button', { name: 'Back to Puzzles' })),
      ).toMatchObject(PRESSED);
    });
  });

  describe('WHEN the app goes to the background mid-puzzle', () => {
    it('THEN the clock stops while away and picks up on return', async () => {
      jest.useFakeTimers();
      await renderWithProviders(<DokuScreen file={file97} />);
      await play();
      await fireEvent.press(tileFor('T'));
      await fireEvent.press(screen.getByTestId('cell-1-0'));
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await act(async () => setAppState('background'));
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      await act(async () => setAppState('active'));
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('puzzle-clock')).toHaveTextContent('0:03');
    });
  });

  describe('WHEN the Doku streak is live', () => {
    it('THEN the bar’s flame is Doku’s own, as on its start card', async () => {
      appStorage.setItem(
        STREAK_KEY,
        JSON.stringify({ last: londonDay(), streak: 6, best: 9, dates: [londonDay()] }),
      );
      await renderWithProviders(<DokuScreen file={file97} />);
      expect(screen.getByText('6-day streak')).toBeOnTheScreen();
      await play();
      expect(screen.getByText('🔥6')).toBeOnTheScreen();
    });
  });
});
