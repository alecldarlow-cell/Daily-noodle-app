/**
 * Tangle's own thread colours (dailynoodle engines/tangle.css, its light palette and its
 * dark one): a blue thread, the traced tiles tinted blue, the last tile solid blue with a
 * white letter. The rest of the board takes the players' shared tokens.
 */
import { useColorScheme } from 'react-native';

export interface TangleColors {
  /** The thread and a traced tile's edge (tangle.css --thread). */
  thread: string;
  /** A traced tile (.tile.on, --threadT). */
  threadT: string;
  /** The letter on the last tile traced (.tile.last, --onThread). */
  onThread: string;
}

const light: TangleColors = { thread: '#2E5BFF', threadT: '#D9E2FF', onThread: '#FFFFFF' };
const dark: TangleColors = { thread: '#6E8BFF', threadT: '#25305C', onThread: '#FFFFFF' };

export function tangleColorsFor(scheme: string | null | undefined): TangleColors {
  return scheme === 'dark' ? dark : light;
}

export function useTangleColors(): TangleColors {
  return tangleColorsFor(useColorScheme());
}
