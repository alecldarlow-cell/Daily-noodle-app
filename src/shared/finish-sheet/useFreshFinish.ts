import { useState } from 'react';

/**
 * True once a puzzle finishes while its screen is open: the finish sheet's entrance
 * plays then, and never for a puzzle that opened already finished (until it's played
 * again on this screen, as Sweep's and Link's Play again allow).
 */
export function useFreshFinish(finished: boolean): boolean {
  const [played, setPlayed] = useState(!finished);
  if (!finished && !played) setPlayed(true);
  return finished && played;
}
