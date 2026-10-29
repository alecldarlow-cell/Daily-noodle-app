/** AF-030 (the archive starts from yesterday), AF-020 (Continue, replace a kept round), AF-023 (offline). */
import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { ArchiveScreen } from '../components/ArchiveScreen/ArchiveScreen';
import { groupArchive } from '../hooks/groupArchive';
import { LAST_ARCHIVE_KEY } from '../hooks/useArchive';
import type { ArchiveItem, FeedLite } from '../types';
import { FEED_LITE, ITEMS } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.setTimeout(30_000);

const today = londonDay();
const TODAYS: ArchiveItem = {
  path: `reports/${today}-crossword-mini-0110.html`,
  type: 'mini',
  id: 'DP·MINI·0110',
  date: today,
  headline: 'Mini 110',
  standfirst: 'Today’s.',
  read: '~3 min',
  mask: '',
  json: null,
};
const LITE: FeedLite = { ...FEED_LITE, today, count: ITEMS.length + 1, items: [TODAYS, ...ITEMS] };
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

describe('GIVEN the archive list includes today’s puzzles', () => {
  beforeEach(() => mockSite({ 'feed-lite.json': LITE }));

  describe('WHEN the Archive opens', () => {
    it('THEN it starts from yesterday: today’s set is only on Today', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen());
      expect(screen.queryByTestId('archive-DP·MINI·0110')).toBeNull();
      expect(screen.queryByText('Mini 110')).toBeNull();
    });

    it('THEN the filters work as before, still without today’s', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('chip-mini'));
      await fireEvent.press(screen.getByTestId('status-todo'));
      expect(screen.getByTestId('archive-DP·MINI·0010')).toBeOnTheScreen();
      expect(screen.queryByTestId('archive-DP·MINI·0110')).toBeNull();
      expect(screen.queryByTestId('archive-DP·PATH·0050')).toBeNull();
    });

    it('THEN a quiet link at the top goes to the Today tab', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen());
      const link = screen.getByRole('link', { name: 'Today’s puzzles are on the Today tab' });
      expect(link).toHaveTextContent('Today’s puzzles are on the Today tab ›');
      await fireEvent.press(link);
      expect(router.navigate).toHaveBeenCalledWith('/');
      expect(router.push).not.toHaveBeenCalled();
    });
  });
});

describe('GIVEN the archive grouping', () => {
  it('THEN with a day given only earlier puzzles are kept; without one, all are', () => {
    const all = groupArchive(LITE.items, null, 'all', new Set());
    const before = groupArchive(LITE.items, null, 'all', new Set(), today);
    const count = (s: typeof all) => s.reduce((n, x) => n + x.data.length, 0);
    expect(count(all)).toBe(LITE.items.length);
    expect(count(before)).toBe(ITEMS.length);
    expect(
      groupArchive(LITE.items, null, 'all', new Set(), '2026-10-19').flatMap((s) =>
        s.data.map((d) => d.id),
      ),
    ).toEqual(['DP·PATH·0050', 'DP·MINI·0010']);
  });
});

describe('GIVEN a Mini left part-way', () => {
  beforeEach(() => {
    mockSite({ 'feed-lite.json': FEED_LITE });
    appStorage.setItem(
      'noodle-app-progress-mini',
      JSON.stringify({ v: 1, id: 'DP·MINI·0100', secs: 72, moves: [{ t: 'key', ch: 'A' }] }),
    );
  });

  describe('WHEN the Archive opens', () => {
    it('THEN that Mini’s card says Continue with its time', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0100')).toBeOnTheScreen());
      expect(screen.getByTestId('archive-DP·MINI·0100-meta')).toHaveTextContent(/Continue · 1:12$/);
      expect(screen.getByTestId('archive-DP·MINI·0100-mark')).toBeOnTheScreen();
      expect(screen.queryByTestId('archive-DP·MINI·0105-mark')).toBeNull();
    });
  });

  describe('WHEN another Mini is tapped', () => {
    it('THEN it asks before replacing the kept round; Start opens the new one', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0010')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('archive-DP·MINI·0010'));
      expect(router.push).not.toHaveBeenCalled();
      const buttons = alert.mock.calls[0]![2] as AlertButton[];
      expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Go to Mini 100', 'Start Mini 10']);
      buttons[2]!.onPress!();
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'mini', file: '2026-07-19-mini-0010' },
      });
      // The kept one and other types open straight away.
      await fireEvent.press(screen.getByTestId('archive-DP·MINI·0100'));
      await fireEvent.press(screen.getByTestId('archive-DP·PATH·0050'));
      expect(alert).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledTimes(3);
      alert.mockRestore();
    });
  });
});

describe('GIVEN no connection and the archive kept from earlier', () => {
  beforeEach(() => {
    appStorage.setItem(LAST_ARCHIVE_KEY, JSON.stringify(FEED_LITE));
    appStorage.setItem(
      'noodle-app-puzzle:2026-09-01-path-0050',
      JSON.stringify({ id: 'DP·PATH·0050', path: 'x', data: {} }),
    );
    mockSite({ 'feed-lite.json': offline });
  });

  it('THEN it says what still works and marks the downloaded puzzles', async () => {
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByTestId('archive-offline-kept')).toBeOnTheScreen(), {
      timeout: 20_000,
    });
    expect(
      screen.getByText(
        'Puzzles you’ve opened before still work; pull down or tap Try again when you’re back online.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('archive-DP·PATH·0050-meta')).toHaveTextContent(/Downloaded$/);
    expect(screen.getByTestId('archive-DP·MINI·0105-meta')).not.toHaveTextContent(/Downloaded/);
  });
});

describe('GIVEN no connection and nothing kept', () => {
  it('THEN it says the archive hasn’t downloaded, without promising it will load by itself', async () => {
    mockSite({ 'feed-lite.json': offline });
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByTestId('archive-offline')).toBeOnTheScreen(), {
      timeout: 20_000,
    });
    expect(
      screen.getByText(
        'You’re offline, and the archive hasn’t downloaded yet. Pull down or tap Try again when you’re back online.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('archive-offline-kept')).toBeNull();
  });
});
