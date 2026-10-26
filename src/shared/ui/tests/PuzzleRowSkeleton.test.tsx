import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { forgetReduceMotion } from '@/shared/motion';

import { PuzzleRowSkeleton, SKELETON_PULSE_MS } from '../PuzzleRow/PuzzleRowSkeleton';

let loop: jest.SpyInstance;

beforeEach(() => {
  forgetReduceMotion();
  loop = jest.spyOn(Animated, 'loop');
});

afterEach(() => jest.restoreAllMocks());

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe('GIVEN the list is still loading', () => {
  describe('WHEN the skeleton shows', () => {
    it('THEN there are rows in the cards’ shape, named for screen readers', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await render(<PuzzleRowSkeleton rows={4} testID="sk" />);
      await settle();
      expect(screen.getAllByTestId('sk-row')).toHaveLength(4);
      expect(screen.getByRole('progressbar', { name: 'Loading puzzles' })).toBeOnTheScreen();
    });
  });

  describe('WHEN the phone allows motion', () => {
    it('THEN the rows pulse gently, at the site’s 1.2 s', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const timing = jest.spyOn(Animated, 'timing');
      await render(<PuzzleRowSkeleton testID="sk" />);
      await settle();
      expect(loop).toHaveBeenCalledTimes(1);
      const total = timing.mock.calls.reduce((n, c) => n + (c[1].duration ?? 0), 0);
      expect(total).toBe(SKELETON_PULSE_MS);
    });
  });

  describe('WHEN the phone asks for reduced motion', () => {
    it('THEN the rows hold still', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await render(<PuzzleRowSkeleton testID="sk" />);
      await settle();
      expect(loop).not.toHaveBeenCalled();
      expect(screen.getAllByTestId('sk-row')).toHaveLength(5);
    });
  });
});
