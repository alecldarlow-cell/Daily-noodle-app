/* Hardening R9: malformed or mismatched cards in feed-lite.json never break the Archive. */
import { act, screen, waitFor } from '@testing-library/react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { ArchiveScreen } from '../components/ArchiveScreen/ArchiveScreen';
import { FEED_LITE, ITEMS } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
});

afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN a card list with malformed and mismatched cards among good ones', () => {
  describe('WHEN the Archive opens', () => {
    it('THEN the good puzzles show under their months and the bad ones are left out', async () => {
      const mini = ITEMS[0]!;
      mockSite({
        'feed-lite.json': {
          ...FEED_LITE,
          items: [
            null,
            { ...mini, path: 'reports/x.html', id: 'DP·PATH·0999', headline: 'Wrong type' },
            { ...mini, path: 'reports/y.html', date: 'soon', headline: 'No date' },
            { headline: 'Half a card' },
            ...ITEMS,
          ],
        },
      });
      await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByText('October 2026')).toBeOnTheScreen());
      expect(screen.getByText('July 2026')).toBeOnTheScreen();
      expect(screen.getByTestId('archive-DP·MINI·0105')).toBeOnTheScreen();
      expect(screen.queryByText('Wrong type')).toBeNull();
      expect(screen.queryByText('No date')).toBeNull();
      expect(screen.queryByText('Half a card')).toBeNull();
    });
  });
});
