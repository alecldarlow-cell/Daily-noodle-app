import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { onFinish, onVisit, type PuzzleFinish, type PuzzleVisit } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { TILT_HOW, TILT_LINE, TiltScreen } from '../components/TiltScreen';
import { apply, init, SAVE_KEY, STILL_MSG } from '../model';
import { route } from '../oracle';
import { file5, tilt5 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) },
  useIsFocused: () => true,
}));
jest.setTimeout(30_000);

const ID = 'DP·TILT·0005';
const play = () => fireEvent.press(screen.getByRole('button', { name: 'Play' }));
const turn = (dir: 1 | -1) =>
  fireEvent.press(screen.getByTestId(dir > 0 ? 'tilt-right' : 'tilt-left'));
const save = () => JSON.parse(appStorage.getItem(SAVE_KEY) || 'null') as Record<string, unknown>;

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
  jest.useRealTimers();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Tilt not yet played', () => {
  it('THEN the Lab start card says the page’s line, and Play shows the maze', async () => {
    await renderWithProviders(<TiltScreen file={file5} />);
    expect(screen.getByTestId('lab-start')).toBeOnTheScreen();
    expect(screen.getByText(TILT_LINE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('How to play'));
    expect(screen.getByText(TILT_HOW[0]!)).toBeOnTheScreen();
    await play();
    expect(screen.getByTestId('tilt-board')).toBeOnTheScreen();
    expect(screen.getByText('Tilt 5')).toBeOnTheScreen();
    expect(screen.getByTestId('tilt-undo').props.accessibilityState.disabled).toBe(true);
    expect(visits).toEqual([
      { ev: 'open', path: file5.path, type: null, slug: 'logic-tilt' },
      { ev: 'start', path: file5.path, type: null, slug: 'logic-tilt' },
    ]);
  });

  it('WHEN turned and taken back THEN turns count, the maze is kept, and Undo restores it', async () => {
    await renderWithProviders(<TiltScreen file={file5} />);
    await play();
    await turn(1);
    expect(screen.getByTestId('tilt-turns')).toHaveTextContent('1');
    expect((save().cur as { n: number }).n).toBe(1);
    await fireEvent.press(screen.getByTestId('tilt-undo'));
    expect(screen.getByTestId('tilt-turns')).toHaveTextContent('0');
    expect(save().cur).toBeUndefined();
  });

  it('WHEN a turn moves nothing THEN it says so', async () => {
    // find a reachable state where one turn moves nothing, then press the moves to get there
    let s = init(tilt5);
    const dirs: (1 | -1)[] = [];
    let still: 1 | -1 | null = null;
    for (let i = 0; i < 30 && still === null; i++) {
      for (const d of [1, -1] as const) {
        const n = apply(s, { t: 'turn', dir: d });
        if (!n.solved && !n.last!.path.length) still = d;
      }
      if (still === null) {
        const d = route(s)[0]!;
        dirs.push(d);
        s = apply(s, { t: 'turn', dir: d });
      }
    }
    await renderWithProviders(<TiltScreen file={file5} />);
    await play();
    for (const d of dirs) await turn(d);
    await turn(still!);
    expect(screen.getByTestId('tilt-msg')).toHaveTextContent(STILL_MSG);
  });

  it('WHEN the ball goes out THEN the result is saved, tracked (not a league result), and the Lab sheet asks the question', async () => {
    await renderWithProviders(<TiltScreen file={file5} />);
    await play();
    for (const d of route(init(tilt5))) await turn(d);
    // the sheet waits for the last turn, roll and exit to play out (under 2 s)
    expect(await screen.findByTestId('lab-finish', {}, { timeout: 4000 })).toBeOnTheScreen();
    expect(screen.getByTestId('lab-title')).toHaveTextContent('Out');
    expect(screen.getByText('Should Tilt go daily?')).toBeOnTheScreen();
    expect(screen.getByTestId('lab-note')).toHaveTextContent(
      '12 turns, against a shortest way out of 12.',
    );
    expect(screen.getByTestId('tilt-recap')).toBeOnTheScreen();
    const rec = (save().done as Record<string, { n: number; s: number }>)[ID]!;
    expect(rec.n).toBe(12);
    expect(rec.s).toBeGreaterThanOrEqual(0);
    expect(finishes).toHaveLength(1);
    expect(finishes[0]).toMatchObject({ path: file5.path, type: null });
    expect(finishes[0]!.detail).toMatchObject({ type: 'logic-tilt', tv: 3, outcome: 'solved' });
    await fireEvent.press(screen.getByTestId('lab-vote-yes'));
    expect(JSON.parse(appStorage.getItem('noodle-lab-votes-v1')!).tilt.v).toBe('yes');
  });
});

describe('GIVEN a Tilt already finished', () => {
  it('THEN it reopens on the sheet with its time and turns, and announces nothing', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, done: { [ID]: { t: '0:41', s: 41, n: 14, d: '2026-11-01' } } }),
    );
    await renderWithProviders(<TiltScreen file={file5} />);
    expect(screen.getByTestId('lab-hero')).toHaveTextContent('0:41');
    expect(screen.getByTestId('lab-note')).toHaveTextContent(/14 turns/);
    expect(finishes).toHaveLength(0);
    await fireEvent.press(screen.getByText('← Puzzles'));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('GIVEN a maze part-turned on the website', () => {
  it('THEN it opens where it was left, and is kept when the app goes away', async () => {
    const s = apply(apply(init(tilt5), { t: 'turn', dir: 1 }), { t: 'turn', dir: -1 });
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        cur: { id: ID, pos: s.pos, g: s.g, rot: s.rot, n: 2, trail: s.trail, s: 30, at: 1 },
      }),
    );
    const listeners: ((st: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
      listeners.push(fn as (st: string) => void);
      return { remove: jest.fn() } as never;
    });
    await renderWithProviders(<TiltScreen file={file5} />);
    await play();
    expect(screen.getByTestId('tilt-turns')).toHaveTextContent('2');
    expect(screen.getByTestId('tilt-msg')).toHaveTextContent('Carrying on where you left off.');
    await turn(1);
    await act(async () => listeners.forEach((fn) => fn('background')));
    expect((save().cur as { n: number }).n).toBe(3);
    spy.mockRestore();
  });
});
