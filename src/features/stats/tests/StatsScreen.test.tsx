import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { LAST_FEED_KEY } from '@/shared/feed';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { StatsScreen } from '../components/StatsScreen/StatsScreen';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

const item = (type: string, id: string, date: string) => ({
  path: `reports/${date}-${type}-${id.split('·').pop()}.html`,
  type,
  id,
  date,
  headline: `${type} ${id}`,
  standfirst: '',
  read: '',
  mask: '',
  json: null,
});
const MINIS = Array.from({ length: 6 }, (_, i) =>
  item('mini', `DP·MINI·00${10 + i}`, `2026-10-1${i}`),
);
const FEED = { built: '', today: '2026-10-20', count: MINIS.length, items: MINIS };

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
  mockSite({ 'feed-lite.json': FEED });
});

describe('GIVEN no finished puzzles', () => {
  it('THEN Stats invites a first puzzle and shows no figures', async () => {
    await renderWithProviders(<StatsScreen />);
    expect(screen.getByTestId('stats-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('stats-overall')).toBeNull();
  });
});

describe('GIVEN six Minis, one of them a catch-up', () => {
  beforeEach(() => {
    const done: Record<string, unknown> = {};
    MINIS.forEach((it, i) => {
      done[it.id] = { s: 60 + i * 10, d: i === 5 ? '2026-10-19' : it.date };
    });
    appStorage.setItem('digi-mini-v1', JSON.stringify({ v: 1, done }));
    appStorage.setItem(LAST_FEED_KEY, JSON.stringify(FEED));
  });

  it('THEN the overall tiles, best and median show, and the modes split on the day from catch-ups', async () => {
    const set = jest.spyOn(appStorage, 'setItem');
    await renderWithProviders(<StatsScreen />);
    await waitFor(() => expect(screen.getByTestId('stats-modes')).toBeOnTheScreen());
    set.mockClear();
    expect(screen.getByLabelText('Puzzles finished: 6')).toBeOnTheScreen();
    expect(screen.getByTestId('stats-mini')).toHaveTextContent(/6 puzzles finished/);
    expect(screen.getByTestId('stats-mini')).toHaveTextContent(/Best1:00/);
    expect(screen.getByTestId('stats-mini')).toHaveTextContent(/Median1:25/);
    expect(screen.getByTestId('stats-favourite')).toHaveTextContent(/Mini/);
    expect(screen.getByTestId('stats-not-played')).toHaveTextContent(/Doku/);

    await fireEvent.press(screen.getByTestId('mode-archive'));
    expect(screen.getByTestId('stats-mini')).toHaveTextContent(/1 puzzle finished/);
    expect(screen.getByTestId('stats-mini')).toHaveTextContent(/Medians and charts appear after 3/);
    await fireEvent.press(screen.getByTestId('mode-day'));
    expect(screen.getByTestId('stats-mini')).toHaveTextContent(/5 puzzles finished/);
    // Read-only: the stats never write a save.
    expect(set.mock.calls.filter(([k]) => /^digi-/.test(String(k)))).toEqual([]);
  });
});

describe('GIVEN December with ten results this year', () => {
  beforeAll(() =>
    jest.useFakeTimers({ now: new Date('2026-12-03T12:00:00Z'), advanceTimers: true }),
  );
  afterAll(() => jest.useRealTimers());
  it('THEN the year card shows and shares one line with no link', async () => {
    const done: Record<string, unknown> = {};
    for (let i = 1; i <= 10; i++)
      done[`DP·MINI·90${i}`] = { s: 50 + i, d: `2026-11-${String(i).padStart(2, '0')}` };
    appStorage.setItem('digi-mini-v1', JSON.stringify({ v: 1, done }));
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderWithProviders(<StatsScreen />);
    expect(screen.getByTestId('stats-year')).toHaveTextContent(/Your 2026 in Noodle/);
    await fireEvent.press(screen.getByTestId('stats-share'));
    const msg = (share.mock.calls[0]![0] as { message: string }).message;
    expect(msg).toBe('🍜 My 2026 in Noodle — 10 puzzles · 10 days · 🔥10 best run · Mini most');
    expect(msg).not.toMatch(/https?:|\.co\.uk/);
  });
});

describe('GIVEN five or more results in two months, timed and scored', () => {
  it('THEN each card draws its spread and a monthly trend from zero, labelled for screen readers', async () => {
    const mini: Record<string, unknown> = {};
    const reck: Record<string, unknown> = {};
    for (let i = 1; i <= 5; i++) {
      mini[`a${i}`] = { s: 100 + i, d: `2026-10-0${i}` };
      mini[`b${i}`] = { s: 60 + i, d: `2026-11-0${i}` };
      reck[`a${i}`] = { p: 500 + i, b: 1, d: `2026-10-0${i}` };
      reck[`b${i}`] = { p: 700 + i, b: 2, d: `2026-11-0${i}` };
    }
    appStorage.setItem('digi-mini-v1', JSON.stringify({ v: 1, done: mini }));
    appStorage.setItem('digi-reckon-v1', JSON.stringify({ v: 1, done: reck }));
    await renderWithProviders(<StatsScreen />);
    const trend = screen.getByTestId('trend-mini');
    expect(trend.props.accessibilityLabel).toMatch(
      /Median time by month\. October: 1:43; November: 1:03/,
    );
    await fireEvent(
      screen.getByTestId('trend-mini-plot', { includeHiddenElements: true }),
      'layout',
      {
        nativeEvent: { layout: { width: 300, height: 56 } },
      },
    );
    expect(
      screen.getByTestId('trend-mini-plot', { includeHiddenElements: true }),
    ).toHaveTextContent('1:03');
    expect(screen.getByTestId('trend-reckon').props.accessibilityLabel).toMatch(
      /Average score by month/,
    );
    expect(screen.getByLabelText(/^Your times\./)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Your scores\./)).toBeOnTheScreen();
    expect(screen.getByTestId('stats-reckon')).toHaveTextContent(/Bullseyes15/);
  });
});
