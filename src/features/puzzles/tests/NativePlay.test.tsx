import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { PUZZLE_CACHE_PREFIX } from '../api/usePuzzleData';
import { hasNativePlayer, NativePlay } from '../components/NativePlay';
import { enabled } from '../mini';
import { clone, file105 } from '../mini/tests/fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
}));

const FILE = '2026-10-24-crossword-mini-0105';
const bridge = <Text>bridge</Text>;

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN the play route asks which types play natively', () => {
  it('THEN only an enabled Mini does', () => {
    expect(hasNativePlayer('mini')).toBe(enabled);
    expect(hasNativePlayer('doku')).toBe(false);
    expect(hasNativePlayer(undefined)).toBe(false);
  });
});

describe('GIVEN a Mini opened natively', () => {
  describe('WHEN the site has its data file', () => {
    it('THEN it plays natively and keeps the data for offline', async () => {
      const fetch = mockSite({ [`reports/${FILE}.json`]: file105 });
      await renderWithProviders(<NativePlay type="mini" file={FILE} fallback={bridge} />);
      expect(screen.getByTestId('native-loading')).toBeOnTheScreen();
      await waitFor(() => expect(screen.getByTestId('start-card')).toBeOnTheScreen());
      expect(fetch).toHaveBeenCalledWith(
        `https://dailynoodle.co.uk/reports/${FILE}.json`,
        expect.anything(),
      );
      expect(JSON.parse(appStorage.getItem(PUZZLE_CACHE_PREFIX + FILE)!)).toEqual(file105);
    });
  });

  describe('WHEN it was opened before and the phone is offline', () => {
    it('THEN the kept data plays at once', async () => {
      appStorage.setItem(PUZZLE_CACHE_PREFIX + FILE, JSON.stringify(file105));
      mockSite({ [`reports/${FILE}.json`]: new Error('offline') });
      await renderWithProviders(<NativePlay type="mini" file={FILE} fallback={bridge} />);
      expect(screen.getByTestId('start-card')).toBeOnTheScreen();
    });
  });

  describe('WHEN the page has no data file (an older page)', () => {
    it('THEN it plays through the bridge', async () => {
      mockSite({});
      await renderWithProviders(<NativePlay type="mini" file={FILE} fallback={bridge} />);
      await waitFor(() => expect(screen.getByText('bridge')).toBeOnTheScreen());
    });
  });

  describe('WHEN the data is something the page could not play', () => {
    it('THEN it plays through the bridge', async () => {
      const bad = clone(file105);
      bad.data.grid[0]![3] = '#'; // a two-letter run
      mockSite({ [`reports/${FILE}.json`]: bad });
      await renderWithProviders(<NativePlay type="mini" file={FILE} fallback={bridge} />);
      await waitFor(() => expect(screen.getByText('bridge')).toBeOnTheScreen());
    });

    it('THEN a file that is not puzzle data, or a kept copy that is unreadable, falls back too', async () => {
      appStorage.setItem(PUZZLE_CACHE_PREFIX + FILE, '{broken');
      mockSite({ [`reports/${FILE}.json`]: { hello: 1 } });
      await renderWithProviders(<NativePlay type="mini" file={FILE} fallback={bridge} />);
      await waitFor(() => expect(screen.getByText('bridge')).toBeOnTheScreen(), { timeout: 5000 });
    });
  });
});
