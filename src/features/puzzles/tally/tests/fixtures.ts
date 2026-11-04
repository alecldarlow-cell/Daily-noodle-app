import type { PuzzleFile } from '../../types';
import type { TallyData } from '../model';

/** Tally 1 (25 Oct 2026). */
export const tally1: TallyData = {
  type: 'tally',
  id: 'DP·TALLY·0001',
  band: 'medium',
  n: 4,
  cages: [
    { c: [11, 15], op: '-', t: 1 },
    { c: [1, 2, 3], op: '*', t: 12 },
    { c: [0, 4, 5], op: '*', t: 24 },
    { c: [12, 13, 14], op: '*', t: 12 },
    { c: [6, 7, 10], op: '+', t: 4 },
    { c: [8, 9], op: '-', t: 2 },
  ],
  sol: '2134342142131342',
};

export const file1: PuzzleFile<TallyData> = {
  id: 'DP·TALLY·0001',
  type: 'tally',
  date: '2026-10-25',
  band: 'medium',
  n: 1,
  name: 'Tally 1',
  headline: 'Tally 1',
  standfirst: 'Four by four.',
  read: '~2 min',
  path: 'reports/2026-10-25-logic-tally-0001.html',
  data: tally1,
};
