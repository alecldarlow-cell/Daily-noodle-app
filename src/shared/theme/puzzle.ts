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
};

export function puzzleTokensFor(scheme: string | null | undefined): PuzzleTokens {
  return scheme === 'dark' ? dark : light;
}

export function usePuzzleTokens(): PuzzleTokens {
  return puzzleTokensFor(useColorScheme());
}
