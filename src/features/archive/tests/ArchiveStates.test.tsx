import { act, screen, waitFor } from '@testing-library/react-native';
import { RefreshControl, StyleSheet, type RefreshControlProps } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';
import { tokensFor } from '@/shared/theme';

import { ArchiveScreen } from '../components/ArchiveScreen/ArchiveScreen';
import { FEED_LITE } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

/** React Native's Jest mock keeps the last RefreshControl mounted, with its props. */
const pull = () =>
  (RefreshControl as unknown as { latestRef: { props: RefreshControlProps } }).latestRef.props;

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

/** A site that doesn't answer until the test is over (then the fetch, and its timer, end). */
let release: (() => void) | undefined;
const hold = () => {
  globalThis.fetch = jest.fn(
    () =>
      new Promise((_, reject) => {
        release = () => reject(new TypeError('Network request failed'));
      }),
  ) as unknown as typeof fetch;
};

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
});

afterEach(async () => {
  release?.();
  release = undefined;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN the Archive’s filters', () => {
  beforeEach(() => mockSite({ 'feed-lite.json': FEED_LITE }));

  describe('WHEN they are laid out', () => {
    it('THEN each type chip has a 46 pt press area round its site-sized pill', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      const hit = flat('chip-mini');
      // the pill: 6 + ~16 text + 6 + 2 border ≈ 30 pt, with 8 pt of press area above and below
      expect(hit.paddingVertical).toBe(8);
      expect(30 + 2 * hit.paddingVertical).toBeGreaterThanOrEqual(44);
      expect(flat('chip-all').paddingVertical).toBe(8);
    });

    it('THEN the Done / Not done switch is 48 pt tall to tap', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      const seg = flat('archive-status');
      const btn = flat('status-done');
      expect(btn.minHeight + 2 * seg.padding + 2 * seg.borderWidth).toBeGreaterThanOrEqual(48);
    });

    it('THEN the chip row runs to the screen’s edges, past the page gutter', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      expect(flat('archive-chips').marginHorizontal).toBe(-16);
    });
  });

  describe('WHEN the list is pulled down to refresh', () => {
    it('THEN it asks the site again, with the house-coloured spinner until it answers', async () => {
      const site = mockSite({ 'feed-lite.json': FEED_LITE });
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      expect(pull().testID).toBe('archive-refresh');
      expect(pull().colors).toEqual([tokensFor('light').accent]);
      expect(pull().refreshing).toBe(false);
      const calls = site.mock.calls.length;
      await act(async () => pull().onRefresh!());
      await waitFor(() => expect(site.mock.calls.length).toBeGreaterThan(calls));
      await waitFor(() => expect(pull().refreshing).toBe(false));
    });
  });
});

describe('GIVEN the site hasn’t answered yet', () => {
  it('THEN rows in the cards’ shape show while the archive loads', async () => {
    hold();
    await renderWithProviders(<ArchiveScreen />);
    expect(screen.getByTestId('archive-loading')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Loading puzzles' })).toBeOnTheScreen();
  });
});

describe('GIVEN the phone is online but the site answers with an error', () => {
  it('THEN it says the archive couldn’t load, not “No connection”', async () => {
    mockSite({}); // every file a 404
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByTestId('archive-failed')).toBeOnTheScreen());
    expect(screen.queryByText('No connection')).toBeNull();
    expect(screen.getByText('Couldn’t load the archive')).toBeOnTheScreen();
  });
});
