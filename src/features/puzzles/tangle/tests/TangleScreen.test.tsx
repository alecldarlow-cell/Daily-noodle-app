import { londonDay } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { tileRects } from '../components/TangleBoard';
import { TangleScreen } from '../components/TangleScreen';
import { KEY } from '../model';
import { findPath } from '../oracle';
import { file19, tangle19 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;
// Each test plays a round through the screen, many steps of the fake clock; a busy
// machine can take longer than Jest's 5 s default.
jest.setTimeout(30_000);

const SIDE = 400;
const rects = tileRects(SIDE);
const at = (i: number) => ({
  nativeEvent: {
    locationX: rects[i]!.left + rects[i]!.width / 2,
    locationY: rects[i]!.top + rects[i]!.height / 2,
  },
});

/** Let `ms` pass on the fake clock in short steps (the board ticks every 100 ms). */
async function run(ms: number) {
  for (let t = 0; t < ms; t += 500)
    await act(async () => {
      jest.advanceTimersByTime(Math.min(500, ms - t));
    });
}
async function layOut() {
  await fireEvent(screen.getByTestId('tangle-board-wrap'), 'layout', {
    nativeEvent: { layout: { width: SIDE, height: SIDE, x: 0, y: 0 } },
  });
}
async function trace(w: string) {
  const p = findPath(tangle19, w)!;
  const grid = screen.getByTestId('tangle-grid');
  await fireEvent(grid, 'responderGrant', at(p[0]!));
  for (const i of p.slice(1)) await fireEvent(grid, 'responderMove', at(i));
  await fireEvent(grid, 'responderRelease', at(p.at(-1)!));
}

let finishes: PuzzleFinish[] = [];
let off = () => {};
let appState: ((s: AppStateStatus) => void)[] = [];
const setAppState = (s: AppStateStatus) => appState.forEach((fn) => fn(s));
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
  jest.useFakeTimers();
  finishes = [];
  appState = [];
  off = onFinish((f) => finishes.push(f));
  mockSite({});
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
    appState.push(fn as (s: AppStateStatus) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(async () => {
  off();
  await run(500);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('GIVEN a Tangle not yet played', () => {
  it('THEN its home card offers the round, and the round plays to its result', async () => {
    await renderWithProviders(<TangleScreen file={file19} />);
    expect(screen.getByText('Today’s Tangle')).toBeOnTheScreen();
    expect(screen.getByText('No. 19, Sunday, 25 October')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('play-card'));
    await layOut();
    expect(screen.getByTestId('tangle-count')).toHaveTextContent('3');
    await run(3100);
    expect(screen.getByTestId('tangle-current')).toHaveTextContent(
      'Drag across letters, or tap them',
    );
    await trace('ago');
    expect(screen.getByTestId('tangle-toast')).toHaveTextContent('+1 AGO');
    await trace('original');
    expect(screen.getByTestId('tangle-score')).toHaveTextContent('13');
    expect(screen.getByText('★ ORIGINAL +12')).toBeOnTheScreen();
    await run(91_000);
    const doc = JSON.parse(appStorage.getItem(KEY)!);
    expect(doc.done['DP·TANG·0019']).toEqual({
      o: 'played',
      s: 13,
      w: 2,
      st: true,
      d: londonDay(),
    });
    expect(finishes).toEqual([
      {
        path: 'reports/2026-10-25-word-tangle-0019.html',
        type: 'tangle',
        detail: expect.objectContaining({
          type: 'word-tangle',
          outcome: 'scored',
          score: 13,
          words: 2,
        }),
      },
    ]);
    expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
    expect(screen.getByText('Time’s up')).toBeOnTheScreen();
    expect(screen.getByTestId('finish-share-text')).toHaveTextContent(
      '🧶 Tangle #19 — 13 points, 2 words ★',
    );
    expect(
      screen.getByText('2 words, including the longest, ORIGINAL, for 12 points.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('tangle-recap')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByText(/^Show \d+ more$/)[0]!);
    await fireEvent.press(screen.getByText(/^Rarer words: /));
  });

  it('THEN going back mid-round pauses it, and the app leaving pauses it behind Resume', async () => {
    await renderWithProviders(<TangleScreen file={file19} />);
    await fireEvent.press(screen.getByTestId('play-card'));
    await layOut();
    await run(3100);
    await trace('air');
    await fireEvent.press(screen.getByRole('button', { name: 'Pause and go back' }));
    expect(screen.getByText('Round paused')).toBeOnTheScreen();
    expect(screen.getByText(/^1:[23]\d left, 1 point so far\.$/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('play-card'));
    await layOut();
    await run(3100);
    await act(async () => setAppState('background'));
    await act(async () => setAppState('active'));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByTestId('tangle-count')).toHaveTextContent('3');
    expect(JSON.parse(appStorage.getItem(KEY)!).days['DP·TANG·0019']).toMatchObject({
      state: 'playing',
      found: ['air'],
    });
  });
});

describe('GIVEN a Tangle already played today', () => {
  it('THEN it opens on its result, says Your score, and never announces again', async () => {
    appStorage.setItem(
      KEY,
      JSON.stringify({
        v: 1,
        days: { 'DP·TANG·0019': { state: 'done', found: ['ago', 'air'], left: 0, score: 2 } },
        done: { 'DP·TANG·0019': { o: 'played', s: 2, w: 2, st: false, d: '2026-10-25' } },
        streak: { last: '2026-10-25', n: 1, best: 1 },
        best: 2,
        snd: true,
        rm: null,
        fs: true,
      }),
    );
    await renderWithProviders(<TangleScreen file={file19} />);
    expect(screen.getByText('Your score')).toBeOnTheScreen();
    expect(screen.getByTestId('finish-share-text')).toHaveTextContent(
      '🧶 Tangle #19 — 2 points, 2 words',
    );
    expect(finishes).toEqual([]);
    await fireEvent.press(screen.getByText('← Puzzles'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
