import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import { forgetReduceMotion } from '@/shared/motion';
import { appStorage } from '@/shared/storage';

import {
  claimShine,
  isPlace,
  METAL,
  PlaceMedal,
  placeTint,
  SHINE_KEY,
} from '../components/PlaceMedal';

let timing: jest.SpyInstance;
beforeEach(() => {
  forgetReduceMotion();
  appStorage.removeItem(SHINE_KEY);
  timing = jest.spyOn(Animated, 'timing');
});
afterEach(() => jest.restoreAllMocks());
const flush = () => act(async () => undefined);
const shine = { key: 'ABCD2345:mini', day: '2026-11-07' };

describe('GIVEN a podium place', () => {
  describe('WHEN its medal shows', () => {
    it('THEN it is a disc in that metal with the number on it', async () => {
      await render(<PlaceMedal place={2} testID="m" />);
      const style = StyleSheet.flatten(
        screen.getByTestId('m', { includeHiddenElements: true }).props.style,
      );
      expect(style.backgroundColor).toBe(METAL[2].face);
      expect(style.borderColor).toBe(METAL[2].rim);
      expect(screen.getByText('2', { includeHiddenElements: true })).toBeTruthy();
    });
  });
  describe('WHEN a row is tinted for it', () => {
    it('THEN the tint is the medal colour, faint', () => {
      expect(placeTint(1)).toBe('#E8B93122');
      expect([1, 2, 3, 4, 0, null, undefined].map(isPlace)).toEqual([
        true,
        true,
        true,
        false,
        false,
        false,
        false,
      ]);
    });
  });
});

describe('GIVEN the once-a-day shine', () => {
  describe('WHEN a board is first seen today', () => {
    it('THEN it shines once, then not again until tomorrow', () => {
      expect(claimShine('L:mini', '2026-11-07')).toBe(true);
      expect(claimShine('L:mini', '2026-11-07')).toBe(false);
      expect(claimShine('L:all', '2026-11-07')).toBe(true);
      expect(claimShine('L:mini', '2026-11-08')).toBe(true);
      expect(JSON.parse(appStorage.getItem(SHINE_KEY)!)).toEqual({
        day: '2026-11-08',
        keys: ['L:mini'],
      });
    });
  });
  describe('WHEN what was saved is unreadable', () => {
    it('THEN it starts again rather than failing', () => {
      appStorage.setItem(SHINE_KEY, '{not json');
      expect(claimShine('L:mini', '2026-11-07')).toBe(true);
    });
  });
  describe('WHEN you placed and motion is allowed', () => {
    it('THEN the medal pops and the shine sweeps, native-driven, once', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const first = await render(<PlaceMedal place={1} shine={shine} />);
      await flush();
      expect(timing).toHaveBeenCalledTimes(2);
      expect(timing.mock.calls[0]![1]).toMatchObject({ toValue: 1.18, useNativeDriver: true });
      expect(timing.mock.calls[1]![1]).toMatchObject({ toValue: 1, useNativeDriver: true });
      first.unmount();
      await render(<PlaceMedal place={1} shine={shine} />);
      await flush();
      expect(timing).toHaveBeenCalledTimes(2);
    });
  });
  describe('WHEN the phone asks for reduced motion', () => {
    it('THEN nothing moves and the board is not used up', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await render(<PlaceMedal place={1} shine={shine} />);
      await flush();
      expect(timing).not.toHaveBeenCalled();
      expect(appStorage.getItem(SHINE_KEY)).toBeNull();
    });
  });
});
