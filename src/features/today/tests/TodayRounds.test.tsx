/** AF-020 (Continue on a card, and asking before a kept round is replaced) and AF-023 (offline). */
import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { TodayScreen } from '../components/TodayScreen/TodayScreen';
import { LAST_TODAY_KEY } from '../hooks/useToday';
import { todayList } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.setTimeout(30_000);

const today = londonDay();
const offline = () => new TypeError('Network request failed');

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN rounds left part-way', () => {
  beforeEach(() => {
    mockSite({ 'puzzles-today.json': todayList() });
    appStorage.setItem(
      'noodle-app-progress-mini',
      JSON.stringify({ v: 1, id: 'DP·MINI·0105', secs: 245, moves: [{ t: 'cell', r: 0, c: 0 }] }),
    );
    appStorage.setItem(
      'digi-tangle-v1',
      JSON.stringify({
        v: 1,
        days: { 'DP·TANG·0018': { state: 'playing', found: ['air'], left: 48.2, score: 1 } },
        done: {},
      }),
    );
  });

  describe('WHEN Today opens', () => {
    it('THEN their cards say Continue with the round’s time and the dot mark', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Mini 105, Continue, 4:05' })).toBeOnTheScreen(),
      );
      expect(screen.getByTestId('today-mini-meta')).toHaveTextContent(
        'Today  ·  Continue  ·  4:05',
      );
      expect(screen.getByTestId('today-mini-mark')).not.toHaveTextContent('✓');
      expect(
        screen.getByRole('button', { name: 'Tangle 18, Continue, 0:49 left' }),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Doku 103, Today' })).toBeOnTheScreen();
      // A round in progress isn't "played" in the count.
      expect(screen.getByTestId('today-count')).toHaveTextContent(/^8 puzzles$/);
    });
  });

  describe('WHEN the card with the kept round is tapped', () => {
    it('THEN it opens without asking', async () => {
      const alert = jest.spyOn(Alert, 'alert');
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-mini')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('today-mini'));
      expect(alert).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'mini', file: '2026-10-24-crossword-mini-0105' },
      });
    });
  });
});

describe('GIVEN yesterday’s Mini is kept part-way', () => {
  beforeEach(() => {
    mockSite({
      'puzzles-today.json': todayList(),
      'feed-lite.json': {
        built: today,
        today,
        count: 1,
        items: [
          {
            path: 'reports/2026-10-23-crossword-mini-0104.html',
            type: 'mini',
            id: 'DP·MINI·0104',
            date: '2026-10-23',
            headline: 'Mini 104',
            standfirst: 'Yesterday.',
            read: '~3 min',
            mask: '',
            json: null,
          },
        ],
      },
    });
    appStorage.setItem(
      'noodle-app-progress-mini',
      JSON.stringify({ v: 1, id: 'DP·MINI·0104', secs: 30, moves: [{ t: 'cell', r: 0, c: 0 }] }),
    );
  });

  describe('WHEN today’s Mini is tapped', () => {
    it('THEN it asks before replacing that round, and can go to it instead', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-mini')).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: 'Mini 105, Today' })).toBeOnTheScreen();
      await waitFor(() => expect(screen.queryByText('Yesterday.')).toBeNull());
      await fireEvent.press(screen.getByTestId('today-mini'));
      expect(router.push).not.toHaveBeenCalled();
      expect(alert.mock.calls[0]![0]).toBe('Replace your Mini in progress?');
      const buttons = alert.mock.calls[0]![2] as AlertButton[];
      expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Go to Mini 104', 'Start Mini 105']);
      buttons[1]!.onPress!();
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'mini', file: '2026-10-23-crossword-mini-0104' },
      });
      // Another type is unaffected.
      await fireEvent.press(screen.getByTestId('today-doku'));
      expect(alert).toHaveBeenCalledTimes(1);
      alert.mockRestore();
    });
  });
});

describe('GIVEN no connection and today’s list kept from earlier', () => {
  beforeEach(() => {
    appStorage.setItem(LAST_TODAY_KEY, JSON.stringify(todayList()));
    // Mini and Borders were opened before, so their data is on the phone.
    appStorage.setItem(
      'noodle-app-puzzle:2026-10-24-crossword-mini-0105',
      JSON.stringify({ id: 'DP·MINI·0105', path: 'x', data: {} }),
    );
    appStorage.setItem(
      'noodle-app-puzzle:2026-10-24-geo-borders-0020',
      JSON.stringify({ id: 'DP·BORD·0020', path: 'x', data: {} }),
    );
    mockSite({ 'puzzles-today.json': offline, 'feed-lite.json': offline });
  });

  describe('WHEN Today opens', () => {
    it('THEN it says what still works offline and marks the downloaded puzzles', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-offline-kept')).toBeOnTheScreen(), {
        timeout: 20_000,
      });
      expect(screen.getByText('You’re offline')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Puzzles you’ve opened before still work; pull down or tap Try again when you’re back online.',
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/as soon as/)).toBeNull();
      expect(screen.getByTestId('today-mini-meta')).toHaveTextContent(/Downloaded/);
      expect(screen.getByTestId('today-borders-meta')).toHaveTextContent(/Downloaded/);
      expect(screen.getByTestId('today-doku-meta')).not.toHaveTextContent(/Downloaded/);
      expect(screen.getByRole('button', { name: 'Mini 105, Today, downloaded' })).toBeOnTheScreen();
    });
  });

  describe('WHEN the site answers again on Try again', () => {
    it('THEN the offline note and the Downloaded marks go', async () => {
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-offline-kept')).toBeOnTheScreen(), {
        timeout: 20_000,
      });
      mockSite({ 'puzzles-today.json': todayList() });
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(screen.queryByTestId('today-offline-kept')).toBeNull());
      expect(screen.getByTestId('today-mini-meta')).not.toHaveTextContent(/Downloaded/);
    });
  });
});

describe('GIVEN no connection and no list for today', () => {
  describe('WHEN Today opens', () => {
    it('THEN it says the puzzles haven’t downloaded, without promising they’ll appear', async () => {
      mockSite({ 'puzzles-today.json': offline });
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-offline')).toBeOnTheScreen(), {
        timeout: 20_000,
      });
      expect(
        screen.getByText(
          'You’re offline, and today’s puzzles haven’t downloaded yet. Puzzles you’ve opened before still work; pull down or tap Try again when you’re back online.',
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByTestId('today-offline-kept')).toBeNull();
    });
  });
});
