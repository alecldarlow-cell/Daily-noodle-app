import type { PuzzleFile } from '../../types';
import type { SweepData } from '../model';

/** Sweep 94 (18 Oct 2026), the site's own test board (tools/tests/run.js F.sweep). */
export const sweep94: SweepData = {
  type: 'sweep',
  id: 'DP·SWEEP·2026-10-18',
  band: 'medium',
  mines: [
    [1, 3],
    [1, 5],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 4],
    [6, 6],
  ],
  start: [4, 5],
};

/** Sweep 81 (5 Oct 2026): the board whose unproved flag fooled the old Hint (run.js sweep:hint b). */
export const sweep81: SweepData = {
  type: 'sweep',
  id: 'DP·SWEEP·2026-10-05',
  band: 'medium',
  mines: [
    [1, 4],
    [2, 1],
    [2, 5],
    [3, 5],
    [4, 1],
    [6, 2],
    [6, 6],
  ],
  start: [5, 4],
};

/** reports/2026-10-18-logic-sweep.json, as tools/puzzle-json.js writes it (n from the headline). */
export const file94: PuzzleFile<SweepData> = {
  id: 'DP·SWEEP·2026-10-18',
  type: 'sweep',
  date: '2026-10-18',
  band: 'medium',
  n: 94,
  name: 'Sweep 0094',
  headline: 'Sweep 0094',
  standfirst: 'Seven mines, thirty-six squares.',
  read: '~3 min',
  path: 'reports/2026-10-18-logic-sweep.html',
  data: sweep94,
};

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
