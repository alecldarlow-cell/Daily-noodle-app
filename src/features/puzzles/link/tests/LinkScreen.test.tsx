import { londonDay } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders, sharedLine } from '@/shared/testing';

import { LinkScreen } from '../components/LinkScreen';
import { SAVE_KEY, STREAK_KEY } from '../model';
import { file78, link78 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockRouter = (jest.requireMock('expo-router') as { router: Record<string, jest.Mock> })
  .router;
// Each test plays a round through the screen, many steps of the fake clock; a busy
// machine can take longer than Jest's 5 s default.
jest.setTimeout(30_000);

const G = link78.groups.map((g) => g.members);
const clear = () => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
};
/** Let `ms` pass on the fake clock, a tenth of a second at a time (as the board's clock repaints). */
async function run(ms: number) {
  for (let t = 0; t < ms; t += 100)
    await act(async () => {
      jest.advanceTimersByTime(Math.min(100, ms - t));
    });
}
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole('button', { name }));
};
async function guess(ws: string[], settle = true) {
  if (screen.getByRole('button', { name: 'Deselect' }).props.accessibilityState?.disabled === false)
    await press('Deselect');
  for (const w of ws) await fireEvent.press(screen.getByTestId(`tile-${w}`));
  await press('Submit');
  await run(settle ? 1500 : 300);
}

let finishes: PuzzleFinish[] = [];
let off = () => {};
beforeEach(() => {
  clear();
  jest.clearAllMocks();
  jest.useFakeTimers();
  finishes = [];
  off = onFinish((f) => finishes.push(f));
  mockSite({});
});
afterEach(async () => {
  off();
  await run(100);
  jest.useRealTimers();
});

