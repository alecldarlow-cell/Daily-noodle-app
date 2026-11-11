import type { PuzzleFile } from '../../types';
import type { TiltData } from '../model';

/** Tilt 5 (1 Nov 2026), a 10×10 maze with a shortest way out of 12. */
export const tilt5: TiltData = {
  type: 'tilt',
  id: 'DP·TILT·0005',
  band: 'medium',
  n: 10,
  walls: [
    [11, 9, 1, 1, 3, 9, 5, 5, 5, 3],
    [10, 10, 10, 8, 0, 0, 3, 13, 7, 10],
    [10, 10, 8, 4, 0, 2, 8, 5, 1, 6],
    [10, 10, 10, 9, 0, 0, 4, 3, 8, 3],
    [8, 0, 0, 0, 0, 4, 1, 0, 2, 10],
    [10, 10, 10, 10, 12, 7, 8, 4, 4, 2],
    [10, 10, 10, 10, 11, 13, 2, 13, 7, 10],
    [10, 12, 4, 0, 4, 5, 0, 5, 5, 6],
    [10, 13, 7, 10, 9, 5, 4, 5, 5, 3],
    [12, 5, 5, 4, 4, 5, 5, 5, 5, 2],
  ],
  start: [5, 5],
  exit: [9, 9, 0],
  par: 12,
} as TiltData;

export const file5: PuzzleFile<TiltData> = {
  id: 'DP·TILT·0005',
  type: 'tilt',
  date: '2026-11-01',
  band: 'medium',
  n: 5,
  name: 'Tilt 0005',
  headline: 'Tilt 0005',
  standfirst: 'Turn the maze.',
  read: '~1 min',
  path: 'reports/2026-11-01-logic-tilt-0005.html',
  data: tilt5,
};
