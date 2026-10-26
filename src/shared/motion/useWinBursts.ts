import { useEffect, useRef, type ComponentRef, type RefObject } from 'react';
import { Dimensions, type View } from 'react-native';

import { burst, type Origin } from './confetti';
import { useReduceMotion } from './useReduceMotion';

/** The board's host view, measured for the burst's centre. */
export type BoardRef = RefObject<ComponentRef<typeof View> | null>;

/** A burst: `n` pieces, `at` milliseconds after the win. */
export interface BurstPlan {
  at: number;
  n: number;
}

/**
 * The site's two bursts (Mini, Doku, Sweep: 200 at 0.35 s, 80 more as the sheet rises at
 * 1.45 s), trimmed to 150 and 60 so a modest Android phone keeps its frame rate.
 */
export const WIN_BURSTS: readonly BurstPlan[] = [
  { at: 350, n: 150 },
  { at: 1450, n: 60 },
];
/** Link: the same two, as its band lands (0.2 s) and its sheet rises (1.2 s). */
export const LINK_BURSTS: readonly BurstPlan[] = [
  { at: 200, n: 150 },
  { at: 1200, n: 60 },
];
/** Path: one burst of 80 at once, as path.js fireConfetti. */
export const PATH_BURSTS: readonly BurstPlan[] = [{ at: 0, n: 80 }];

/** A little above the window's middle, where the site aims when there's no board. */
function windowCentre(): Origin {
  const { width, height } = Dimensions.get('window');
  return { x: width / 2, y: height * 0.42 };
}

/**
 * The board's middle, a little above centre as the site aims. Until the board answers
 * (or if it can't), the window's middle stands, so a burst is never held up.
 */
function aimAt(board: ComponentRef<typeof View> | null | undefined, aim: { current: Origin }) {
  if (!board || typeof board.measureInWindow !== 'function') return;
  board.measureInWindow((x, y, w, h) => {
    if (w > 0 && h > 0) aim.current = { x: x + w / 2, y: y + h * 0.42 };
  });
}

/**
 * Throws the win's confetti once, when `winning` first turns true (a fresh win, never a
 * reopened one), unless the phone asks for reduced motion. The bursts carry on after the
 * board gives way to the sheet; leaving the screen stops any still to come.
 */
export function useWinBursts(winning: boolean, plan: readonly BurstPlan[], board: BoardRef): void {
  const reduced = useReduceMotion();
  const fired = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!winning || reduced !== false || fired.current) return;
    fired.current = true;
    const aim = { current: windowCentre() };
    aimAt(board.current, aim);
    for (const b of plan) timers.current.push(setTimeout(() => burst(b.n, aim.current), b.at));
  }, [winning, reduced, plan, board]);
  useEffect(() => {
    const t = timers;
    return () => t.current.forEach(clearTimeout);
  }, []);
}