describe('GIVEN a Link not yet played', () => {
  describe('WHEN it opens and Play is pressed', () => {
    it('THEN the start card says what the page says, and the board shows with its clock at zero', async () => {
      await renderWithProviders(<LinkScreen file={file78} />);
      expect(
        screen.getByText('Sixteen words, four hidden groups of four. Four mistakes and it’s over.'),
      ).toBeOnTheScreen();
      expect(screen.getByText('No. 78, Sunday 25 October')).toBeOnTheScreen();
      await run(3000);
      await press('Play');
      expect(screen.getByTestId('link-board')).toBeOnTheScreen();
      expect(screen.getByText('Link 78')).toBeOnTheScreen();
      // The house way, "0:00" (was "00:00"); it runs from Play, so it's no longer dimmed.
      expect(screen.getByTestId('puzzle-clock')).toHaveTextContent('0:00');
      expect(screen.getAllByTestId(/^tile-/)).toHaveLength(16);
      await run(3000);
      expect(screen.getByTestId('puzzle-clock')).toHaveTextContent('0:03');
    });
  });

  describe('WHEN it is solved with one mistake', () => {
    it('THEN the result and streak are saved, the finish announced once, and the sheet shows', async () => {
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      await guess(G[0]!);
      expect(screen.getByTestId('band-1')).toBeOnTheScreen();
      await guess([G[1]![0]!, G[1]![1]!, G[1]![2]!, G[2]![0]!], false);
      expect(screen.getByTestId('link-msg')).toHaveTextContent('ONE AWAY');
      expect(screen.getAllByTestId('pip-gone')).toHaveLength(1);
      await guess(G[1]!);
      await guess(G[2]!);
      await guess(G[3]!);
      await run(1500);
      const day = londonDay();
      const rec = JSON.parse(appStorage.getItem(SAVE_KEY)!).done['DP·LINK·0078'];
      expect(rec).toMatchObject({ o: 'win', m: 1, r: [1, 2, 3, 4], d: day });
      expect(rec.g).toHaveLength(5);
      expect(JSON.parse(appStorage.getItem(STREAK_KEY)!)).toMatchObject({ last: day, streak: 1 });
      expect(finishes).toEqual([
        {
          path: 'reports/2026-10-25-word-link-0078.html',
          type: 'link',
          detail: expect.objectContaining({ type: 'word-link', outcome: 'solved', mistakes: 1 }),
        },
      ]);
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
      expect(screen.getByTestId('finish-title')).toHaveTextContent(/ · Linked$/);
      expect(screen.getAllByTestId(/^guess-(g\d|x)$/)).toHaveLength(5);
      expect(screen.getByTestId('guess-x')).toBeOnTheScreen();
      expect(
        screen.getByText('All four groups with one mistake. Weapons caught you out.'),
      ).toBeOnTheScreen();
      expect(await sharedLine()).toMatch(/^🔗 Link #78 — 🟩❌🟦🟨⬛ · 0:\d\d$/);
      expect(screen.getByTestId('link-recap')).toBeOnTheScreen();
      expect(screen.queryByText('Play again (not recorded)')).toBeNull();
    });
  });

  describe('WHEN Shuffle and the messages are used', () => {
    it('THEN the board reorders, a fifth tile is refused, and a repeat costs nothing', async () => {
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      const before = screen.getAllByTestId(/^tile-/).map((t) => t.props.testID);
      await press('Shuffle');
      const after = screen.getAllByTestId(/^tile-/).map((t) => t.props.testID);
      expect([...after].sort()).toEqual([...before].sort());
      for (const w of [G[0]![0]!, G[1]![0]!, G[1]![1]!, G[2]![0]!, G[3]![0]!])
        await fireEvent.press(screen.getByTestId(`tile-${w}`));
      expect(screen.getByTestId('link-msg')).toHaveTextContent('Four at a time');
      await press('Submit');
      await run(300);
      expect(screen.getByTestId('link-msg')).toHaveTextContent('NOT A GROUP');
      await press('Submit');
      expect(screen.getByTestId('link-msg')).toHaveTextContent('Already tried that one');
      expect(screen.getAllByTestId('pip-gone')).toHaveLength(1);
    });
  });
});

describe('GIVEN a Link lost', () => {
  it('THEN its sheet offers Play again, and the replay records nothing new', async () => {
    await renderWithProviders(<LinkScreen file={file78} />);
    await press('Play');
    await guess(G[0]!);
    for (const w of [
      [G[1]![0]!, G[1]![1]!, G[1]![2]!, G[2]![0]!],
      [G[1]![0]!, G[1]![1]!, G[2]![0]!, G[2]![1]!],
      [G[1]![0]!, G[2]![0]!, G[3]![0]!, G[3]![1]!],
      [G[2]![1]!, G[2]![2]!, G[3]![0]!, G[1]![3]!],
    ])
      await guess(w, false);
    await run(3000);
    expect(screen.getByTestId('finish-title')).toHaveTextContent(/ · So\ close\.$/);
    expect(
      screen.getByText('You found one group of four. Weapons caught you out.'),
    ).toBeOnTheScreen();
    const lost = JSON.parse(appStorage.getItem(SAVE_KEY)!).done['DP·LINK·0078'];
    expect(lost).toMatchObject({ o: 'loss', m: 4 });
    expect(JSON.parse(appStorage.getItem(STREAK_KEY)!)).toMatchObject({ streak: 0 });
    await press('Play again (not recorded)');
    expect(screen.getByText('medium · replay')).toBeOnTheScreen();
    for (const g of G) await guess(g);
    await run(1500);
    expect(screen.getByTestId('finish-title')).toHaveTextContent(/ · Linked$/);
    expect(JSON.parse(appStorage.getItem(SAVE_KEY)!).done['DP·LINK·0078']).toEqual(lost);
    expect(finishes).toHaveLength(1);
  });
});

describe('GIVEN a Link already finished on this phone', () => {
  it('THEN it opens on its sheet with the saved result and never announces again', async () => {
    appStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        done: {
          'DP·LINK·0078': {
            o: 'win',
            t: '02:14',
            m: 0,
            r: [1, 2, 3, 4],
            g: [
              [1, 1, 1, 1],
              [2, 2, 2, 2],
              [3, 3, 3, 3],
              [4, 4, 4, 4],
            ],
            d: '2026-10-25',
          },
        },
      }),
    );
    appStorage.setItem(
      STREAK_KEY,
      JSON.stringify({ last: '2026-10-25', streak: 3, best: 4, dates: [] }),
    );
    await renderWithProviders(<LinkScreen file={file78} />);
    expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('finish-streak')).toHaveTextContent('🔥 3-day streak');
    expect(await sharedLine()).toBe('🔗 Link #78 — 🟩🟦🟨⬛ · 2:14 · 🔥3');
    expect(finishes).toEqual([]);
    await fireEvent.press(screen.getByText('← Puzzles'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
