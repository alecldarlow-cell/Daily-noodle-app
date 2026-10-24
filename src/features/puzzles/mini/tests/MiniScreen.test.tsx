import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { MiniScreen } from '../components/MiniScreen';
import { SAVE_KEY, STREAK_KEY } from '../model';
import { file105, mini105 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;
// Each test plays a whole grid through the screen.
jest.setTimeout(30_000);

const clear = () => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
};
const press = (id: string) => fireEvent.press(screen.getByTestId(id));

async function solveOnScreen() {
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      const ch = mini105.grid[r]![c]!;
      if (ch === '#') continue;
      await press(`cell-${r}-${c}`);
      await press(`key-${ch}`);
    }
}

let finishes: PuzzleFinish[] = [];
let off = () => {};
beforeEach(() => {
  clear();
  jest.clearAllMocks();
  finishes = [];
  off = onFinish((f) => finishes.push(f));
  mockSite({});
});
afterEach(async () => {
  off();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Mini not yet played', () => {
  describe('WHEN it opens', () => {
    it('THEN the start card says what the page says, and Play shows the board', async () => {
      await renderWithProviders(<MiniScreen file={file105} />);
      expect(screen.getByText('No. 105, Saturday 24 October')).toBeOnTheScreen();
      expect(
        screen.getByText('Ten clues, across and down. The clock starts with your first letter.'),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
      expect(screen.getByTestId('mini-board')).toBeOnTheScreen();
      expect(screen.getByText('Mini 105')).toBeOnTheScreen();
      expect(screen.getByText('00:00')).toBeOnTheScreen();
      expect(screen.getByTestId('clue-bar')).toHaveTextContent("1A 'Please, sir, I want some ___'");
    });
  });

  describe('WHEN it is played to the end through the board and keyboard', () => {
    it('THEN the result and streak are saved, the finish announced once, and the sheet shows', async () => {
      await renderWithProviders(<MiniScreen file={file105} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
      await solveOnScreen();
      const day = londonDay();
      expect(JSON.parse(appStorage.getItem(SAVE_KEY)!)).toEqual({
        v: 1,
        done: { 'DP·MINI·0105': { s: expect.any(Number), d: day } },
      });
      expect(JSON.parse(appStorage.getItem(STREAK_KEY)!)).toMatchObject({ last: day, streak: 1 });
      expect(finishes).toEqual([
        {
          path: 'reports/2026-10-24-crossword-mini-0105.html',
          type: 'mini',
          detail: expect.objectContaining({
            type: 'crossword-mini',
            tv: 3,
            outcome: 'solved',
            checks: 0,
          }),
        },
      ]);
      await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen(), {
        timeout: 3000,
      });
      expect(screen.getByText('No checks, no reveals.')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-share-text')).toHaveTextContent(/^✏️ Mini #105 — 0:0\d$/);
      expect(screen.getByTestId('solved-grid')).toBeOnTheScreen();
    });
  });
});

describe('GIVEN a Mini already finished on this phone', () => {
  it('THEN it opens on its sheet with the original time and never announces again', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87, d: '2026-10-24' } } }),
    );
    appStorage.setItem(
      STREAK_KEY,
      JSON.stringify({ last: '2026-10-24', streak: 2, best: 4, dates: [] }),
    );
    await renderWithProviders(<MiniScreen file={file105} />);
    expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('finish-hero')).toHaveTextContent('1:27');
    expect(screen.getByTestId('finish-share-text')).toHaveTextContent('✏️ Mini #105 — 1:27 · 🔥2');
    expect(screen.queryByText('No checks, no reveals.')).toBeNull();
    expect(finishes).toEqual([]);
    await fireEvent.press(screen.getByText('← Puzzles'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('GIVEN the board in play', () => {
  afterEach(() => jest.useRealTimers());

  it('THEN the clock waits for the first letter, then ticks each second', async () => {
    jest.useFakeTimers();
    await renderWithProviders(<MiniScreen file={file105} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByText('00:00')).toBeOnTheScreen();
    await press('key-M');
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('00:03')).toBeOnTheScreen();
  });

  it('THEN the clue bar, arrows, delete and the help buttons work as on the page', async () => {
    await renderWithProviders(<MiniScreen file={file105} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await fireEvent.press(screen.getByTestId('clue-bar'));
    expect(screen.getByTestId('clue-bar')).toHaveTextContent('1D Ordnance Survey sheets');
    await fireEvent.press(screen.getByRole('button', { name: 'Next clue' }));
    expect(screen.getByTestId('clue-bar')).toHaveTextContent('2D Showery');
    await fireEvent.press(screen.getByRole('button', { name: 'Previous clue' }));
    await press('key-X');
    await press('key-del');
    await press('key-del');
    await fireEvent.press(screen.getByRole('button', { name: 'Check word' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Check all' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Reveal word' }));
    expect(screen.getByTestId('cell-3-0')).toHaveAccessibleName(/S$/);
    await solveOnScreen();
    await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen(), {
      timeout: 3000,
    });
    expect(screen.getByText('Two checks, one word revealed.')).toBeOnTheScreen();
    expect(finishes[0]!.detail).toMatchObject({ checks: 2, reveals: 1 });
    await fireEvent.press(screen.getByTestId('finish-next'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
