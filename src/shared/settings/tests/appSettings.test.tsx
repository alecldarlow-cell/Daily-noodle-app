import { act, render, renderHook, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';

import { Entrance, forgetReduceMotion, useReduceMotion } from '@/shared/motion';
import { appStorage } from '@/shared/storage';

import {
  APP_SETTINGS_KEY,
  DEFAULT_SETTINGS,
  parseSettings,
  readSettings,
  saveSettings,
  useAppSettings,
} from '../appSettings';

beforeEach(() => {
  appStorage.setItem(APP_SETTINGS_KEY, 'null');
  forgetReduceMotion();
});
afterEach(() => {
  jest.restoreAllMocks();
});
const flush = () => act(async () => undefined);

describe('GIVEN no saved app settings', () => {
  it('THEN Vibration and Sound are on and Animations follow the phone', () => {
    expect(readSettings()).toEqual({ vibration: true, sound: true, motion: 'phone' });
    expect(DEFAULT_SETTINGS).toEqual({ vibration: true, sound: true, motion: 'phone' });
  });

  describe('WHEN what is saved is unreadable or half there', () => {
    it('THEN each missing part takes its default', () => {
      expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS);
      expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
      expect(parseSettings('{"vibration":false}')).toEqual({
        vibration: false,
        sound: true,
        motion: 'phone',
      });
      expect(parseSettings('{"motion":"reduced","vibration":"no","sound":0}')).toEqual({
        vibration: true,
        sound: true,
        motion: 'reduced',
      });
      // A 0.2.0 save (Vibration and Animations only) reads with Sound on.
      expect(parseSettings('{"v":1,"vibration":false,"motion":"reduced"}')).toEqual({
        vibration: false,
        sound: true,
        motion: 'reduced',
      });
      expect(parseSettings('{"sound":false}')).toMatchObject({ sound: false });
    });
  });
});

describe('GIVEN a player changes a switch', () => {
  describe('WHEN Vibration goes off, Animations go to Reduced, then Sound goes off', () => {
    it('THEN all are kept under the same key, and a screen showing them follows', async () => {
      const { result } = await renderHook(() => useAppSettings());
      expect(result.current).toEqual(DEFAULT_SETTINGS);
      await act(async () => {
        saveSettings({ vibration: false });
      });
      expect(result.current).toEqual({ vibration: false, sound: true, motion: 'phone' });
      await act(async () => {
        saveSettings({ motion: 'reduced' });
      });
      expect(result.current).toEqual({ vibration: false, sound: true, motion: 'reduced' });
      await act(async () => {
        saveSettings({ sound: false });
      });
      expect(result.current).toEqual({ vibration: false, sound: false, motion: 'reduced' });
      expect(JSON.parse(appStorage.getItem('noodle-app-settings')!)).toEqual({
        v: 1,
        vibration: false,
        sound: false,
        motion: 'reduced',
      });
    });
  });
});

describe('GIVEN the app’s Animations switch', () => {
  describe('WHEN it follows the phone', () => {
    it('THEN reduced motion is the phone’s answer', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const { result } = await renderHook(() => useReduceMotion());
      await flush();
      expect(result.current).toBe(false);
    });
  });

  describe('WHEN it says Reduced and the phone allows motion', () => {
    it('THEN motion is reduced at once, before the phone answers, and an entrance doesn’t animate', async () => {
      saveSettings({ motion: 'reduced' });
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const { result } = await renderHook(() => useReduceMotion());
      expect(result.current).toBe(true);
      await flush();
      expect(result.current).toBe(true);
      const timing = jest.spyOn(Animated, 'timing');
      await render(
        <Entrance play testID="e">
          <Text>Hi</Text>
        </Entrance>,
      );
      await flush();
      expect(screen.getByText('Hi')).toBeOnTheScreen();
      expect(timing).not.toHaveBeenCalled();
    });
  });

  describe('WHEN it goes back to following the phone while a screen is open', () => {
    it('THEN the screen follows the phone again', async () => {
      saveSettings({ motion: 'reduced' });
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const { result } = await renderHook(() => useReduceMotion());
      await flush();
      expect(result.current).toBe(true);
      await act(async () => {
        saveSettings({ motion: 'phone' });
      });
      expect(result.current).toBe(false);
    });
  });
});
