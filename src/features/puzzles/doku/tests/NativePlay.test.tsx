import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { NativePlay } from '../../components/NativePlay';
import { clone, file97 } from './fixtures';

// In a file of its own: a Tangle rendered earlier in the shared NativePlay test leaves
// an act() open that swallows the next render (seen 25 Oct 2026).
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
}));

const DOKU = '2026-10-18-logic-doku-0097';
const bridge = <Text>bridge</Text>;

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Doku opened natively', () => {
  describe('WHEN the site has its data file', () => {
    it('THEN it plays natively', async () => {
      mockSite({ [`reports/${DOKU}.json`]: file97 });
      await renderWithProviders(<NativePlay type="doku" file={DOKU} fallback={bridge} />);
      await waitFor(() => expect(screen.getByTestId('start-card')).toBeOnTheScreen(), {
        timeout: 5000,
      });
      // An archive day (18 Oct): the card is headed by its number.
      expect(screen.getByText('Doku 97')).toBeOnTheScreen();
    });
  });

  describe('WHEN the data fails the page’s ship gate', () => {
    it('THEN it plays through the bridge', async () => {
      const bad = clone(file97);
      bad.data.bank[0] = 'Z';
      mockSite({ [`reports/${DOKU}.json`]: bad });
      await renderWithProviders(<NativePlay type="doku" file={DOKU} fallback={bridge} />);
      await waitFor(() => expect(screen.getByText('bridge')).toBeOnTheScreen(), { timeout: 5000 });
    });
  });
});
