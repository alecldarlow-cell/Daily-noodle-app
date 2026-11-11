import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { onFinish, onVisit, type PuzzleFinish, type PuzzleVisit } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { RedactScreen } from '../components/RedactScreen';
import { redactFeel, sheetDelay, waveStep } from '../hooks/useRedactGame';
import { apply, init, SAVE_KEY, STREAK_KEY } from '../model';
import { file5, redact5 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn() },
  useIsFocused: () => true,
}));
jest.setTimeout(30_000);

const ID = 'DP·REDA·0005';
const play = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));
const tap = (i: number) => fireEvent.press(screen.getByTestId(`redact-cell-${i}`));
const save = () => JSON.parse(appStorage.getItem(SAVE_KEY) || 'null') as Record<string, unknown>;
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

let finishes: PuzzleFinish[] = [];
let visits: PuzzleVisit[] = [];
let offs: (() => void)[] = [];
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
  finishes = [];
  visits = [];
  offs = [onFinish((f) => finishes.push(f)), onVisit((v) => visits.push(v))];
  mockSite({});
});
afterEach(async () => {
  offs.forEach((o) => o());
  await wait(30);
});

describe('GIVEN a Redact not yet played', () => {
  it('THEN its Lab start card shows the house line, and Play shows the letters with the tracker’s slug', async () => {
    await renderWithProviders(<RedactScreen file={file5} />);
    expect(screen.getByTestId('lab-start')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "There's a crossword hiding in here. Black out the letters that don't belong to find it.",
      ),
    ).toBeOnTheScreen();
    await play();
    expect(screen.getByTestId('redact-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('redact-count')).toHaveTextContent('0 of 10 blacked out');
    expect(visits.map((v) => [v.ev, v.type, v.slug])).toEqual([
      ['open', null, 'word-redact'],
      ['start', null, 'word-redact'],
    ]);
  });

  it('WHEN a wrong full count, Undo and Clear are used THEN the board, count and message follow the page', async () => {
    await renderWithProviders(<RedactScreen file={file5} />);
    await play();
    for (const i of redact5.black.slice(0, -1)) await tap(i);
    await tap(3);
    expect(screen.getByTestId('redact-count')).toHaveTextContent(/^10 of 10 /);
    expect(screen.getByTestId('redact-msg')).not.toHaveTextContent('');
    await fireEvent.press(screen.getByTestId('redact-undo'));
    expect(screen.getByTestId('redact-count')).toHaveTextContent(/^9 of 10 /);
    await fireEvent.press(screen.getByTestId('redact-clear'));
    expect(screen.getByTestId('redact-count')).toHaveTextContent(/^0 of 10 /);
    // the board is kept as the page keeps it
    expect((save().cur as { id: string }).id).toBe(ID);
  });

  it('WHEN the answer is blacked out THEN it saves at once, tracks (never a league), and the Lab finish follows', async () => {
    await renderWithProviders(<RedactScreen file={file5} />);
    await play();
    for (const i of redact5.black) await tap(i);
    expect((save().done as Record<string, { m: number }>)[ID]!.m).toBe(0);
    expect(JSON.parse(appStorage.getItem(STREAK_KEY)!).streak).toBe(1);
    expect(finishes).toHaveLength(1);
    expect(finishes[0]).toMatchObject({ path: file5.path, type: null });
    expect(finishes[0]!.detail.type).toBe('word-redact');
    expect(screen.getByTestId('redact-msg')).toHaveTextContent(/^Solved in \d+:\d\d\.$/);
    await wait(sheetDelay(6, false) + 200);
    expect(screen.getByTestId('lab-finish')).toBeOnTheScreen();
    expect(screen.getByText('Should Redact go daily?')).toBeOnTheScreen();
    expect(screen.getByTestId('lab-note')).toHaveTextContent('Right first time at the full count.');
    expect(screen.getByTestId('redact-recap-words')).toHaveTextContent(/^SPA · RACIAL · /);
  });
});

describe('GIVEN a part-played board kept from the website', () => {
  it('THEN the start card says so, Resume carries on, and the app going away keeps it', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, cur: { id: ID, b: [0, 1], t: 3, m: 1, s: 30 } }),
    );
    let changed: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      changed = fn as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    await renderWithProviders(<RedactScreen file={file5} />);
    expect(screen.getByText('2 of 10 blacked out.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByTestId('redact-msg')).toHaveTextContent('Carrying on where you left off.');
    await tap(2);
    changed('background');
    expect((save().cur as { b: number[] }).b).toEqual([0, 1, 2]);
    // a resumed board is no new start
    expect(visits.filter((v) => v.ev === 'start')).toHaveLength(0);
  });
});

describe('GIVEN a Redact already finished', () => {
  it('THEN it opens on the Lab finish with its saved time, and Back leaves', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, done: { [ID]: { t: '2:05', s: 125, m: 1, d: '2026-11-01' } } }),
    );
    await renderWithProviders(<RedactScreen file={file5} />);
    expect(screen.getByTestId('lab-hero')).toHaveTextContent('2:05');
    expect(screen.getByTestId('lab-note')).toHaveTextContent('1 wrong try at the full count.');
    await fireEvent.press(screen.getByRole('link', { name: 'Back to Puzzles' }));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('GIVEN the win beat and the feel', () => {
  it('THEN the beat is the engine’s and reduced motion skips it', () => {
    expect(waveStep(7)).toBe(70);
    expect(waveStep(4)).toBe(90);
    expect(sheetDelay(7, false)).toBe(70 * 12 + 600 + 250);
    expect(sheetDelay(7, true)).toBe(0);
  });
  it('THEN a solve, a wrong full count and a tap each buzz', () => {
    const s = init(redact5);
    const tapped = apply(s, { t: 'cell', i: 0 });
    expect(redactFeel(s, tapped)).toBe('tap');
    expect(redactFeel(s, { ...tapped, shake: 1 })).toBe('error');
    expect(redactFeel(s, { ...tapped, solved: true })).toBe('success');
    expect(redactFeel(s, s)).toBeNull();
  });
});
