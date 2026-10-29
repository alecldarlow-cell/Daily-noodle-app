/* Hardening G3: the sign-in token refreshes only while the app is in front. */
import { AppState, type AppStateStatus } from 'react-native';

import { BUILD_ENV } from '@/shared/env';

import { authClient, refreshWhileActive, setAuthClient } from '../api/authClient';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { startAutoRefresh: jest.fn(async () => {}), stopAutoRefresh: jest.fn(async () => {}) },
  })),
}));

function appState(current: AppStateStatus) {
  let changed: (s: AppStateStatus) => void = () => {};
  const remove = jest.fn();
  return {
    currentState: current,
    addEventListener: jest.fn((_t: string, fn: (s: AppStateStatus) => void) => {
      changed = fn;
      return { remove };
    }),
    change: (s: AppStateStatus) => changed(s),
    remove,
  };
}

const auth = () => ({
  startAutoRefresh: jest.fn(async () => {}),
  stopAutoRefresh: jest.fn(async () => {}),
});

describe('GIVEN signed-in sync on a phone', () => {
  describe('WHEN the app is in front at launch, then goes to the background and comes back', () => {
    it('THEN refresh starts, stops in the background, and starts again on return', () => {
      const a = auth();
      const s = appState('active');
      const off = refreshWhileActive(a, s as never);
      expect(a.startAutoRefresh).toHaveBeenCalledTimes(1);
      expect(a.stopAutoRefresh).not.toHaveBeenCalled();
      s.change('background');
      expect(a.stopAutoRefresh).toHaveBeenCalledTimes(1);
      s.change('inactive');
      expect(a.stopAutoRefresh).toHaveBeenCalledTimes(2);
      s.change('active');
      expect(a.startAutoRefresh).toHaveBeenCalledTimes(2);
      off();
      expect(s.remove).toHaveBeenCalled();
    });
  });

  describe('WHEN the client is made while the app is in the background', () => {
    it('THEN refresh stays off until the app comes to the front, and a refusal is not thrown', async () => {
      const a = auth();
      a.stopAutoRefresh.mockRejectedValueOnce(new Error('no'));
      const s = appState('background');
      refreshWhileActive(a, s as never);
      expect(a.startAutoRefresh).not.toHaveBeenCalled();
      expect(a.stopAutoRefresh).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      s.change('active');
      expect(a.startAutoRefresh).toHaveBeenCalledTimes(1);
    });
  });
});

describe('GIVEN a build with sign-in on', () => {
  describe('WHEN the app first asks for the sign-in client', () => {
    it('THEN the client is wired to the app’s state once, and only once', () => {
      const env = BUILD_ENV as Record<string, string | undefined>;
      const listen = jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation(() => ({ remove: jest.fn() }) as never);
      env.EXPO_PUBLIC_SYNC = '1';
      env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.invalid';
      env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
      try {
        setAuthClient(undefined);
        const c = authClient()!;
        expect(authClient()).toBe(c);
        expect(listen).toHaveBeenCalledTimes(1);
        const calls =
          jest.mocked(c.auth.startAutoRefresh).mock.calls.length +
          jest.mocked(c.auth.stopAutoRefresh).mock.calls.length;
        expect(calls).toBe(1); // set for the app's state at once
      } finally {
        env.EXPO_PUBLIC_SYNC = undefined;
        setAuthClient(undefined);
        listen.mockRestore();
      }
    });
  });
});
