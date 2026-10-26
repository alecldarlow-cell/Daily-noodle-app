/**
 * The players' own palette (dailynoodle engines/mini.css and house.css, 24 Oct 2026):
 * the marigold cursor, the pale word highlight, check marks, blocks and cards, in
 * light and dark, so a native board looks like the page's.
 */
import { useColorScheme } from 'react-native';

export interface PuzzleTokens {
  paper: string;
  card: string;
  ink: string;
  inkSoft: string;
  line: string;
  lineSoft: string;
  cellEdge: string;
  block: string;
  active: string;
  activeWord: string;
  /** Letters on the cursor or in the highlighted word. */
  onActive: string;
  onWord: string;
  good: string;
  bad: string;
  brand: string;
  /** Links on the finish sheet (finish.css --f-actInk): "See today’s board". */
  actInk: string;
  /** The start card and the share line's card (house.css .dn-start-card, finish.css --f-paper). */
  sheet: string;
  /** Rules round the stats and under Next (finish.css --f-line), and between stats (--f-hair). */
  rule: string;
  hair: string;
  /** Text on the brand blue (the Play and Share pills). */
  onBrand: string;
  /** A found word or given number on the finish sheet (finish.css --f-actT). */
  brandTint: string;
  /** The finish sheet's soft ink and its red (finish.css --f-ink2, --f-bad): a shade apart from the boards'. */
  sheetSoft: string;
  sheetBad: string;
  /** A given square on a recap grid (finish.css --f-cellAlt). */
  cellAlt: string;
  /** Tangle's longest word (finish.css --f-gold, --f-goldT, --f-goldInk). */
  gold: string;
  goldTint: string;
  goldInk: string;
}

const light: PuzzleTokens = {
  paper: '#EDEEF2',
  card: '#FFFFFF',
  ink: '#141726',
  inkSoft: '#5A5F73',
  line: '#141726',
  lineSoft: '#D3D6E0',
  cellEdge: '#CFD3DC',
  block: '#141726',
  active: '#FFD54A',
  activeWord: '#FFF0B8',
  onActive: '#141726',
  onWord: '#141726',
  good: '#157A52',
  bad: '#E4483B',
  brand: '#2E5BFF',
  actInk: '#1B3B9E',
  sheet: '#FFFFFF',
  rule: '#C6CAD6',
  hair: '#DCDFE7',
  onBrand: '#FFFFFF',
  brandTint: '#DCE4FF',
  gold: '#E0A100',
  goldTint: '#FFEFB8',
  goldInk: '#5C4300',
  sheetSoft: '#545A6E',
  sheetBad: '#C2362B',
  cellAlt: '#DCDFE7',
};

const dark: PuzzleTokens = {
  paper: '#11131A',
  card: '#2E3344',
  ink: '#ECEEF4',
  inkSoft: '#A6ABBD',
  line: '#4A5066',
  lineSoft: '#3A3F52',
  cellEdge: '#1C1F2A',
  block: '#050608',
  active: '#FFD54A',
  activeWord: '#4A4220',
  onActive: '#141726',
  onWord: '#ECEEF4',
  good: '#4CC793',
  bad: '#FF7A6E',
  brand: '#3D63FF',
  actInk: '#A9BBFF',
  sheet: '#1B1E29',
  rule: '#3A3F52',
  hair: '#2A2E3C',
  onBrand: '#FFFFFF',
  brandTint: '#25305C',
  gold: '#F2BE2E',
  goldTint: '#3B3010',
  goldInk: '#FFE08A',
  sheetSoft: '#A6ABBD',
  sheetBad: '#FF7A6E',
  cellAlt: '#1E2230',
};

export function puzzleTokensFor(scheme: string | null | undefined): PuzzleTokens {
  return scheme === 'dark' ? dark : light;
}

export function usePuzzleTokens(): PuzzleTokens {
  return puzzleTokensFor(useColorScheme());
}
