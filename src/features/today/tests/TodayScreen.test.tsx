import { dayBefore, londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { mockSite, renderWithProviders } from '@/shared/testing';
import { shortDate } from '@/shared/time';
import { appStorage } from '@/shared/storage';

import { TodayScreen, fileOf } from '../components/TodayScreen/TodayScreen';
import { LAST_TODAY_KEY } from '../hooks/useToday';
import { todayList, yesterdaysList } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const clearStore = () => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
};

const today = londonDay();
const yesterday = dayBefore(today);

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
});

// Let React Query deliver anything still in flight inside act before the next test.
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN the site has published today’s list', () => {
  beforeEach(() => mockSite({ 'puzzles-today.json': todayList() }));

  describe('WHEN Today opens', () => {
    it('THEN all eight puzzles show in the daily order as the site’s cards', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-reckon')).toBeOnTheScreen());
      const cards = screen.getAllByRole('button', {
        name: /^(Mini 105|Doku 103|Sweep 100|Path 98|Link 77|Tangle 18|Borders 20|Reckon 5), Today$/,
      });
      expect(cards.map((c) => c.props.accessibilityLabel)).toEqual([
        'Mini 105, Today',
        'Doku 103, Today',
        'Sweep 100, Today',
        'Path 98, Today',
        'Link 77, Today',
        'Tangle 18, Today',
        'Borders 20, Today',
        'Reckon 5, Today',
      ]);
      expect(screen.getAllByText('How to play')).toHaveLength(8);
      expect(screen.getByTestId('today-count')).toHaveTextContent('8 puzzles');
      expect(screen.getByText(shortDate(today))).toBeOnTheScreen();
    });

    it('THEN “How to play” opens the guide at that type, not the puzzle', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-link-howto')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('today-link-howto'));
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/how-to-play',
        params: { type: 'link' },
      });
    });

    it('THEN it remembers the list for offline use', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() =>
        expect(JSON.parse(appStorage.getItem(LAST_TODAY_KEY) ?? 'null')).toEqual(todayList()),
      );
    });
  });

  describe('WHEN the site’s card list (feed-lite) has today’s cards too', () => {
    beforeEach(() =>
      mockSite({
        'puzzles-today.json': todayList(),
        'feed-lite.json': {
          built: today,
          today,
          count: 1,
          items: [
            {
              path: 'reports/2026-10-24-crossword-mini-0105.html',
              type: 'mini',
              id: 'DP·MINI·0105',
              date: today,
              headline: 'Mini 105',
              standfirst: 'A Bramley or a Cox. Medium.',
              read: '~3 min',
              mask: '........#.......#........',
              json: null,
            },
          ],
        },
      }),
    );

    it('THEN the card shows its standfirst, reading time and grid tile', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() =>
        expect(screen.getByText('A Bramley or a Cox. Medium.')).toBeOnTheScreen(),
      );
      expect(screen.getByText('~3 min')).toBeOnTheScreen();
      expect(screen.getByTestId('today-mini-tile-start')).toBeOnTheScreen();
    });
  });

  describe('WHEN some of today’s puzzles are saved as played', () => {
    it('THEN their cards show the result, Continue (in progress), or lost, in the site’s words', async () => {
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87, d: today } } }),
      );
      appStorage.setItem(
        'digi-sweep-v1',
        JSON.stringify({ v: 1, done: { 'DP·SWEEP·2026-10-24': { o: 'loss', s: 20, d: today } } }),
      );
      appStorage.setItem(
        'digi-borders-v1',
        JSON.stringify({ v: 1, done: {}, cur: { id: 'DP·BORD·0020' } }),
      );
      await renderWithProviders(<TodayScreen />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Mini 105, Solved in 1:27' })).toBeOnTheScreen(),
      );
      expect(screen.getByRole('button', { name: 'Sweep 100, Hit a mine' })).toBeOnTheScreen();
      // AF-020: a round left part-way says Continue (it said "In progress").
      expect(screen.getByRole('button', { name: 'Borders 20, Continue' })).toBeOnTheScreen();
      // The three played cards carry a mark on their tile; the other five don't.
      expect(screen.getByTestId('today-mini-mark')).toBeOnTheScreen();
      expect(screen.getByTestId('today-borders-mark')).toBeOnTheScreen();
      expect(screen.queryByTestId('today-doku-mark')).toBeNull();
      expect(screen.getByTestId('today-count')).toHaveTextContent('8 puzzles · 2 played');
    });

    it('THEN a finished Borders shows its points, then its right answers', async () => {
      appStorage.setItem(
        'digi-borders-v1',
        JSON.stringify({ v: 1, done: { 'DP·BORD·0020': { c: 7, p: 650, secs: 80, on: today } } }),
      );
      await renderWithProviders(<TodayScreen />);
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Borders 20, 650 points · 7/10' }),
        ).toBeOnTheScreen(),
      );
    });

    it('THEN a run of two or more days shows as a streak chip', async () => {
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { a: { s: 1, d: today }, b: { s: 1, d: yesterday } } }),
      );
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('run-chip')).toBeOnTheScreen());
      expect(screen.getByTestId('run-chip')).toHaveTextContent('🔥 2-day streak');
    });

    it('THEN a single day shows no chip (celebration only)', async () => {
      appStorage.setItem('digi-mini-v1', JSON.stringify({ v: 1, done: { a: { s: 1, d: today } } }));
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-mini')).toBeOnTheScreen());
      expect(screen.queryByTestId('run-chip')).toBeNull();
    });
  });

  describe('WHEN a puzzle is tapped', () => {
    it('THEN it opens that puzzle’s play screen', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-path')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('today-path'));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'path', file: '2026-10-24-logic-path-0098' },
      });
    });
  });
});

describe('GIVEN the site still serves yesterday’s list (its nightly build hasn’t run)', () => {
  describe('WHEN Today opens', () => {
    it('THEN it says nearly ready and never shows yesterday’s puzzles as today’s', async () => {
      mockSite({ 'puzzles-today.json': yesterdaysList() });
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-nearly')).toBeOnTheScreen());
      expect(screen.queryByTestId('today-mini')).toBeNull();
    });
  });
});

describe('GIVEN no connection', () => {
  describe('WHEN today’s list was saved earlier today', () => {
    it('THEN Today still shows it', async () => {
      appStorage.setItem(LAST_TODAY_KEY, JSON.stringify(todayList()));
      const site = mockSite({
        'puzzles-today.json': () => new TypeError('Network request failed'),
      });
      await renderWithProviders(<TodayScreen />);
      expect(screen.getByTestId('today-mini')).toBeOnTheScreen();
      // Still shown once the site has been tried and couldn't be reached.
      await waitFor(() => expect(site).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('today-mini')).toBeOnTheScreen());
    });
  });

  describe('WHEN only yesterday’s list was saved', () => {
    it('THEN Today says it’s offline, with Try again', async () => {
      appStorage.setItem(LAST_TODAY_KEY, JSON.stringify(yesterdaysList()));
      const site = mockSite({
        'puzzles-today.json': () => new TypeError('Network request failed'),
      });
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-offline')).toBeOnTheScreen(), {
        timeout: 20_000,
      });
      expect(screen.queryByTestId('today-mini')).toBeNull();
      const calls = site.mock.calls.length;
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(site.mock.calls.length).toBeGreaterThan(calls));
    });
  });
});

describe('GIVEN a puzzle path', () => {
  it('THEN its file name is the route parameter', () => {
    expect(fileOf('reports/2026-10-24-logic-sweep.html')).toBe('2026-10-24-logic-sweep');
  });
});
