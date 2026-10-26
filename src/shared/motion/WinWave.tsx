import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

/**
 * The win's wave, as the site's `.grid.celebrate .cell` plays it (mini.css, doku.css,
 * sweep.css, path.css `cellwin`): each square grows to 114% and flashes marigold, then
 * the pale word colour, then settles, 0.6 s a square. Mini, Doku and Sweep start each
 * square 90 ms per step from the top-left corner (row + column); Path pulses all at once.
 */
export const WAVE_STEP_MS = 90;
export const WAVE_CELL_MS = 600;

/** How long a wave of `steps` diagonal steps lasts. */
export function waveMs(steps: number): number {
  return steps * WAVE_STEP_MS + WAVE_CELL_MS;
}

/** One clock (in milliseconds) for the whole board, or null when there's no wave to play. */
export function useWinWave(play: boolean, steps: number): Animated.Value | null {
  const reduced = useReduceMotion();
  const [t] = useState(() => new Animated.Value(0));
  const on = play && reduced === false;
  useEffect(() => {
    if (!on) return;
    t.setValue(0);
    const total = waveMs(steps);
    const a = Animated.timing(t, {
      toValue: total,
      duration: total,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [on, steps, t]);
  return on ? t : null;
}

/** Where square `at` (its step from the corner) is in its 0.6 s. */
function marks(at: number): [number, number, number, number] {
  const d = at * WAVE_STEP_MS;
  return [d, d + 0.35 * WAVE_CELL_MS, d + 0.7 * WAVE_CELL_MS, d + WAVE_CELL_MS];
}

/** Grows a square with the wave; just the square when there's no wave. */
export function WaveScale({
  wave,
  at,
  children,
}: {
  wave: Animated.Value | null;
  at: number;
  children: ReactNode;
}) {
  if (!wave) return <>{children}</>;
  const scale = wave.interpolate({
    inputRange: marks(at),
    outputRange: [1, 1.14, 1.07, 1],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View testID="wave-cell" style={{ transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * The square's flash, laid over its own colour and under its letter: put it first inside
 * the square. Marigold at 35%, the word colour at 70%, gone by the end.
 */
export function WaveFlash({
  wave,
  at,
  active,
  word,
}: {
  wave: Animated.Value | null;
  at: number;
  active: string;
  word: string;
}) {
  if (!wave) return null;
  const [a, b, c, d] = marks(at);
  const flash = wave.interpolate({
    inputRange: [a, b, c],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
  const after = wave.interpolate({
    inputRange: [b, c, d],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
  return (
    <>
      <Animated.View
        pointerEvents="none"
        testID="wave-flash"
        style={[StyleSheet.absoluteFill, { backgroundColor: active, opacity: flash }]}
      />
      <Animated.View
        pointerEvents="none"
        testID="wave-after"
        style={[StyleSheet.absoluteFill, { backgroundColor: word, opacity: after }]}
      />
    </>
  );
}
