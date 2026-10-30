import { useCallback, useState } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';

/** The board's frame: 3 points of border each side (the grids' `side + 6`). */
const FRAME = 6;

/**
 * The board's slot in a grid player (Mini, Doku, Sweep, Path): it takes the height left
 * between the bar and the controls, so useBoardFit can size the board from it, and holds
 * the board at its top. On a tall phone the board sits right under the bar and the spare
 * height falls between it and the controls, which stay at the bottom for the thumbs; on a
 * short phone or at a large font scale the slot is only as tall as the board needs.
 */
/**
 * A board's slot: takes the spare height and holds the board at its BOTTOM, just above the
 * controls, so the board is in thumb reach on tall phones (Alec, 30 Oct 2026, tracker AF-032;
 * replaces the 26 Oct top alignment). On a short phone there is no spare height, so nothing moves.
 */
export const BOARD_SLOT: ViewStyle = { flex: 1, justifyContent: 'flex-end', minHeight: 0 };

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
