import { act, fireEvent, screen } from '@testing-library/react-native';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { LinkScreen } from '../components/LinkScreen';
import { SAVE_KEY } from '../model';
import { file78, link78 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const G = link78.groups.map((g) => g.members.map((m) => m.toUpperCase()));
let appState: ((s: AppStateStatus) => void)[] = [];

async function run(ms: number) {
  for (let t = 0; t < ms; t += 100)
    await act(async () => {
      jest.advanceTimersByTime(Math.min(100, ms - t));
    });
}
const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
async function guess(ws: string[]) {
  for (const w of ws) await fireEvent.press(screen.getByTestId(`tile-${w}`));
  await press('Submit');
  await run(1500);
}
const clockText = () => screen.getByTestId('puzzle-clock').props.children as string;
const dim = () => StyleSheet.flatten(screen.getByTestId('puzzle-clock').props.style).opacity;
const save = () => JSON.parse(appStorage.getItem(SAVE_KEY) || 'null');
const goAway = async (s: AppStateStatus = 'background') =>
  act(async () => appState.forEach((fn) => fn(s)));

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  appStorage.setItem(SAVE_KEY, '');
  jest.useFakeTimers();
  jest.setSystemTime(Date.parse('2026-10-25T08:15:00Z'));
  mockSite({});
  appState = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
    appState.push(fn as (s: AppStateStatus) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(async () => {
  await run(100);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('GIVEN a Link before its clock starts (AF-028)', () => {
  it('THEN the bar shows 0:00 the house way, running from Play and not dimmed once it runs', async () => {
    expect(save()).toBeNull();
    await renderWithProviders(<LinkScreen file={file78} />);
    await press('Play');
    expect(clockText()).toBe('0:00');
    await run(2000);
    expect(clockText()).toBe('0:02');
    expect(dim()).toBeUndefined();
    expect(screen.queryByText('Starts when you tap a word')).toBeNull();
  });
});

describe('GIVEN a Link in play (R10)', () => {
  describe('WHEN the app goes to the background for a minute and comes back', () => {
    it('THEN the minute away doesn’t count, and the round is kept in digi-link-v1 › cur', async () => {
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      await run(3000);
      await guess(G[0]!);
      const before = clockText();
      await goAway('background');
      expect(save().cur).toMatchObject({ id: link78.id, f: [link78.groups[0]!.rank], m: 0 });
      await run(60_000);
      expect(clockText()).toBe(before);
      expect(dim()).toBe(0.42);
      await goAway('active');
      await run(1000);
      const [m, sec] = clockText().split(':').map(Number);
      expect(m! * 60 + sec!).toBeLessThan(10);
    });
  });

  describe('WHEN the screen is left part-way (Back)', () => {
    it('THEN the round is kept with its time, even with no guess yet', async () => {
      const r = await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      await run(4000);
      await r.unmount();
      expect(save().cur).toMatchObject({ id: link78.id, f: [], m: 0, s: 4 });
    });
  });

  describe('WHEN the app only goes inactive (iOS app switcher) and comes back', () => {
    it('THEN the clock stops there too', async () => {
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      await run(2000);
      await goAway('inactive');
      await run(30_000);
      expect(clockText()).toBe('0:02');
      await goAway('active');
      await run(1000);
      expect(clockText()).toBe('0:03');
    });
  });

  describe('WHEN a wrong guess is made', () => {
    it('THEN the round is written straight away, as the page writes it', async () => {
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Play');
      await run(2000);
      await guess([G[1]![0]!, G[1]![1]!, G[1]![2]!, G[2]![0]!]);
      const c = save().cur;
      expect(Object.keys(c).sort()).toEqual(['at', 'f', 'g', 'id', 'l', 'm', 's', 'tr']);
      expect(c).toMatchObject({ id: link78.id, f: [], m: 1, s: 2 });
      expect(c.l).toHaveLength(16);
      expect(c.tr).toHaveLength(1);
    });
  });
});

describe('GIVEN a Link left part-way (AF-029)', () => {
  const kept = () => ({
    v: 1,
    done: {},
    cur: {
      id: link78.id,
      f: [link78.groups[0]!.rank],
      m: 1,
      g: [G[0]!.map(() => link78.groups[0]!.rank), [1, 1, 2, 3]],
      tr: ['X|Y'],
      l: [...G[1]!, ...G[2]!, ...G[3]!],
      s: 65,
      at: Date.parse('2026-10-25T08:00:00Z'),
    },
  });

  describe('WHEN it is opened again', () => {
    it('THEN the card offers Resume, paused at its time, and the board carries on from 1:05', async () => {
      appStorage.setItem(SAVE_KEY, JSON.stringify(kept()));
      await renderWithProviders(<LinkScreen file={file78} />);
      expect(screen.getByText('Today’s Link, part-played')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Paused at 1:05. One group found so far; your clock carries on from there.',
        ),
      ).toBeOnTheScreen();
      await press('Resume');
      expect(screen.getByTestId('band-1')).toBeOnTheScreen();
      expect(clockText()).toBe('1:05');
      await run(2000);
      expect(clockText()).toBe('1:07');
      expect(screen.queryByTestId(`tile-${G[0]![0]}`)).toBeNull();
    });
  });

  describe('WHEN it is finished', () => {
    it('THEN the kept round is cleared (cur null) and the result saved as before', async () => {
      appStorage.setItem(SAVE_KEY, JSON.stringify(kept()));
      await renderWithProviders(<LinkScreen file={file78} />);
      await press('Resume');
      await guess(G[1]!);
      await guess(G[2]!);
      await guess(G[3]!);
      await run(2000);
      const s = save();
      expect(s.cur).toBeNull();
      expect(s.done[link78.id]).toMatchObject({ o: 'win', m: 1 });
      expect(s.done[link78.id].t).toMatch(/^01:\d\d$/);
    });
  });
});
