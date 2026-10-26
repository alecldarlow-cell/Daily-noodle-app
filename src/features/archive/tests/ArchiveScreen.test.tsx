import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { ArchiveScreen } from '../components/ArchiveScreen/ArchiveScreen';
import { LAST_ARCHIVE_KEY } from '../hooks/useArchive';
import { FEED_LITE } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
});

// SectionList renders more rows in a batch after a tick; let it finish inside act.
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN the site’s archive list', () => {
  beforeEach(() => mockSite({ 'feed-lite.json': FEED_LITE }));

  describe('WHEN the Archive opens', () => {
    it('THEN puzzles show under their months, and the list is kept for offline', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      expect(screen.getByText('July 2026')).toBeOnTheScreen();
      expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen();
      expect(JSON.parse(appStorage.getItem(LAST_ARCHIVE_KEY) ?? 'null')).toEqual(FEED_LITE);
    });
  });

  describe('WHEN a type chip is tapped', () => {
    it('THEN only that type is listed', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('archive-DP·PATH·0050')).toBeOnTheScreen());
      await fireEvent.press(screen.getByRole('button', { name: 'Mini' }));
      expect(screen.queryByTestId('archive-DP·PATH·0050')).toBeNull();
      expect(screen.getByTestId('archive-DP·MINI·0010')).toBeOnTheScreen();
    });
  });

  describe('WHEN the Archive lays out its type chips', () => {
    it('THEN the chip row never shrinks, so large text isn’t clipped', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      expect(screen.getByTestId('archive-chips')).toHaveStyle({ flexGrow: 0, flexShrink: 0 });
    });
  });

  describe('WHEN it opens', () => {
    it('THEN there is no find-by-number box: the type chips are the only filter', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      expect(screen.queryByLabelText('Find by number')).toBeNull();
      expect(screen.queryByPlaceholderText('Find by number')).toBeNull();
    });
  });

  describe('WHEN a puzzle you finished is listed and tapped', () => {
    it('THEN it shows your result and opens its play screen', async () => {
      appStorage.setItem(
        'digi-path-v1',
        JSON.stringify({ v: 1, done: { 'DP·PATH·0050': { t: '01:42', d: '2026-09-01' } } }),
      );
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Path 50, Solved in 1:42' })).toBeOnTheScreen(),
      );
      await fireEvent.press(screen.getByTestId('archive-DP·PATH·0050'));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'path', file: '2026-09-01-path-0050' },
      });
    });
  });
});

describe('GIVEN no connection', () => {
  it('THEN a saved archive still opens', async () => {
    appStorage.setItem(LAST_ARCHIVE_KEY, JSON.stringify(FEED_LITE));
    mockSite({ 'feed-lite.json': () => new TypeError('Network request failed') });
    await renderWithProviders(<ArchiveScreen />);
    expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen();
  });

  it('THEN with nothing saved it says so, and Try again asks the site', async () => {
    const site = mockSite({ 'feed-lite.json': () => new TypeError('Network request failed') });
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByTestId('archive-offline')).toBeOnTheScreen(), {
      timeout: 15_000,
    });
    const n = site.mock.calls.length;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(site.mock.calls.length).toBeGreaterThan(n));
  }, 20_000);
});
