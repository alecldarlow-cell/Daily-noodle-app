import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';

import { appStorage } from '@/shared/storage';
import { heldStyle, mockSite, renderWithProviders } from '@/shared/testing';
import { puzzleTokensFor } from '@/shared/theme';
import { PRESSED } from '@/shared/ui';

import { clueNumSize, MiniBoard } from '../components/MiniBoard';
import { MiniScreen } from '../components/MiniScreen';
import { init, STREAK_KEY } from '../model';
import { file105, mini105 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const pt = puzzleTokensFor('light');
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const play = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));

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

describe('GIVEN a Mini on the board', () => {
  describe('WHEN Check word marks the letter under the cursor wrong', () => {
    it('THEN that letter stays dark ink on the marigold, with the red dot to say it is wrong', async () => {
      await renderWithProviders(<MiniScreen file={file105} />);
      await play();
      await press('cell-0-1');
      await press('key-X');
      await press('cell-0-1'); // back onto the X
      await fireEvent.press(screen.getByRole('button', { name: 'Check word' }));
      const cell = screen.getByTestId('cell-0-1');
      expect(cell).toHaveAccessibleName(/X, wrong$/);
      expect(StyleSheet.flatten(cell.props.style).backgroundColor).toBe(pt.active);
      expect(StyleSheet.flatten(within(cell).getByText('X').props.style).color).toBe(pt.onActive);
      // off the cursor, a wrong letter is red as before
      await press('cell-2-0');
      expect(StyleSheet.flatten(within(cell).getByText('X').props.style).color).toBe(pt.bad);
    });
  });

  describe('WHEN the controls are held', () => {
    it('THEN Check word, Check all, Reveal word, the clue arrows and back all show the pressed look', async () => {
      await renderWithProviders(<MiniScreen file={file105} />);
      await play();
      for (const name of [
        'Check word',
        'Check all',
        'Reveal word',
        'Previous clue',
        'Next clue',
        'Back to Puzzles',
      ])
        expect(await heldStyle(screen.getByRole('button', { name }))).toMatchObject(PRESSED);
    });
  });

  describe('WHEN the board’s slot is short (large text, a small phone)', () => {
    it('THEN the board shrinks to the room it has instead of spilling onto the controls', async () => {
      await renderWithProviders(<MiniScreen file={file105} />);
      await play();
      await fireEvent(screen.getByTestId('board-slot'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 366, height: 206 } },
      });
      expect(StyleSheet.flatten(screen.getByTestId('mini-board').props.style)).toMatchObject({
        width: 206,
        height: 206,
      });
    });
  });

  describe('WHEN the app goes to the background mid-puzzle', () => {
    it('THEN the clock stops while away and picks up on return', async () => {
      jest.useFakeTimers();
      await renderWithProviders(<MiniScreen file={file105} />);
      await play();
      await press('key-M');
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('puzzle-clock')).toHaveTextContent('0:02');
      await act(async () => setAppState('background'));
      await act(async () => {
        jest.advanceTimersByTime(90_000);
      });
      await act(async () => setAppState('active'));
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('puzzle-clock')).toHaveTextContent('0:03');
    });
  });

  describe('WHEN the Mini streak has lapsed', () => {
    it('THEN the bar shows no flame, as the start card shows none', async () => {
      appStorage.setItem(
        STREAK_KEY,
        JSON.stringify({ last: '2026-01-02', streak: 13, best: 13, dates: ['2026-01-02'] }),
      );
      await renderWithProviders(<MiniScreen file={file105} />);
      await play();
      expect(screen.queryByText(/🔥/)).toBeNull();
    });
  });
});

describe('GIVEN the Mini’s clue numbers', () => {
  describe('WHEN the board is narrow (a 320 pt phone: 58 pt squares and under)', () => {
    it('THEN a number is never smaller than 10 pt', async () => {
      expect(clueNumSize(50)).toBe(10);
      expect(clueNumSize(58)).toBe(10);
      await renderWithProviders(<MiniBoard state={init(mini105)} side={250} onCell={() => {}} />);
      expect(within(screen.getByTestId('cell-0-0')).getByText('1')).toHaveStyle({ fontSize: 10 });
    });
  });
  describe('WHEN the board is roomy', () => {
    it('THEN it keeps 17% of the square, as before', () => {
      expect(clueNumSize(80)).toBeCloseTo(13.6);
    });
  });
  describe('WHEN the board is tiny (a short phone at large text)', () => {
    it('THEN it stays within 30% of the square, clear of the letter', () => {
      expect(clueNumSize(30)).toBeCloseTo(9);
    });
  });
});
