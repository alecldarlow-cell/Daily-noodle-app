import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders, sharedLine } from '@/shared/testing';

import { TallyScreen } from '../components/TallyScreen';
import { SAVE_KEY, STREAK_KEY } from '../model';
import { file1, tally1 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const ID = 'DP·TALLY·0001';
const play = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));
const put = async (i: number, d: number) => {
  await fireEvent.press(screen.getByTestId(`tally-cell-${i}`));
  await fireEvent.press(screen.getByTestId(`tally-key-${d}`));
};
const save = () => JSON.parse(appStorage.getItem(SAVE_KEY) || 'null') as Record<string, unknown>;

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

describe('GIVEN a Tally not yet played', () => {
  it('THEN the start card says what the page says, and Play shows the board', async () => {
    await renderWithProviders(<TallyScreen file={file1} />);
    // the open page says the house line; the rule sentence leads How to play (Alec, 8 Nov 2026)
    expect(
      screen.getByText('Sudoku with a maths twist. Can you make every cage hit its number?'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText(
        'Fill the grid with 1 to 4, no repeats in a row or column, so every cage makes its number.',
      ),
    ).toBeNull();
    await fireEvent.press(screen.getByText('How to play'));
    expect(
      screen.getByText(
        'Fill the grid with 1 to 4, no repeats in a row or column, so every cage makes its number.',
      ),
    ).toBeOnTheScreen();
    await play();
    expect(screen.getByTestId('tally-board')).toBeOnTheScreen();
    expect(screen.getByText('Tally 1')).toBeOnTheScreen();
    expect(screen.getByTestId('tally-msg')).toHaveTextContent('Tap a square, then a number.');
    expect(screen.getByTestId('tally-cell-1')).toHaveAccessibleName(
      'Row 1, column 2, empty, cage 12×',
    );
  });

  it('THEN the clock starts on Play', async () => {
    jest.useFakeTimers();
    await renderWithProviders(<TallyScreen file={file1} />);
    await play();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('0:03')).toBeOnTheScreen();
  });

  it('THEN numbers, Notes, Erase and Undo work and the round is kept', async () => {
    await renderWithProviders(<TallyScreen file={file1} />);
    await play();
    await fireEvent.press(screen.getByTestId('tally-key-1'));
    expect(screen.getByTestId('tally-msg')).toHaveTextContent('Tap a square first.');
    await put(0, 2);
    expect(screen.getByTestId('tally-cell-0')).toHaveAccessibleName(/, 2, /);
    expect(save().cur).toMatchObject({ id: ID, g: expect.arrayContaining([2]) });
    await fireEvent.press(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByTestId('tally-msg')).toHaveTextContent('Notes on: numbers go in small.');
    await put(5, 3);
    expect(screen.getByTestId('tally-notes-5')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Erase' }));
    expect(screen.queryByTestId('tally-notes-5')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('tally-notes-5')).toBeOnTheScreen();
  });

  it('THEN the last number saves, bumps the streak, announces and shows the sheet', async () => {
    await renderWithProviders(<TallyScreen file={file1} />);
    await play();
    for (let i = 0; i < 16; i++) await put(i, +tally1.sol[i]!);
    await waitFor(() => expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen());
    expect(save().cur).toBeUndefined();
    expect(save().done).toMatchObject({ [ID]: { t: expect.stringMatching(/^0:0\d$/) } });
    expect(JSON.parse(appStorage.getItem(STREAK_KEY)!)).toMatchObject({ streak: 1 });
    expect(finishes).toEqual([
      {
        path: file1.path,
        type: 'tally',
        detail: expect.objectContaining({ type: 'logic-tally', outcome: 'solved' }),
      },
    ]);
    expect(screen.getByTestId('finish-title')).toHaveTextContent('Solved');
    expect(await sharedLine()).toMatch(/^🧮 Tally #1 — 0:0\d$/);
    expect(screen.getByTestId('tally-recap')).toBeOnTheScreen();
  });
});

describe('GIVEN a round kept part-way', () => {
  it('WHEN opened THEN the start card waits, nothing is rewritten, and Play brings the board back at its time', async () => {
    const g = new Array(16).fill(0);
    g[0] = 2;
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, cur: { id: ID, g, notes: new Array(16).fill(0), s: 42, at: 1 } }),
    );
    const before = appStorage.getItem(SAVE_KEY);
    await renderWithProviders(<TallyScreen file={file1} />);
    expect(screen.getByTestId('start-card')).toBeOnTheScreen();
    expect(appStorage.getItem(SAVE_KEY)).toBe(before);
    expect(screen.getByText('boards played')).toBeOnTheScreen();
    await play();
    expect(screen.getByTestId('tally-board')).toBeOnTheScreen();
    expect(screen.getByText('0:42')).toBeOnTheScreen();
    expect(screen.getByTestId('tally-msg')).toHaveTextContent('Carrying on where you left off.');
  });
});

describe('GIVEN a Tally already finished on this phone', () => {
  it('THEN it opens on its sheet and never announces again', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, done: { [ID]: { t: '1:27', s: 87, d: '2026-10-25' } } }),
    );
    await renderWithProviders(<TallyScreen file={file1} />);
    expect(screen.getByTestId('finish-hero')).toHaveTextContent('1:27');
    expect(finishes).toEqual([]);
  });
});

// Last: it hands `background` to every listener the app has, which later renders would feel.
describe('GIVEN a round in play', () => {
  it('WHEN the app goes away or the screen is left THEN the time is written', async () => {
    const add = jest.spyOn(AppState, 'addEventListener');
    const view = await renderWithProviders(<TallyScreen file={file1} />);
    await play();
    await put(0, 2);
    const handlers = add.mock.calls.map((c) => c[1]);
    await act(async () => handlers.forEach((h) => h('background')));
    expect(save().cur).toMatchObject({ id: ID });
    await act(async () => handlers.forEach((h) => h('active')));
    await view.unmount();
    expect(save().cur).toMatchObject({ id: ID });
    add.mockRestore();
  });
});
