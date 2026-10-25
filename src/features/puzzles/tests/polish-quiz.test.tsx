/**
 * WP12 on the quiz types: Reckon and Borders buzz where their pages do, Reckon heeds
 * its own saved Vibration setting (read, never changed), and their sheets make their
 * entrance only on a fresh finish.
 */
import { createSaveStore } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Animated } from 'react-native';

import { forgetReduceMotion } from '@/shared/motion';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { BordersScreen } from '../borders/components/BordersScreen';
import { borders15, file15 } from '../borders/tests/fixtures';
import { ReckonScreen } from '../reckon/components/ReckonScreen';
import { SAVE_KEY as RECKON_KEY } from '../reckon/model';
import { file2 } from '../reckon/tests/fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('react-native-webview', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { WebView: () => createElement(View, { testID: 'drawing' }) };
});
jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
}));
jest.setTimeout(30_000);

const H = jest.mocked(Haptics);
const { Success, Error: Wrong } = Haptics.NotificationFeedbackType;
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
let t = 0;
const depsAt = (iso: string) => {
  const now = Date.parse(iso);
  return {
    perf: () => t,
    wall: () => now,
    saves: createSaveStore(appStorage, { now: () => now }),
  };
};

let timing: jest.SpyInstance;
beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  t = 0;
  jest.clearAllMocks();
  forgetReduceMotion();
  timing = jest.spyOn(Animated, 'timing');
  mockSite({});
});
afterEach(async () => {
  timing.mockRestore();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

async function playReckon() {
  const deps = depsAt('2026-10-21T09:00:00Z');
  await renderWithProviders(<ReckonScreen file={file2} deps={deps} />);
  await press('reckon-play-button');
  await press('reckon-act');
  const afterFirst = H.impactAsync.mock.calls.length;
  t += 1000;
  await press('reckon-act');
  for (let i = 1; i < 10; i++) {
    await press('reckon-act');
    t += 1000;
    await press('reckon-act');
  }
  return afterFirst;
}

describe('GIVEN a Reckon with its Vibration setting on (the page’s default)', () => {
  describe('WHEN the ten are locked in', () => {
    it('THEN each lock-in is a tap, the end a success, and the sheet makes its entrance', async () => {
      const first = await playReckon();
      expect(first).toBe(1);
      expect(H.impactAsync).toHaveBeenCalledTimes(10);
      expect(H.notificationAsync.mock.calls).toEqual([[Success]]);
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
      expect(timing).toHaveBeenCalled();
    });
  });
});

describe('GIVEN a Reckon whose saved Vibration setting is off', () => {
  describe('WHEN the ten are locked in', () => {
    it('THEN nothing buzzes, and the setting is left as it was', async () => {
      appStorage.setItem(RECKON_KEY, JSON.stringify({ v: 1, done: {}, hap: false }));
      await playReckon();
      expect(H.impactAsync).not.toHaveBeenCalled();
      expect(H.notificationAsync).not.toHaveBeenCalled();
      expect(JSON.parse(appStorage.getItem(RECKON_KEY)!).hap).toBe(false);
    });
  });
});

describe('GIVEN a Borders', () => {
  const pick = (i: number, right: boolean) => {
    const q = borders15.qs[i]!;
    return right ? q.o.indexOf(q.n) : q.o.findIndex((n) => n !== q.n);
  };
  describe('WHEN a right name, then a wrong one, then the rest are given', () => {
    it('THEN a tap, an error buzz, and a success at the end with the entrance', async () => {
      await renderWithProviders(
        <BordersScreen file={file15} deps={depsAt('2026-10-19T09:00:00Z')} />,
      );
      await press('borders-play-button');
      await press(`borders-opt-${pick(0, true)}`);
      expect(H.impactAsync).toHaveBeenCalledTimes(1);
      await press('borders-next');
      await press(`borders-opt-${pick(1, false)}`);
      expect(H.notificationAsync).toHaveBeenLastCalledWith(Wrong);
      await press('borders-next');
      for (let i = 2; i < 10; i++) {
        await press(`borders-opt-${pick(i, true)}`);
        await press('borders-next');
      }
      expect(screen.getByTestId('finish-sheet')).toBeOnTheScreen();
      expect(H.notificationAsync).toHaveBeenLastCalledWith(Success);
      expect(timing).toHaveBeenCalled();
    });
  });
});
