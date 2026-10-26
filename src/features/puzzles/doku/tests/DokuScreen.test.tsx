import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { DokuScreen } from '../components/DokuScreen';
import { SAVE_KEY, STREAK_KEY } from '../model';
import { doku97, file97, openSquares } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;
jest.setTimeout(30_000);

const clear = () => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
};
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const tileFor = (ch: string) => screen.getAllByRole('button', { name: `Tile ${ch}` })[0]!;

/** Tile, then square, for every open square (the letters given, else the answer). */
async function fillOnScreen(letters = openSquares(doku97).map(([r, c]) => doku97.grid[r]![c]!)) {
  const sq = openSquares(doku97);
  for (let k = 0; k < sq.length; k++) {
    await fireEvent.press(tileFor(letters[k]!));
    await press(`cell-${sq[k]![0]}-${sq[k]![1]}`);
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

const play = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));

describe('GIVEN a Doku not yet played', () => {
  describe('WHEN it opens', () => {
    it('THEN the start card says what the page says, and Play shows the board and bank', async () => {
      await renderWithProviders(<DokuScreen file={file97} />);
      expect(screen.getByText('No. 97, Sunday 18 October')).toBeOnTheScreen();
      expect(
        screen.getByText('Place the twelve letter tiles so every word across and down is real.'),
      ).toBeOnTheScreen();
      await play();
      expect(screen.getByTestId('doku-board')).toBeOnTheScreen();
      expect(screen.getByText('Doku 97')).toBeOnTheScreen();
      expect(screen.getByText('0:00')).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: /^Tile / })).toHaveLength(12);
      expect(screen.getByTestId('cell-0-1')).toHaveAccessibleName(/S, given$/);
      expect(screen.getByText('Hints: on')).toBeOnTheScreen();
    });
  });

  describe('WHEN Doku has results but no streak of its own yet', () => {
    it('THEN the streak is rebuilt from them before the start card shows it', async () => {
      const yesterday = (() => {
        const d = new Date(`${londonDay()}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().slice(0, 10);
      })();
      appStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ v: 1, done: { 'DP·LEXI·0096': { s: 50, d: yesterday } } }),
      );
      await renderWithProviders(<DokuScreen file={file97} />);
      expect(JSON.parse(appStorage.getItem(STREAK_KEY)!)).toMatchObject({
        last: yesterday,
        streak: 1,
        seeded: 1,
      });
      expect(screen.getByText('1-day streak')).toBeOnTheScreen();
    });
  });

  describe('WHEN it is played to the end with tiles', () => {
    it('THEN the result and streak are saved, the finish announced once, and the sheet shows', async () => {
      await renderWithProviders(<DokuScreen file={file97} />);
      await play();
      await fillOnScreen();
      expect(screen.getByTestId('doku-msg')).toHaveTextContent(/^Solved in 00:0\d\. Nice\.$/);
      const day = londonDay();
      expect(JSON.parse(appStorage.getItem(SAVE_KEY)!)).toEqual({
        v: 1,
        done: { 'DP·LEXI·0097': { s: expect.any(Number), d: day } },
      });
      expect(JSON.parse(appStorage.getItem(STREAK_KEY)!)).toMatchObject({ last: day, streak: 1 });
      expect(finishes).toEqual([
        {
          path: 'reports/2026-10-18-logic-doku-0097.html',
          type: 'doku',
          detail: {
            type: 'logic-doku',
            tv: 3,
            outcome: 'solved',
            secs: expect.any(Number),
            checks: 0,
            reveals: 0,
            hints: 0,
          },
        },
      ]);
      await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen(), {
        timeout: 3000,
      });
      expect(screen.getByText('All twelve tiles placed.')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-share-text')).toHaveTextContent(/^🔢 Doku #97 — 0:0\d$/);
      expect(screen.getByText('The five given letters are shaded.')).toBeOnTheScreen();
      expect(screen.getByTestId('given-0-1')).toBeOnTheScreen();
      expect(screen.getByText('Dokus played')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('finish-next'));
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  describe('WHEN the grid is full but wrong', () => {
    it('THEN the note says so, follows Hints, and clears when a letter goes back', async () => {
      await renderWithProviders(<DokuScreen file={file97} />);
      await play();
      const want = openSquares(doku97).map(([r, c]) => doku97.grid[r]![c]!);
      const j = want.findIndex((ch) => ch !== want[0]);
      [want[0], want[j]] = [want[j]!, want[0]!];
      await fillOnScreen(want);
      expect(screen.getByTestId('doku-msg')).toHaveTextContent(
        "The grid's full, but 2 squares aren't today's answer. Tap a letter to send it back.",
      );
      await fireEvent.press(screen.getByText('Hints: on'));
      expect(screen.getByText('Hints: off')).toBeOnTheScreen();
      expect(screen.getByTestId('doku-msg')).toHaveTextContent(
        "The grid's full, but it isn't today's answer. Tap a letter to send it back.",
      );
      await press('cell-0-2');
      expect(screen.getByTestId('doku-msg')).toHaveTextContent('');
      expect(finishes).toEqual([]);
    });
  });
});

describe('GIVEN the phone’s keyboard', () => {
  it('THEN a tapped square takes typed letters from the bank, space turns, delete sends back', async () => {
    await renderWithProviders(<DokuScreen file={file97} />);
    await play();
    await press('cell-2-2');
    const keys = screen.getByTestId('doku-keys', { includeHiddenElements: true });
    await fireEvent.changeText(keys, 'n');
    expect(screen.getByTestId('cell-2-2')).toHaveAccessibleName(/N$/);
    expect(screen.getAllByRole('button', { name: /^Tile / })).toHaveLength(11);
    await fireEvent(keys, 'keyPress', { nativeEvent: { key: 'a' } }); // letters come by changeText
    await fireEvent(keys, 'keyPress', { nativeEvent: { key: 'Backspace' } });
    expect(screen.getByTestId('cell-2-2')).toHaveAccessibleName(/empty$/);
    await fireEvent.changeText(keys, ' 1');
    expect(screen.getAllByRole('button', { name: /^Tile / })).toHaveLength(12);
    await fireEvent.changeText(keys, 'q'); // not in the bank: the square shakes, nothing moves
    expect(screen.getAllByRole('button', { name: /^Tile / })).toHaveLength(12);
  });

  it('THEN the clock waits for the first tile, then ticks each second', async () => {
    jest.useFakeTimers();
    try {
      await renderWithProviders(<DokuScreen file={file97} />);
      await play();
      await fireEvent.press(tileFor('T'));
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.getByText('0:00')).toBeOnTheScreen();
      await press('cell-0-2');
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByText('0:03')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('GIVEN a Doku already finished on this phone', () => {
  it('THEN it opens on its sheet with the original time and never announces again', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, done: { 'DP·LEXI·0097': { s: 87, d: '2026-10-18' } } }),
    );
    appStorage.setItem(
      STREAK_KEY,
      JSON.stringify({ last: '2026-10-18', streak: 2, best: 4, dates: [] }),
    );
    await renderWithProviders(<DokuScreen file={file97} />);
    expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('finish-hero')).toHaveTextContent('1:27');
    expect(screen.getByTestId('finish-share-text')).toHaveTextContent('🔢 Doku #97 — 1:27 · 🔥2');
    expect(screen.queryByText('All twelve tiles placed.')).toBeNull();
    expect(finishes).toEqual([]);
    await fireEvent.press(screen.getByText('← Puzzles'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
