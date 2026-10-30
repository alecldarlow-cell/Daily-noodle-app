import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders, sharedLine } from '@/shared/testing';

import { PathScreen } from '../components/PathScreen';
import { SAVE_KEY, START_MSG, STREAK_KEY } from '../model';
import { file92, path92 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;
jest.setTimeout(30_000);

const at: [number, number][] = [];
path92.solution.forEach((row, r) => row.forEach((v, c) => (at[v] = [r, c])));
const tapValue = (v: number) => fireEvent.press(screen.getByTestId(`sq-${at[v]![0]}-${at[v]![1]}`));
const msg = () => screen.getByTestId('path-msg');

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

describe('GIVEN a Path not yet played', () => {
  it('THEN the start card says what the page says, and Play shows the board', async () => {
    await renderWithProviders(<PathScreen file={file92} />);
    expect(screen.getByText('No. 92, Sunday 18 October')).toBeOnTheScreen();
    expect(
      screen.getByText('Join 1 to 36 in one unbroken path, through every given number.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByTestId('path-board')).toBeOnTheScreen();
    expect(screen.getByText('Path 92')).toBeOnTheScreen();
    expect(msg()).toHaveTextContent(START_MSG);
    expect(screen.getByTestId('sq-5-4')).toHaveAccessibleName(/1, given, active end/);
  });

  it('THEN the clock starts on Play, before any tap', async () => {
    jest.useFakeTimers();
    await renderWithProviders(<PathScreen file={file92} />);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByText('0:00')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('0:03')).toBeOnTheScreen();
  });

  it('THEN taps grow either end, Undo takes back, Hint places a forced square', async () => {
    await renderWithProviders(<PathScreen file={file92} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await tapValue(36);
    expect(msg()).toHaveTextContent('Counting down from 36 — tap an adjacent square to place 35.');
    await tapValue(35);
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(msg()).toHaveTextContent('Undone.');
    await fireEvent.press(screen.getByTestId('sq-0-0'));
    expect(msg()).toHaveTextContent(
      'Not next to the active end — the path grows one square at a time.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByTestId('sq-2-5')).toHaveAccessibleName(/35/);
  });

  it('THEN the complete thread is saved, the streak bumped, the finish announced, and the sheet shows', async () => {
    await renderWithProviders(<PathScreen file={file92} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    for (let v = 1; v <= 35; v++) await tapValue(v);
    const day = londonDay();
    expect(JSON.parse(appStorage.getItem(SAVE_KEY)!)).toEqual({
      v: 1,
      done: { 'DP·PATH·0092': { t: expect.stringMatching(/^0:0\d$/), d: day } },
    });
    expect(JSON.parse(appStorage.getItem(STREAK_KEY)!)).toMatchObject({ last: day, streak: 1 });
    expect(finishes).toEqual([
      {
        path: 'reports/2026-10-18-logic-path-0092.html',
        type: 'path',
        detail: expect.objectContaining({ type: 'logic-path', outcome: 'solved', hints: 0 }),
      },
    ]);
    await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen(), {
      timeout: 3000,
    });
    expect(screen.getByTestId('finish-title')).toHaveTextContent(/ · Path complete$/);
    expect(screen.getByText('One to 36 without a hint.')).toBeOnTheScreen();
    expect(await sharedLine()).toMatch(/^〰️ Path #92 — 0:0\d$/);
    expect(screen.getByTestId('path-recap')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('finish-next'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('GIVEN a Path already finished on this phone', () => {
  it('THEN it opens on its sheet with its time and live streak, and never announces again', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, done: { 'DP·PATH·0092': { t: '1:27', d: '2026-10-18' } } }),
    );
    appStorage.setItem(
      STREAK_KEY,
      JSON.stringify({ last: londonDay(), streak: 3, best: 4, dates: [londonDay()], tz: 'L' }),
    );
    await renderWithProviders(<PathScreen file={file92} />);
    expect(screen.getByTestId('finish-hero')).toHaveTextContent('1:27');
    expect(await sharedLine()).toBe('〰️ Path #92 — 1:27 · 🔥3');
    expect(finishes).toEqual([]);
  });
});
