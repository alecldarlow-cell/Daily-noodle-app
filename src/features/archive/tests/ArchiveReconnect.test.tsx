/** R6: when the connection comes back with the app open, Archive loads without a tap. */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { act, screen, waitFor } from '@testing-library/react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { ArchiveScreen } from '../components/ArchiveScreen/ArchiveScreen';
import { FEED_LITE } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.setTimeout(40_000);

const offline = () => new TypeError('Network request failed');
const addListener = NetInfo.addEventListener as jest.Mock;
let network: ((s: Pick<NetInfoState, 'isConnected'>) => void) | null = null;

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  network = null;
  addListener.mockImplementation((fn: typeof network) => {
    network = fn;
    return jest.fn();
  });
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN Archive open with no connection and nothing downloaded', () => {
  describe('WHEN the connection comes back', () => {
    it('THEN the archive loads without a tap', async () => {
      mockSite({ 'feed-lite.json': offline });
      const { client } = await renderWithProviders(<ArchiveScreen />);
      await waitFor(() => expect(screen.getByTestId('archive-offline')).toBeOnTheScreen(), {
        timeout: 20_000,
      });
      await waitFor(() => expect(client.isFetching()).toBe(0), { timeout: 20_000 });
      mockSite({ 'feed-lite.json': FEED_LITE });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });
      expect(screen.getByTestId('archive-offline')).toBeOnTheScreen();

      await act(async () => network!({ isConnected: false }));
      await act(async () => network!({ isConnected: true }));
      await waitFor(() => expect(screen.queryByTestId('archive-offline')).toBeNull());
      expect(screen.getByTestId('archive-DP·MINI·0105-meta')).toBeOnTheScreen();
    });
  });
});
