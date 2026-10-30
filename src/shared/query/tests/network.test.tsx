/** R6: React Query follows the phone's network status (NetInfo, ADR-008). */
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient, type Query } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createQueryClient, followNetwork, isOnline, QueryProvider, refetchOnReconnect } from '..';

const addListener = NetInfo.addEventListener as jest.Mock;

afterEach(() => {
  onlineManager.setOnline(true);
  addListener.mockReset();
  addListener.mockReturnValue(jest.fn());
});

describe('GIVEN the phone’s network status', () => {
  describe('WHEN it is read', () => {
    it('THEN only "not connected" counts as offline; an unknown state is online', () => {
      expect(isOnline({ isConnected: false })).toBe(false);
      expect(isOnline({ isConnected: true })).toBe(true);
      expect(isOnline({ isConnected: null })).toBe(true);
    });
  });

  describe('WHEN the phone stays on Wi-Fi but the Internet can’t be reached', () => {
    it('THEN that counts as offline, and reachable again (or not yet known) as online', () => {
      expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
      expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
      expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    });

    it('THEN React Query goes offline and back online when the line returns', () => {
      let report: (s: { isConnected: boolean; isInternetReachable: boolean }) => void = () =>
        undefined;
      addListener.mockImplementation((fn: typeof report) => {
        report = fn;
        return jest.fn();
      });
      const stop = followNetwork();
      report({ isConnected: true, isInternetReachable: false });
      expect(onlineManager.isOnline()).toBe(false);
      report({ isConnected: true, isInternetReachable: true });
      expect(onlineManager.isOnline()).toBe(true);
      stop();
    });
  });

  describe('WHEN followNetwork listens and NetInfo reports a change', () => {
    it('THEN React Query’s online state follows it, and stopping unsubscribes NetInfo', () => {
      const unsubscribe = jest.fn();
      let report: (s: { isConnected: boolean | null }) => void = () => undefined;
      addListener.mockImplementation((fn: typeof report) => {
        report = fn;
        return unsubscribe;
      });
      const stop = followNetwork();
      report({ isConnected: false });
      expect(onlineManager.isOnline()).toBe(false);
      report({ isConnected: true });
      expect(onlineManager.isOnline()).toBe(true);
      stop();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('WHEN the QueryProvider mounts and unmounts', () => {
    it('THEN it subscribes to NetInfo and lets go again', async () => {
      const unsubscribe = jest.fn();
      addListener.mockReturnValue(unsubscribe);
      const view = await render(
        <QueryProvider client={new QueryClient()}>
          <Text>hi</Text>
        </QueryProvider>,
      );
      expect(addListener).toHaveBeenCalledTimes(1);
      await view.unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});

describe('GIVEN a query when the connection comes back', () => {
  const q = (status: string, fetchFailureCount = 0) =>
    ({ state: { status, fetchFailureCount } }) as unknown as Query;

  it('THEN one whose last load failed loads again even if fresh, others only if stale', () => {
    expect(refetchOnReconnect(q('error', 1))).toBe('always');
    expect(refetchOnReconnect(q('pending', 1))).toBe('always');
    expect(refetchOnReconnect(q('success'))).toBe(true);
  });

  it('THEN the app’s client loads whatever the reported status (screens can say offline)', () => {
    const c = createQueryClient().getDefaultOptions();
    expect(c.queries?.networkMode).toBe('always');
    expect(c.mutations?.networkMode).toBe('always');
    expect(c.queries?.refetchOnReconnect).toBe(refetchOnReconnect);
  });
});
