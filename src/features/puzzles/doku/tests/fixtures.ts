import type { PuzzleFile } from '../../types';
import type { DokuData } from '../model';

/** Doku 97 (18 Oct 2026, the site's own test fixture), as its page's window.DN_PUZZLE has it. */
export const doku97: DokuData = {
  type: 'lexi',
  id: 'DP·LEXI·0097',
  band: 'medium',
  grid: [
    ['#', 'S', 'T', 'E', 'P'],
    ['T', '#', '#', '#', 'A'],
    ['H', 'I', 'N', 'D', 'I'],
    ['A', '#', '#', '#', 'D'],
    ['N', 'E', 'A', 'R', '#'],
  ],
  locked: [
    [3, 1],
    [5, 1],
    [1, 5],
    [3, 2],
    [1, 2],
  ],
  bank: ['T', 'E', 'T', 'A', 'N', 'D', 'I', 'A', 'D', 'E', 'A', 'R'],
};

/** Doku 104 (25 Oct 2026): three across words, two given letters. */
export const doku104: DokuData = {
  type: 'lexi',
  id: 'DP·LEXI·0104',
  band: 'hard',
  grid: [
    ['#', '#', '#', '#', '#'],
    ['C', 'E', 'L', 'L', 'O'],
    ['A', 'R', 'B', 'O', 'R'],
    ['P', 'A', 'S', 'T', 'E'],
    ['#', '#', '#', '#', '#'],
  ],
  locked: [
    [4, 4],
    [2, 5],
  ],
  bank: ['C', 'E', 'L', 'L', 'A', 'R', 'B', 'O', 'R', 'P', 'A', 'S', 'E'],
};

/** reports/2026-10-18-logic-doku-0097.json, as tools/puzzle-json.js writes it. */
export const file97: PuzzleFile<DokuData> = {
  id: 'DP·LEXI·0097',
  type: 'doku',
  date: '2026-10-18',
  band: 'medium',
  n: 97,
  name: 'Doku 97',
  headline: 'Doku 0097',
  standfirst:
    "5 anchors, 12 tiles to place. Every across and down run has to read true, and there's a single arrangement that does it.",
  read: '~3 min',
  path: 'reports/2026-10-18-logic-doku-0097.html',
  data: doku97,
};

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** The open (not given) squares of a puzzle, in reading order. */
export function openSquares(d: DokuData): [number, number][] {
  const lk = new Set(d.locked.map(([r, c]) => `${r! - 1},${c! - 1}`));
  const out: [number, number][] = [];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) if (d.grid[r]![c] !== '#' && !lk.has(`${r},${c}`)) out.push([r, c]);
  return out;
}
