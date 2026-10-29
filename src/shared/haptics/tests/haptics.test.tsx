import { renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { DEFAULT_SETTINGS, saveSettings } from '@/shared/settings';

import { buzz, hapticsOn, strongest, useHapticDiff, type Buzz } from '../haptics';

jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
}));
const H = jest.mocked(Haptics);
const os = Platform.OS;
afterEach(() => {
  saveSettings(DEFAULT_SETTINGS);
  Platform.OS = os;
  jest.clearAllMocks();
});

describe('GIVEN the haptics helper on an iPhone', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });
  it('THEN the app’s Vibration switch is on by default', () => {
    expect(hapticsOn()).toBe(true);
  });
  describe('WHEN each kind of buzz is asked for', () => {
    it('THEN a tap is a light impact, a success and an error are notifications', () => {
      buzz('tap');
      buzz('success');
      buzz('error');
      expect(H.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
      expect(H.notificationAsync.mock.calls).toEqual([
        [Haptics.NotificationFeedbackType.Success],
        [Haptics.NotificationFeedbackType.Error],
      ]);
      expect(H.performAndroidHapticsAsync).not.toHaveBeenCalled();
    });
  });
  describe('WHEN the type’s own setting says no, or there is nothing to feel', () => {
    it('THEN nothing buzzes', () => {
      buzz('success', false);
      buzz(null);
      buzz(undefined);
      expect(H.impactAsync).not.toHaveBeenCalled();
      expect(H.notificationAsync).not.toHaveBeenCalled();
    });
  });
  describe('WHEN the phone has no haptic engine (the call throws or rejects)', () => {
    it('THEN the helper swallows it', async () => {
      H.impactAsync.mockImplementationOnce(() => {
        throw new Error('unavailable');
      });
      H.notificationAsync.mockImplementationOnce(() => Promise.reject(new Error('no')));
      expect(() => buzz('tap')).not.toThrow();
      expect(() => buzz('error')).not.toThrow();
      await Promise.resolve();
    });
  });
});

describe('GIVEN the app’s Vibration switch is off (Account › Settings)', () => {
  describe('WHEN any buzz is asked for, on either platform, directly or on a state change', () => {
    it('THEN nothing buzzes; switched back on, it buzzes again', async () => {
      saveSettings({ vibration: false });
      expect(hapticsOn()).toBe(false);
      for (const os2 of ['ios', 'android'] as const) {
        Platform.OS = os2;
        buzz('tap');
        buzz('success');
        buzz('error');
      }
      const { rerender } = await renderHook(
        ({ s }: { s: number }) => useHapticDiff(s, () => 'error'),
        { initialProps: { s: 0 } },
      );
      await rerender({ s: 1 });
      expect(H.impactAsync).not.toHaveBeenCalled();
      expect(H.notificationAsync).not.toHaveBeenCalled();
      expect(H.performAndroidHapticsAsync).not.toHaveBeenCalled();
      saveSettings({ vibration: true });
      Platform.OS = 'ios';
      buzz('tap');
      expect(H.impactAsync).toHaveBeenCalledTimes(1);
    });
  });
});

describe('GIVEN the haptics helper on an Android phone', () => {
  describe('WHEN each kind of buzz is asked for', () => {
    it('THEN the system’s own effects are used: keyboard tap, confirm, reject', () => {
      Platform.OS = 'android';
      buzz('tap');
      buzz('success');
      buzz('error');
      expect(H.performAndroidHapticsAsync.mock.calls).toEqual([
        [Haptics.AndroidHaptics.Keyboard_Tap],
        [Haptics.AndroidHaptics.Confirm],
        [Haptics.AndroidHaptics.Reject],
      ]);
      expect(H.impactAsync).not.toHaveBeenCalled();
    });
  });
});

describe('GIVEN several possible buzzes for one change', () => {
  it('THEN the strongest wins: success, then error, then tap', () => {
    expect(strongest('tap', 'error', 'success')).toBe('success');
    expect(strongest(false, 'tap', 'error')).toBe('error');
    expect(strongest(null, 'tap', undefined)).toBe('tap');
    expect(strongest(false, null)).toBeNull();
  });
});

describe('GIVEN a screen whose state is watched for haptics', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });
  const classify = (a: number, b: number): Buzz | null => (b > a ? 'tap' : null);

  describe('WHEN it first opens', () => {
    it('THEN nothing buzzes (a finished puzzle reopened is silent)', async () => {
      await renderHook(() => useHapticDiff(5, classify));
      expect(H.impactAsync).not.toHaveBeenCalled();
    });
  });
  describe('WHEN the state changes', () => {
    it('THEN the type’s rule picks the buzz, and an unchanged state buzzes nothing', async () => {
      const { rerender } = await renderHook(({ n }: { n: number }) => useHapticDiff(n, classify), {
        initialProps: { n: 1 },
      });
      await rerender({ n: 2 });
      expect(H.impactAsync).toHaveBeenCalledTimes(1);
      await rerender({ n: 2 });
      await rerender({ n: 1 });
      expect(H.impactAsync).toHaveBeenCalledTimes(1);
    });
  });
  describe('WHEN the type’s saved setting has haptics off', () => {
    it('THEN its changes never buzz', async () => {
      const { rerender } = await renderHook(
        ({ n }: { n: number }) => useHapticDiff(n, classify, false),
        {
          initialProps: { n: 1 },
        },
      );
      await rerender({ n: 2 });
      expect(H.impactAsync).not.toHaveBeenCalled();
    });
  });
});
