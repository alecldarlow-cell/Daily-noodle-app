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
  /** A word's tile flash (AF-027): .tile.good (--okT, --ok), .tile.gold (--goldT, --gold), .tile.meh (--soft). */
  flash: Record<'good' | 'gold' | 'meh', { bg: string; edge: string }>;
}

const light: TangleColors = {
  thread: '#2E5BFF',
  threadT: '#D9E2FF',
  onThread: '#FFFFFF',
  flash: {
    good: { bg: '#D3F0E3', edge: '#1F9E6B' },
    gold: { bg: '#FFF0B8', edge: '#FFC21A' },
    meh: { bg: '#E1E4EC', edge: '#D3D6E0' },
  },
};
const dark: TangleColors = {
  thread: '#6E8BFF',
  threadT: '#25305C',
  onThread: '#FFFFFF',
  flash: {
    good: { bg: '#173A2C', edge: '#4CC793' },
    gold: { bg: '#3B3010', edge: '#F2BE2E' },
    meh: { bg: '#2A2E3C', edge: '#343849' },
  },
};

export function tangleColorsFor(scheme: string | null | undefined): TangleColors {
  return scheme === 'dark' ? dark : light;
}

export function useTangleColors(): TangleColors {
  return tangleColorsFor(useColorScheme());
}
