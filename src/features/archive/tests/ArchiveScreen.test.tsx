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

/** Opens the type picker and picks one (Alec, 7 Nov 2026: a sheet of tiles). */
const pickType = async (name: string) => {
  await fireEvent.press(screen.getByTestId('archive-type'));
  await fireEvent.press(screen.getByRole('button', { name }));
};

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
      await pickType('Mini');
      expect(screen.queryByTestId('archive-DP·PATH·0050')).toBeNull();
      expect(screen.getByTestId('archive-DP·MINI·0010')).toBeOnTheScreen();
      // The sheet closes, and the picker names the type with its tile.
      expect(screen.getByTestId('archive-type')).toHaveTextContent('Mini');
      expect(screen.getByRole('button', { name: 'Puzzles: Mini' })).toBeOnTheScreen();
    });
  });

  describe('WHEN the type picker is opened', () => {
    it('THEN a sheet shows All and every puzzle, the current one selected; the scrim closes it', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      expect(screen.getByTestId('archive-type')).toHaveTextContent('All');
      await fireEvent.press(screen.getByTestId('archive-type'));
      expect(screen.getByRole('header', { name: 'Choose a puzzle' })).toBeOnTheScreen();
      const cells = screen.getAllByTestId(/^chip-/).map((c) => c.props.testID as string);
      expect(cells[0]).toBe('chip-all');
      expect(cells).toEqual(expect.arrayContaining(['chip-mini', 'chip-path', 'chip-tally']));
      expect(screen.getByTestId('chip-all')).toBeSelected();
      await fireEvent.press(screen.getByTestId('archive-type-close'));
      expect(screen.queryByTestId('archive-type-sheet')).toBeNull();
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

  describe('WHEN Hide done is switched on, with a type picked too', () => {
    it('THEN the list keeps only unfinished puzzles of that type, and says so when none are left', async () => {
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87, d: '2026-10-24' } } }),
      );
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen());
      const hide = screen.getByRole('switch', { name: 'Hide done' });
      expect(hide).not.toBeChecked();

      await fireEvent.press(hide);
      expect(screen.getByRole('switch', { name: 'Hide done' })).toBeChecked();
      expect(screen.queryByTestId('archive-DP·MINI·0105')).toBeNull();
      expect(screen.getByTestId('archive-DP·MINI·0010')).toBeOnTheScreen();
      expect(screen.getByTestId('archive-DP·PATH·0050')).toBeOnTheScreen();

      // both filters together: Minis not yet done
      await pickType('Mini');
      expect(screen.getByTestId('archive-DP·MINI·0010')).toBeOnTheScreen();
      expect(screen.queryByTestId('archive-DP·PATH·0050')).toBeNull();
      expect(screen.queryByTestId('archive-DP·MINI·0105')).toBeNull();

      // Off again: everything of that type is back.
      await fireEvent.press(screen.getByRole('switch', { name: 'Hide done' }));
      expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen();
    });

    it('THEN with every puzzle of a type done, it says “All done here”', async () => {
      appStorage.setItem(
        'digi-path-v1',
        JSON.stringify({ v: 1, done: { 'DP·PATH·0050': { t: '01:42', d: '2026-09-01' } } }),
      );
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('archive-DP·PATH·0050')).toBeOnTheScreen());
      await pickType('Path');
      await fireEvent.press(screen.getByRole('switch', { name: 'Hide done' }));
      expect(screen.getByTestId('archive-empty')).toHaveTextContent('All done here');
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

describe('GIVEN the Archive’s two filters', () => {
  beforeEach(() => mockSite({ 'feed-lite.json': FEED_LITE }));
  it('THEN they are one row: the type picker, Hide done, then the calendar at the end', async () => {
    // Alec, 7 Nov 2026: one row of controls (it wraps at large text).
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
    const row = screen.getByTestId('archive-switches');
    const inRow = row.children as unknown[];
    expect(inRow.indexOf(screen.getByTestId('archive-type'))).toBe(0);
    expect(inRow.indexOf(screen.getByTestId('archive-hide-done'))).toBe(1);
    expect(inRow.indexOf(screen.getByTestId('view-calendar'))).toBe(2);
    expect(row).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(screen.queryByTestId('archive-chips')).toBeNull();
  });
});
