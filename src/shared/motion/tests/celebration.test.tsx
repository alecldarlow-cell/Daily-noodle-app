import { act, render, renderHook, screen } from '@testing-library/react-native';
import type { ComponentRef } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Text, type View } from 'react-native';

import { BURST_MS, burst, CONFETTI_COLORS, flight, makePieces, onBurst } from '../confetti';
import { ConfettiHost } from '../ConfettiHost';
import { forgetReduceMotion } from '../useReduceMotion';
import { LINK_BURSTS, PATH_BURSTS, useWinBursts, WIN_BURSTS, type BoardRef } from '../useWinBursts';
import { useWinWave, WaveFlash, waveMs, WaveScale } from '../WinWave';

const flush = () => act(async () => undefined);
const motion = (reduced: boolean) =>
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduced);

/** A seeded generator, so a burst's pieces are the same every run. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

beforeEach(() => forgetReduceMotion());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('GIVEN a confetti piece’s flight', () => {
  const p = { vx: 3, vy: -10, g: 0.16, rot: 1, vr: 0.2, max: 120 };
  describe('WHEN it is followed frame by frame', () => {
    it('THEN it starts at the burst, arcs under gravity as the site’s loop moves it, and fades out', () => {
      expect(flight(p, 0)).toEqual({ x: 0, y: 0, rot: 1, alpha: 1 });
      // the site's loop: vy += g, then y += vy, once per frame
      let y = 0;
      let vy = p.vy;
      for (let f = 0; f < 30; f++) {
        vy += p.g;
        y += vy;
      }
      expect(flight(p, 30).y).toBeCloseTo(y, 6);
      expect(flight(p, 30).x).toBe(90);
      expect(flight(p, 60).alpha).toBeCloseTo(0.5);
      expect(flight(p, 200).alpha).toBe(0);
    });
  });
});

describe('GIVEN a burst of pieces', () => {
  describe('WHEN it is made at a point', () => {
    it('THEN every piece starts centred on that point, in the house colours in turn, and ends faded', () => {
      const pieces = makePieces(7, { x: 100, y: 200 }, seeded());
      expect(pieces).toHaveLength(7);
      expect(pieces.map((q) => q.color)).toEqual(
        [...CONFETTI_COLORS, ...CONFETTI_COLORS].slice(0, 7),
      );
      for (const q of pieces) {
        expect(q.x[0]).toBeCloseTo(100 - q.w / 2);
        expect(q.y[0]).toBeCloseTo(200 - q.h / 2);
        expect(q.h).toBeCloseTo(q.w * 0.6);
        expect(q.w).toBeGreaterThanOrEqual(5);
        expect(q.w).toBeLessThanOrEqual(11);
        expect(q.opacity[0]).toBe(1);
        expect(q.opacity.at(-1)).toBe(0);
        expect(q.input[0]).toBe(0);
        expect(q.input.at(-1)).toBeLessThanOrEqual(1);
        q.input.slice(1).forEach((v, i) => expect(v).toBeGreaterThan(q.input[i]!));
        expect(q.rotate[0]).toMatch(/rad$/);
      }
    });
  });
});

describe('GIVEN the confetti layer at the root', () => {
  describe('WHEN nothing has been thrown', () => {
    it('THEN it draws nothing, and a burst with no layer mounted does nothing', async () => {
      expect(() => burst(10, { x: 0, y: 0 })).not.toThrow();
      await render(<ConfettiHost />);
      expect(screen.queryByTestId('confetti')).toBeNull();
    });
  });
  describe('WHEN two bursts are thrown', () => {
    it('THEN both are drawn over the screen, never taking a touch, and each clears itself when done', async () => {
      jest.useFakeTimers();
      const timing = jest.spyOn(Animated, 'timing');
      await render(<ConfettiHost />);
      await act(async () => burst(12, { x: 50, y: 50 }));
      expect(screen.getAllByTestId('confetti-piece')).toHaveLength(12);
      expect(screen.getByTestId('confetti').props.pointerEvents).toBe('none');
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ duration: BURST_MS, useNativeDriver: true }),
      );
      await act(async () => jest.advanceTimersByTime(1000));
      await act(async () => burst(5, { x: 50, y: 50 }));
      expect(screen.getAllByTestId('confetti-piece')).toHaveLength(17);
      await act(async () => jest.advanceTimersByTime(BURST_MS - 1000 + 60));
      expect(screen.getAllByTestId('confetti-piece')).toHaveLength(5);
      await act(async () => jest.advanceTimersByTime(1000));
      expect(screen.queryByTestId('confetti')).toBeNull();
    });
  });
});

describe('GIVEN a fresh win’s bursts', () => {
  const board = (x: number, y: number, w: number, h: number): BoardRef => ({
    current: {
      measureInWindow: (fn: (x: number, y: number, w: number, h: number) => void) => fn(x, y, w, h),
    } as unknown as ComponentRef<typeof View>,
  });
  let thrown: { n: number; x: number; y: number; at: number }[];
  let off = () => {};
  beforeEach(() => {
    thrown = [];
    jest.useFakeTimers();
    off = onBurst((n, o) => thrown.push({ n, x: o.x, y: o.y, at: Date.now() }));
  });
  afterEach(() => off());

  describe('WHEN the puzzle is won with motion allowed', () => {
    it('THEN 150 pieces fly from the board’s middle at 0.35 s and 60 more at 1.45 s, even after the sheet takes over', async () => {
      motion(false);
      const ref = board(20, 100, 300, 300);
      const h = await renderHook(
        ({ win }: { win: boolean }) => useWinBursts(win, WIN_BURSTS, ref),
        {
          initialProps: { win: false },
        },
      );
      await flush();
      const t0 = Date.now();
      await act(async () => jest.advanceTimersByTime(2000));
      expect(thrown).toEqual([]);
      const start = Date.now();
      await h.rerender({ win: true });
      await act(async () => jest.advanceTimersByTime(349));
      expect(thrown).toEqual([]);
      await act(async () => jest.advanceTimersByTime(1));
      // the board's phase ends as the sheet rises; the second burst still comes
      await h.rerender({ win: false });
      await act(async () => jest.advanceTimersByTime(1100));
      expect(thrown.map((b) => [b.n, b.x, b.y, b.at - start])).toEqual([
        [150, 170, 226, 350],
        [60, 170, 226, 1450],
      ]);
      // a later win on the same screen (Play again) throws nothing more
      await h.rerender({ win: true });
      await act(async () => jest.advanceTimersByTime(3000));
      expect(thrown).toHaveLength(2);
      expect(t0).toBeLessThan(start);
    });
  });

  describe('WHEN the board can’t be measured, or the screen is left before the second burst', () => {
    it('THEN the bursts aim a little above the window’s middle, and none comes after leaving', async () => {
      motion(false);
      const { width, height } = Dimensions.get('window');
      const h = await renderHook(() => useWinBursts(true, LINK_BURSTS, { current: null }));
      await flush();
      await act(async () => jest.advanceTimersByTime(600));
      expect(thrown.map((b) => [b.n, b.x, b.y])).toEqual([[150, width / 2, height * 0.42]]);
      await h.unmount();
      await act(async () => jest.advanceTimersByTime(2000));
      expect(thrown).toHaveLength(1);
    });
  });

  describe('WHEN the phone asks for reduced motion', () => {
    it('THEN nothing is thrown', async () => {
      motion(true);
      await renderHook(() => useWinBursts(true, PATH_BURSTS, board(0, 0, 10, 10)));
      await flush();
      await act(async () => jest.advanceTimersByTime(3000));
      expect(thrown).toEqual([]);
    });
  });

  describe('WHEN a board reports no size', () => {
    it('THEN Path’s single burst aims at the window instead, at once', async () => {
      motion(false);
      const { width } = Dimensions.get('window');
      await renderHook(() => useWinBursts(true, PATH_BURSTS, board(0, 0, 0, 0)));
      await flush();
      await act(async () => jest.advanceTimersByTime(0));
      expect(thrown.map((b) => [b.n, b.x])).toEqual([[80, width / 2]]);
    });
  });
});

describe('GIVEN the board’s win wave', () => {
  describe('WHEN its length is worked out', () => {
    it('THEN each diagonal step adds 90 ms to a square’s 0.6 s', () => {
      expect(waveMs(0)).toBe(600);
      expect(waveMs(8)).toBe(1320);
    });
  });

  describe('WHEN a board is won with motion allowed', () => {
    it('THEN one native clock runs the whole wave, and squares grow and flash', async () => {
      motion(false);
      const timing = jest.spyOn(Animated, 'timing');
      const Board = ({ play }: { play: boolean }) => {
        const wave = useWinWave(play, 8);
        return (
          <WaveScale wave={wave} at={3}>
            <Text testID="sq">
              <WaveFlash wave={wave} at={3} active="#FFD54A" word="#FFF0B8" />
            </Text>
          </WaveScale>
        );
      };
      const ui = await render(<Board play={false} />);
      await flush();
      expect(screen.queryByTestId('wave-cell')).toBeNull();
      expect(timing).not.toHaveBeenCalled();
      await ui.rerender(<Board play />);
      await flush();
      expect(screen.getByTestId('wave-cell')).toBeOnTheScreen();
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 1320, duration: 1320, useNativeDriver: true }),
      );
      expect(screen.getByTestId('wave-flash')).toHaveStyle({ backgroundColor: '#FFD54A' });
      expect(screen.getByTestId('wave-after')).toHaveStyle({ backgroundColor: '#FFF0B8' });
    });
  });

  describe('WHEN the phone asks for reduced motion', () => {
    it('THEN the squares stay still', async () => {
      motion(true);
      const { result } = await renderHook(() => useWinWave(true, 8));
      await flush();
      expect(result.current).toBeNull();
      await render(
        <WaveScale wave={null} at={0}>
          <Text testID="plain">A</Text>
        </WaveScale>,
      );
      expect(screen.getByTestId('plain')).toBeOnTheScreen();
      expect(screen.queryByTestId('wave-cell')).toBeNull();
    });
  });
});
