import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { onFinish, onVisit, type PuzzleFinish, type PuzzleVisit } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import type { PuzzleFile } from '../../types';
import { CrypticScreen, HOUSE_LINE } from '../components/CrypticScreen';
import { beatMs } from '../hooks/useCrypticGame';
import { SAVE_KEY, spanChars, type CrypticData } from '../model';
import answers from './answers.json';
import pages from './pages.json';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useIsFocused: () => true,
}));
jest.setTimeout(30_000);

const page = (pages as unknown as { path: string; date: string; data: CrypticData }[])[0]!;
const ID = page.data.id;
const A = (answers as Record<string, string>)[ID]!;
const file = {
  id: ID,
  type: 'cryptic',
  date: page.date,
  band: 'medium',
  n: 1,
  name: 'Cryptic 1',
  headline: 'Cryptic 0001',
  standfirst: HOUSE_LINE,
  read: '~1 min',
  path: page.path,
  data: page.data,
} as unknown as PuzzleFile<CrypticData>;

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const typeWord = async (w: string) => {
  for (const ch of w) await press(`key-${ch}`);
};

let finishes: PuzzleFinish[] = [];
let visits: PuzzleVisit[] = [];
let offs: (() => void)[] = [];
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
  finishes = [];
  visits = [];
  offs = [onFinish((f) => finishes.push(f)), onVisit((v) => visits.push(v))];
  mockSite({ 'feed-lite.json': { items: [] } });
});
afterEach(async () => {
  offs.forEach((o) => o());
  jest.useRealTimers();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Cryptic not yet played', () => {
  it('THEN its Lab start card shows, and Play opens the clue as printed with one start counted', async () => {
    await renderWithProviders(<CrypticScreen file={file} />);
    expect(screen.getByTestId('lab-start')).toBeOnTheScreen();
    expect(screen.getByText(HOUSE_LINE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByTestId('cryptic-screen')).toBeOnTheScreen();
    expect(screen.getByText('Cryptic 1')).toBeOnTheScreen();
    expect(screen.getByText('ACROSS')).toBeOnTheScreen();
    expect(screen.getByTestId('cryptic-clue')).toHaveTextContent(
      `${page.data.clue} (${page.data.enum})`,
    );
    expect(visits.map((v) => [v.ev, v.slug, v.type])).toEqual([
      ['open', 'word-cryptic', null],
      ['start', 'word-cryptic', null],
    ]);
  });

  it('WHEN a wrong answer, then hints, then the answer THEN the page’s messages, a kept clue, the beat and the Lab finish follow', async () => {
    await renderWithProviders(<CrypticScreen file={file} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await typeWord('BAR');
    await press('key-enter');
    expect(screen.getByTestId('cryptic-msg')).toHaveTextContent(
      'Fill every square, then press Enter.',
    );
    await typeWord('GAIM');
    await press('key-enter');
    expect(screen.getByTestId('cryptic-msg')).toHaveTextContent(
      'Not quite. Nothing lost: try again.',
    );
    expect(screen.queryByTestId('cryptic-def')).toBeNull();
    await press('cryptic-hint');
    // The first hint marks the definition: underlined and on the brand tint, so it shows on dark.
    const def = screen.getByTestId('cryptic-def');
    expect(def).toHaveTextContent(
      page.data.clue.slice(...spanChars(page.data.clue, page.data.def)!),
    );
    expect(def).toHaveStyle({ textDecorationLine: 'underline', backgroundColor: '#DCE4FF' });
    await press('cryptic-hint');
    expect(screen.getByTestId('cryptic-hint-panel')).toHaveTextContent(/Clue type/i);
    expect(screen.getByTestId('cryptic-hint-panel')).toHaveTextContent(/Charade/);
    expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).cur).toMatchObject({ id: ID, hints: 2 });
    await press('cryptic-clear');
    jest.useFakeTimers();
    await typeWord(A);
    await press('key-enter');
    expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).done[ID]).toMatchObject({ h: 2 });
    expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).cur).toBeUndefined();
    expect(finishes).toHaveLength(1);
    expect(finishes[0]!.detail).toMatchObject({
      type: 'word-cryptic',
      outcome: 'solved',
      hints: 2,
    });
    await act(async () => {
      jest.advanceTimersByTime(beatMs(A.length) + 50);
    });
    jest.useRealTimers();
    expect(await screen.findByTestId('lab-finish')).toBeOnTheScreen();
    expect(screen.getByText('Should Cryptic go daily?')).toBeOnTheScreen();
    expect(screen.getByTestId('lab-note')).toHaveTextContent('2 hints.');
    expect(screen.getByTestId('cryptic-recap')).toHaveTextContent(/Definition/);
  });

  it('WHEN Learn the clue types is tapped THEN the guide opens at Cryptic', async () => {
    await renderWithProviders(<CrypticScreen file={file} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await press('cryptic-hint');
    await press('cryptic-hint');
    await fireEvent.press(screen.getByText('Learn the clue types ›'));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/how-to-play',
      params: { type: 'cryptic' },
    });
  });

  it('WHEN the app goes away mid-clue THEN the clue is kept', async () => {
    let changed: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      changed = fn as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    await renderWithProviders(<CrypticScreen file={file} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await typeWord('BA');
    changed('background');
    expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).cur).toMatchObject({
      id: ID,
      letters: ['B', 'A', '', '', '', '', ''],
      hints: 0,
    });
  });
});

describe('GIVEN a Cryptic part-played on the website', () => {
  it('THEN the start card says Resume and the clue carries on', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        cur: { id: ID, letters: ['', 'Q', '', '', '', '', ''], hints: 3, s: 30 },
      }),
    );
    await renderWithProviders(<CrypticScreen file={file} />);
    expect(screen.getByText('Part-played')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByTestId('cryptic-msg')).toHaveTextContent('Carrying on where you left off.');
    expect(screen.getByLabelText(`Letter 1 of 7: ${A[0]}, revealed`)).toBeOnTheScreen();
    expect(screen.getByLabelText('Letter 2 of 7: Q')).toBeOnTheScreen();
  });
});

describe('GIVEN a Cryptic already solved', () => {
  it('THEN it opens on the Lab finish with its time and hints', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, done: { [ID]: { t: '1:05', s: 65, h: 0, d: '2026-11-21' } } }),
    );
    await renderWithProviders(<CrypticScreen file={file} />);
    expect(screen.getByTestId('lab-finish')).toBeOnTheScreen();
    expect(screen.getByTestId('lab-hero')).toHaveTextContent('1:05');
    expect(screen.getByTestId('lab-note')).toHaveTextContent('No hints.');
    expect(visits.map((v) => v.ev)).toEqual(['open']);
  });
});
