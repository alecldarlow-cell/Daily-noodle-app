/**
 * The side of a square board, in points: as big as `max`, leaving `reserve` points of
 * the screen's height for the bar, controls and keyboard, never under `min` for
 * readability, and never wider than the screen less its gutters (16 each side), so a
 * 320-point phone never scrolls sideways.
 */
export function fitBoard(
  window: { width: number; height: number },
  reserve: number,
  max: number,
  min = 200,
): number {
  const across = window.width - 32;
  return Math.max(0, Math.min(across, Math.max(min, Math.min(window.height - reserve, max))));
}
