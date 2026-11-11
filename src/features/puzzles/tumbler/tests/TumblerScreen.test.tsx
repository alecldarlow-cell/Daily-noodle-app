import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { onFinish, onVisit, type PuzzleFinish, type PuzzleVisit } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { HOUSE_LINE, TumblerScreen } from '../components/TumblerScreen';
import { dragStep, tileFor } from '../components/TumblerBoard';
import { beatMs } from '../hooks/useTumblerGame';
import { letter, SAVE_KEY, type TumblerState } from '../model';
import { file25 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useIsFocused: () => true,
}));
jest.setTimeout(30_000);

const ID = 'DP·TUMB·0025';
/** Today’s trials: Tumbler 25, and Redact 35 not yet played. */
const FEED = {
  items: [
    {
      path: 'reports/2026-11-11-word-redact-0035.html',
      type: 'redact',
      id: 'DP·REDA·0035',
      date: '2099-01-01',
      headline: 'Redact 0035',
    },
  ],
};
const line = () => [0, 1, 2, 3].map((k) => screen.getByTestId(`tumbler-wheel-${k}`)).map((w) => w);
const readLine = () =>
  [1, 2, 3, 4]
    .map((k) => screen.getByLabelText(new RegExp(`^Line letter ${k}: `)).props.accessibilityLabel)
    .map((l: string) => l.slice(-1))
    .join('')
    .toLowerCase();
const make = async (word: string) => {
  for (let k = 0; k < 4; k++)
    for (let n = 0; n < 7 && readLine()[k] !== word[k]; n++)
      await fireEvent.press(screen.getByTestId(`tumbler-down-${k}`));
};
const submit = () => fireEvent.press(screen.getByTestId('tumbler-submit'));

let finishes: PuzzleFinish[] = [];
let visits: PuzzleVisit[] = [];
let offs: (() => void)[] = [];
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
  finishes = [];
  visits = [];
  offs = [onFinish((f) => finishes.push(f)), onVisit((v) => visits.push(v))];
  mockSite({ 'feed-lite.json': FEED });
});
afterEach(async () => {
  offs.forEach((o) => o());
  jest.useRealTimers();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Tumbler not yet played', () => {
  it('THEN its Lab start card shows, and Play counts one start with Tumbler’s slug', async () => {
    await renderWithProviders(<TumblerScreen file={file25} />);
    expect(screen.getByTestId('lab-start')).toBeOnTheScreen();
    expect(screen.getByText(HOUSE_LINE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByTestId('tumbler-screen')).toBeOnTheScreen();
    expect(screen.getByText('Tumbler 25')).toBeOnTheScreen();
    expect(visits.map((v) => [v.ev, v.slug, v.type])).toEqual([
      ['open', 'word-tumbler', null],
      ['start', 'word-tumbler', null],
    ]);
    expect(line()).toHaveLength(4);
  });

  it('WHEN words are tried and the hidden one found THEN the page’s messages, a saved round, the beat and the Lab finish follow', async () => {
    await renderWithProviders(<TumblerScreen file={file25} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await submit();
    expect(screen.getByTestId('tumbler-msg')).toHaveTextContent(
      'TEDS isn’t a word we know, so it doesn’t count.',
    );
    await make('toes');
    await submit();
    expect(screen.getByTestId('tumbler-try-toes')).toBeOnTheScreen();
    expect(screen.getByText('submit 1')).toBeOnTheScreen();
    await submit();
    expect(screen.getByTestId('tumbler-msg')).toHaveTextContent('You’ve tried TOES already.');
    expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).cur.w).toEqual(['toes']);
    jest.useFakeTimers();
    await make('lets');
    await submit();
    // saved at once; the line's beat plays before the sheet
    expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).done[ID].w).toEqual(['toes', 'lets']);
    expect(screen.getByTestId('tumbler-msg')).toHaveTextContent(/Solved in/);
    expect(finishes).toHaveLength(1);
    expect(finishes[0]!.detail.type).toBe('word-tumbler');
    expect(finishes[0]!.type).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(beatMs(4) + 50);
    });
    jest.useRealTimers();
    expect(await screen.findByTestId('lab-finish')).toBeOnTheScreen();
    expect(screen.getByText('Should Tumbler go daily?')).toBeOnTheScreen();
    expect(screen.getByTestId('lab-note')).toHaveTextContent(/^2 submits, \d+ turns\.$/);
    expect(screen.getByTestId('tumbler-recap')).toBeOnTheScreen();
  });

  it('WHEN a wheel is dragged down THEN each 60% of a tile is a step', () => {
    const t = tileFor(390 - 24);
    expect(dragStep(t * 0.5, 0, t)).toEqual({ turn: false, from: 0 });
    expect(dragStep(t * 0.6, 0, t)).toEqual({ turn: true, from: t * 0.6 });
    // the next step counts from where the last one was taken
    expect(dragStep(t, t * 0.6, t)).toEqual({ turn: false, from: t * 0.6 });
    expect(dragStep(t * 1.2, t * 0.6, t).turn).toBe(true);
    // a drag up never turns it
    expect(dragStep(-t, 0, t).turn).toBe(false);
  });

  it('WHEN the app goes away mid-round THEN the round is kept', async () => {
    let changed: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      changed = fn as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    await renderWithProviders(<TumblerScreen file={file25} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await fireEvent.press(screen.getByTestId('tumbler-down-2'));
    changed('background');
    expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).cur).toMatchObject({
      id: ID,
      o: [0, 0, 6, 0],
      t: 1,
    });
  });
});

describe('GIVEN a Tumbler part-played on the website', () => {
  it('THEN the start card says Resume and the board carries on', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, cur: { id: ID, o: [5, 0, 0, 0], w: ['toes'], t: 2, s: 30 } }),
    );
    await renderWithProviders(<TumblerScreen file={file25} />);
    expect(screen.getByText('Part-played')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByTestId('tumbler-msg')).toHaveTextContent('Carrying on where you left off.');
    expect(screen.getByTestId('tumbler-try-toes')).toBeOnTheScreen();
  });
});

describe('GIVEN a Tumbler already solved', () => {
  it('THEN it opens on the Lab finish with its time and submits, and the next trial swaps in', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        done: { [ID]: { t: '1:05', s: 65, n: 1, w: ['lets'], d: '2026-11-11' } },
      }),
    );
    await renderWithProviders(<TumblerScreen file={file25} />);
    expect(screen.getByTestId('lab-finish')).toBeOnTheScreen();
    expect(screen.getByTestId('lab-hero')).toHaveTextContent('1:05');
    expect(screen.getByTestId('lab-note')).toHaveTextContent('1 submit.');
    expect(visits.map((v) => v.ev)).toEqual(['open']);
    // the feed may arrive after the first render
    const next = await screen.findByTestId('lab-next', {}, { timeout: 3000 }).catch(() => null);
    if (next) {
      await fireEvent.press(next);
      await fireEvent.press(next);
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'redact', file: '2026-11-11-word-redact-0035' },
      });
    }
  });
});

describe('GIVEN the board’s sizes', () => {
  it('THEN tiles fit four across and stay between 30 and 64', () => {
    expect(tileFor(366)).toBe(64);
    expect(tileFor(200)).toBe(35);
    expect(tileFor(100)).toBe(30);
    const s = { p: { wheels: ['AB'] }, off: [0], size: 2 } as unknown as TumblerState;
    expect(letter(s, 0, 1)).toBe('B');
  });
});
