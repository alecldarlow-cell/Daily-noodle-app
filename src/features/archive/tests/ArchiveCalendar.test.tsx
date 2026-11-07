import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';
import { appRecorder } from '@/shared/track';

import { ArchiveScreen } from '../components/ArchiveScreen/ArchiveScreen';
import { FEED_LITE } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
  mockSite({ 'feed-lite.json': FEED_LITE });
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN the Archive', () => {
  describe('WHEN it opens', () => {
    it('THEN the list is the default and Calendar is one tap away', async () => {
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: 'Show as a calendar' })).not.toBeSelected();
      expect(screen.queryByTestId('archive-calendar')).toBeNull();
    });
  });

  describe('WHEN Calendar is picked with a puzzle finished', () => {
    it('THEN the latest month shows each day’s count, and a day lists its puzzles to open', async () => {
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87, d: '2026-10-24' } } }),
      );
      const ev = jest.spyOn(appRecorder, 'event').mockImplementation(() => undefined);
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('view-calendar')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('view-calendar'));
      await waitFor(() =>
        expect(screen.getByTestId('calendar-month')).toHaveTextContent('October 2026'),
      );
      // Hide done is for the list; the calendar shows done days its own way.
      expect(screen.queryByTestId('archive-hide-done')).toBeNull();
      expect(screen.getByRole('button', { name: 'Show as a list' })).toBeSelected();
      expect(screen.getByTestId('calendar-2026-10-24-sub')).toHaveTextContent('1/2');
      expect(screen.getByTestId('calendar-2026-10-19-sub')).toHaveTextContent('0/1');
      expect(screen.getByTestId('calendar-next')).toBeDisabled();

      await fireEvent.press(screen.getByTestId('calendar-2026-10-24'));
      expect(screen.getByTestId('calendar-day')).toHaveTextContent(/1 of 2 done/);
      expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('archive-DP·SWEEP·2026-10-24'));
      expect(ev).toHaveBeenCalledWith(
        'archive_play',
        { type: 'sweep', id: 'DP·SWEEP·2026-10-24' },
        'archive.html',
      );
    });
  });

  describe('WHEN a type is picked in the calendar, and an earlier month is opened', () => {
    it('THEN days show a tick for that type only, and the month steps back', async () => {
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87, d: '2026-10-24' } } }),
      );
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('view-calendar')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('view-calendar'));
      await fireEvent.press(screen.getByTestId('archive-type'));
      await fireEvent.press(screen.getByRole('button', { name: 'Sweep' }));
      expect(screen.getByTestId('calendar-2026-10-24-sub')).toHaveTextContent('');
      await fireEvent.press(screen.getByTestId('archive-type'));
      await fireEvent.press(screen.getByRole('button', { name: 'Mini' }));
      expect(screen.getByTestId('calendar-2026-10-24-sub')).toHaveTextContent('✓');
      await fireEvent.press(screen.getByTestId('calendar-prev'));
      expect(screen.getByTestId('calendar-month')).toHaveTextContent('September 2026');
      expect(screen.queryByTestId('calendar-2026-09-01')).toBeNull(); // Path only that day
    });
  });
});

describe('GIVEN features.json switches the archive calendar off', () => {
  it('THEN the Archive shows its list only, with no Calendar switch', async () => {
    mockSite({ 'feed-lite.json': FEED_LITE, 'features.json': { archive: false, stats: true } });
    await renderWithProviders(<ArchiveScreen />);
    await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
    await waitFor(() => expect(screen.queryByTestId('view-calendar')).toBeNull());
    expect(screen.getByTestId('archive-hide-done')).toBeOnTheScreen();
  });
});
