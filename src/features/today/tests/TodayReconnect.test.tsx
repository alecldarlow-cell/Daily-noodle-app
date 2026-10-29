/** R6: when the connection comes back with the app open, Today loads without a tap. */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { TodayScreen } from '../components/TodayScreen/TodayScreen';
import { LAST_TODAY_KEY } from '../hooks/useToday';
import { todayList } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
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

/** Every load and its retries have given up, so nothing would load again by itself. */
async function settled(client: QueryClient) {
  await waitFor(() => expect(client.isFetching()).toBe(0), { timeout: 20_000 });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 100));
  });
}

/** The phone loses its connection, then gets it back. */
async function reconnect() {
  expect(network).not.toBeNull();
  await act(async () => network!({ isConnected: false }));
  await act(async () => network!({ isConnected: true }));
}

describe('GIVEN Today open with no connection and nothing downloaded', () => {
  describe('WHEN the connection comes back', () => {
    it('THEN today’s puzzles load without a tap', async () => {
      mockSite({ 'puzzles-today.json': offline, 'feed-lite.json': offline });
      const { client } = await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-offline')).toBeOnTheScreen(), {
        timeout: 20_000,
      });
      await settled(client);
      mockSite({ 'puzzles-today.json': todayList(), 'feed-lite.json': offline });
      // Back online but no word from the phone yet: nothing reloads by itself.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });
      expect(screen.getByTestId('today-offline')).toBeOnTheScreen();

      await reconnect();
      await waitFor(() => expect(screen.getByTestId('today-mini')).toBeOnTheScreen());
      expect(screen.queryByTestId('today-offline')).toBeNull();
    });
  });
});

describe('GIVEN Today showing a list kept from earlier while offline', () => {
  describe('WHEN the connection comes back', () => {
    it('THEN the offline note goes without a tap', async () => {
      appStorage.setItem(LAST_TODAY_KEY, JSON.stringify(todayList()));
      mockSite({ 'puzzles-today.json': offline, 'feed-lite.json': offline });
      const { client } = await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-offline-kept')).toBeOnTheScreen(), {
        timeout: 20_000,
      });
      await settled(client);
      const site = mockSite({ 'puzzles-today.json': todayList(), 'feed-lite.json': offline });
      await reconnect();
      await waitFor(() => expect(screen.queryByTestId('today-offline-kept')).toBeNull());
      expect(site).toHaveBeenCalledWith(
        expect.stringContaining('puzzles-today.json'),
        expect.anything(),
      );
    });
  });
});
