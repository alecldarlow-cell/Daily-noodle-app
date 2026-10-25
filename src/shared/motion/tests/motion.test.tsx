import { act, render, renderHook, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';

import { useFreshFinish } from '@/shared/finish-sheet';

import { Entrance, ENTRANCE_MS } from '../Entrance';
import { forgetReduceMotion, useReduceMotion } from '../useReduceMotion';

let timing: jest.SpyInstance;
beforeEach(() => {
  forgetReduceMotion();
  timing = jest.spyOn(Animated, 'timing');
});
afterEach(() => {
  jest.restoreAllMocks();
});
const flush = () => act(async () => undefined);
const opacity = () => {
  const style = [screen.getByTestId('e').props.style].flat(Infinity) as { opacity?: unknown }[];
  return style.find((s) => s && 'opacity' in s)?.opacity;
};

describe('GIVEN the phone’s reduce-motion setting', () => {
  describe('WHEN a screen asks for it, and the setting then changes', () => {
    it('THEN it reads the answer, follows the change, and the next screen knows at once', async () => {
      let fire: (r: boolean) => void = () => undefined;
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
        _e: string,
        fn: (r: boolean) => void,
      ) => {
        fire = fn;
        return { remove: jest.fn() };
      }) as unknown as typeof AccessibilityInfo.addEventListener);
      const first = await renderHook(() => useReduceMotion());
      await flush();
      expect(first.result.current).toBe(false);
      await act(async () => fire(true));
      expect(first.result.current).toBe(true);
      // The phone is slow to answer the next screen: the last answer stands meanwhile.
      jest
        .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
        .mockReturnValue(new Promise<boolean>(() => undefined));
      const second = await renderHook(() => useReduceMotion());
      expect(second.result.current).toBe(true);
    });
  });
  describe('WHEN the phone can’t say', () => {
    it('THEN motion is taken as allowed', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no'));
      const { result } = await renderHook(() => useReduceMotion());
      await flush();
      expect(result.current).toBe(false);
    });
  });
});

describe('GIVEN an entrance', () => {
  const ui = (play: boolean) => (
    <Entrance play={play} delay={90} from={0.9} testID="e">
      <Text>Solved</Text>
    </Entrance>
  );
  describe('WHEN it plays with motion allowed', () => {
    it('THEN it fades and rises in once, native-driven, after its delay', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      await render(ui(true));
      await flush();
      expect(timing).toHaveBeenCalledTimes(1);
      expect(timing.mock.calls[0]![1]).toMatchObject({
        toValue: 1,
        duration: ENTRANCE_MS,
        delay: 90,
        useNativeDriver: true,
      });
      expect(screen.getByText('Solved')).toBeOnTheScreen();
    });
  });
  describe('WHEN the phone asks for reduced motion', () => {
    it('THEN nothing moves and the content shows as it is', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await render(ui(true));
      await flush();
      expect(timing).not.toHaveBeenCalled();
      expect(opacity()).toBeUndefined();
      expect(screen.getByText('Solved')).toBeOnTheScreen();
    });
  });
  describe('WHEN it isn’t asked to play (a finished puzzle reopened)', () => {
    it('THEN nothing moves', async () => {
      await render(ui(false));
      await flush();
      expect(timing).not.toHaveBeenCalled();
      expect(opacity()).toBeUndefined();
    });
  });
});

describe('GIVEN a screen deciding whether a finish is fresh', () => {
  describe('WHEN the puzzle opened already finished', () => {
    it('THEN it is not fresh, until it is played again and finished on this screen', async () => {
      const { result, rerender } = await renderHook(
        ({ done }: { done: boolean }) => useFreshFinish(done),
        {
          initialProps: { done: true },
        },
      );
      expect(result.current).toBe(false);
      await rerender({ done: false });
      expect(result.current).toBe(false);
      await rerender({ done: true });
      expect(result.current).toBe(true);
    });
  });
  describe('WHEN the puzzle is played and finished here', () => {
    it('THEN it is fresh', async () => {
      const { result, rerender } = await renderHook(
        ({ done }: { done: boolean }) => useFreshFinish(done),
        {
          initialProps: { done: false },
        },
      );
      await rerender({ done: true });
      expect(result.current).toBe(true);
    });
  });
});
