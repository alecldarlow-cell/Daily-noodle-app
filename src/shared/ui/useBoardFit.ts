import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/** The board's frame: 3 points of border each side (the grids' `side + 6`). */
const FRAME = 6;

/**
 * The side of a square board from the space it actually has. `guess` (fitBoard's
 * answer from the window) sizes the first frame; once the board's slot has been laid
 * out, the side is the slot's shorter edge less the frame, never over `max`. So a big
 * font scale, a short phone or a tall message never pushes the board over the bar or
 * the controls. Put `onLayout` on the slot (a `flex: 1` View holding only the board).
 */
export function useBoardFit(guess: number, max: number) {
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setRoom((r) => (r && r.width === width && r.height === height ? r : { width, height }));
  }, []);
  const side = room
    ? Math.max(0, Math.min(max, Math.floor(Math.min(room.width, room.height) - FRAME)))
    : guess;
  return { side, onLayout };
}
