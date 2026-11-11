import type { PuzzleFile } from '../../types';
import type { RedactData } from '../model';

/** Redact 5 (1 Nov 2026), a 6×6 Lab board. */
export const redact5: RedactData = {
  type: 'redact',
  id: 'DP·REDA·0005',
  band: 'medium',
  n: 6,
  letters: 'PENSPARACIALORANGESENSENENDBEESAYNEE',
  black: [0, 1, 2, 23, 27, 28, 29, 33, 34, 35],
  words: [
    'spa',
    'racial',
    'orange',
    'sense',
    'end',
    'say',
    'roses',
    'arena',
    'candy',
    'sins',
    'page',
    'ale',
  ],
  seed: 'redact-0005-10',
};

export const file5: PuzzleFile<RedactData> = {
  id: 'DP·REDA·0005',
  type: 'redact' as never,
  date: '2026-11-01',
  band: 'medium',
  n: 5,
  name: 'Redact 0005',
  headline: 'Redact 0005',
  standfirst: "There's a crossword hiding in here.",
  read: '~1 min',
  path: 'reports/2026-11-01-word-redact-0005.html',
  data: redact5,
};
