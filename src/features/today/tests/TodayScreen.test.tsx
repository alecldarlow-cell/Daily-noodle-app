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
    it('THEN all eight puzzles show in the daily order with Play', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-reckon')).toBeOnTheScreen());
      expect(
        screen.getAllByRole('button', {
          name: /^(Mini 105|Doku 103|Sweep 100|Path 98|Link 77|Tangle 18|Borders 20|Reckon 5)$/,
        }),
      ).toHaveLength(8);
      expect(screen.getAllByText('Play')).toHaveLength(8);
      expect(screen.getByText(shortDate(today))).toBeOnTheScreen();
    });

    it('THEN it remembers the list for offline use', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() =>
        expect(JSON.parse(appStorage.getItem(LAST_TODAY_KEY) ?? 'null')).toEqual(todayList()),
      );
    });
  });

  describe('WHEN some of today’s puzzles are saved as played', () => {
    it('THEN their cards show the result, in progress, or lost, in the site’s words', async () => {
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
      expect(screen.getByRole('button', { name: 'Borders 20, In progress' })).toBeOnTheScreen();
      expect(screen.getAllByText('Play')).toHaveLength(5);
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
