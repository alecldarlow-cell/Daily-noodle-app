import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { SweepScreen } from '../components/SweepScreen';
import { SAVE_KEY, START_MSG, STREAK_KEY } from '../model';
import { file94 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;
jest.setTimeout(30_000);

const START = 22;
const MINES = [2, 4, 13, 19, 26, 33, 35];
const sq = (i: number) => screen.getByTestId(`sq-${i}`);
const tap = (i: number) => fireEvent.press(sq(i));
const playBtn = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));

let finishes: PuzzleFinish[] = [];
let off = () => {};
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
  finishes = [];
  off = onFinish((f) => finishes.push(f));
  mockSite({});
});
afterEach(async () => {
  off();
  jest.useRealTimers();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Sweep not yet played', () => {
  describe('WHEN it opens', () => {
    it('THEN the start card says what the page says, and Play shows the locked board', async () => {
      await renderWithProviders(<SweepScreen file={file94} />);
      expect(screen.getByText('No. 94, Sunday 18 October')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Clear the board without hitting one of the seven mines. Start on the highlighted square.',
        ),
      ).toBeOnTheScreen();
      await playBtn();
      expect(screen.getByTestId('sweep-board')).toBeOnTheScreen();
      expect(screen.getByText('Sweep 94')).toBeOnTheScreen();
      expect(screen.getByText('0:00')).toBeOnTheScreen();
      expect(screen.getByTestId('sweep-msg')).toHaveTextContent(START_MSG);
      expect(sq(0)).toHaveAccessibleName('row 1, column 1, locked');
      expect(sq(START)).toHaveAccessibleName(/the safe start/);
    });
  });

  describe('WHEN the start is dug, a mine flagged by long press and Hint pressed', () => {
    it('THEN the opening shows, the counter drops and Hint says why', async () => {
      await renderWithProviders(<SweepScreen file={file94} />);
      await playBtn();
      await tap(0); // locked
      expect(screen.getByTestId('sweep-msg')).toHaveTextContent(START_MSG);
      await tap(START);
      expect(screen.getByTestId('sweep-msg')).toHaveTextContent('');
      await fireEvent(sq(4), 'longPress');
      expect(screen.getByTestId('sweep-left')).toHaveTextContent('6');
      await fireEvent.press(screen.getByRole('button', { name: '⚑ Flag' }));
      await tap(4); // off again in Flag mode
      expect(screen.getByTestId('sweep-left')).toHaveTextContent('7');
      await fireEvent.press(screen.getByRole('button', { name: '⛏ Dig' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Hint' }));
      expect(screen.getByTestId('sweep-msg')).toHaveTextContent(
        'This 1 has only one hidden square next to it, so that square is a mine.',
      );
    });
  });

  describe('WHEN a mine is dug', () => {
    it('THEN the loss is saved, the sheet says Boom., and Play again records nothing', async () => {
      appStorage.setItem(
        STREAK_KEY,
        JSON.stringify({ last: '2020-01-01', streak: 3, best: 5, dates: ['2020-01-01'], tz: 'L' }),
      );
      await renderWithProviders(<SweepScreen file={file94} />);
      await playBtn();
      await tap(START);
      await tap(2);
      await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen());
      expect(screen.getByText('Boom.')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-share-text')).toHaveTextContent('💥 Sweep 18 Oct — boom');
      expect(screen.getByTestId('sweep-recap')).toBeOnTheScreen();
      expect(JSON.parse(appStorage.getItem(STREAK_KEY)!)).toMatchObject({ streak: 0, best: 5 });
      const day = londonDay();
      expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).done['DP·SWEEP·2026-10-18']).toEqual({
        o: 'loss',
        s: expect.any(Number),
        b: 2,
        d: day,
      });
      expect(finishes).toHaveLength(1);
      expect(finishes[0]!.detail).toMatchObject({ type: 'logic-sweep', outcome: 'failed' });

      await fireEvent.press(screen.getByText('Play again (not recorded)'));
      expect(screen.getByTestId('sweep-board')).toBeOnTheScreen();
      expect(screen.getByText('medium · replay')).toBeOnTheScreen();
      await tap(START);
      await tap(2);
      await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen());
      expect(finishes).toHaveLength(1);
      expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).done['DP·SWEEP·2026-10-18'].b).toBe(2);
    });
  });

  describe('WHEN every safe square is dug', () => {
    it('THEN it is saved as a win, the streak starts, and the sheet rises after the board', async () => {
      await renderWithProviders(<SweepScreen file={file94} />);
      await playBtn();
      await tap(START);
      for (let i = 0; i < 36; i++)
        if (!MINES.includes(i) && /hidden$/.test(String(sq(i).props.accessibilityLabel)))
          await tap(i);
      expect(screen.getByTestId('sweep-msg')).toHaveTextContent(/^Swept in 00:0\d\. Nice\.$/);
      await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen(), {
        timeout: 3000,
      });
      expect(screen.getByText('Swept')).toBeOnTheScreen();
      expect(screen.getByText('All seven mines found, no hints.')).toBeOnTheScreen();
      expect(JSON.parse(appStorage.getItem(STREAK_KEY)!)).toMatchObject({ streak: 1 });
      expect(finishes).toHaveLength(1);
      expect(screen.queryByText('Play again (not recorded)')).toBeNull();
      await fireEvent.press(screen.getByTestId('finish-next'));
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  describe('WHEN the clock runs', () => {
    it('THEN it waits for the start square, then ticks each second', async () => {
      jest.useFakeTimers();
      await renderWithProviders(<SweepScreen file={file94} />);
      await playBtn();
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
      expect(screen.getByText('0:00')).toBeOnTheScreen();
      await tap(START);
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByText('0:03')).toBeOnTheScreen();
    });
  });
});

describe('GIVEN a Sweep already finished on this phone', () => {
  const seed = (rec: Record<string, unknown>) =>
    appStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, done: { 'DP·SWEEP·2026-10-18': rec } }));

  it('THEN a win opens on its sheet with its time and never announces again', async () => {
    seed({ o: 'win', s: 87, d: '2026-10-18' });
    appStorage.setItem(
      STREAK_KEY,
      JSON.stringify({ last: '2026-10-18', streak: 2, best: 4, dates: [] }),
    );
    await renderWithProviders(<SweepScreen file={file94} />);
    expect(screen.getByTestId('finish-hero')).toHaveTextContent('1:27');
    expect(screen.getByTestId('finish-share-text')).toHaveTextContent(
      '💣 Sweep 18 Oct — swept in 1:27 · 🔥2',
    );
    expect(screen.getByText('All seven mines found.')).toBeOnTheScreen();
    expect(finishes).toEqual([]);
  });

  it('THEN a given-up board shows as the page leaves it, with no sheet', async () => {
    seed({ o: 'gave', s: 3, d: '2026-10-18' });
    await renderWithProviders(<SweepScreen file={file94} />);
    expect(screen.getByTestId('sweep-msg')).toHaveTextContent('Revealed.');
    expect(screen.queryByTestId('start-card')).toBeNull();
  });
});
