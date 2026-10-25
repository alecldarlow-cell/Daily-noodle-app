import type { PuzzleFile } from '../../types';
import type { PathData } from '../model';

/** Path 92 (18 Oct 2026), the site's own test board (tools/tests/run.js F.path). */
export const path92: PathData = {
  type: 'path',
  id: 'DP·PATH·0092',
  band: 'medium',
  size: 6,
  solution: [
    [28, 29, 30, 31, 32, 33],
    [27, 26, 25, 24, 23, 34],
    [18, 19, 20, 21, 22, 35],
    [17, 16, 7, 6, 5, 36],
    [14, 15, 8, 9, 4, 3],
    [13, 12, 11, 10, 1, 2],
  ],
  locked: [
    [6, 5, 1],
    [4, 6, 36],
    [2, 5, 23],
    [2, 1, 27],
    [4, 3, 7],
    [3, 3, 20],
    [5, 1, 14],
    [4, 2, 16],
    [1, 6, 33],
  ],
  turns: 19,
};

export const file92: PuzzleFile<PathData> = {
  id: 'DP·PATH·0092',
  type: 'path',
  date: '2026-10-18',
  band: 'medium',
  n: 92,
  name: 'Path 0092',
  headline: 'Path 0092',
  standfirst: 'Join 1 to 36.',
  read: '~3 min',
  path: 'reports/2026-10-18-logic-path-0092.html',
  data: path92,
};

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
