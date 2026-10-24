import type { PuzzleFile } from '../../types';
import type { MiniData } from '../model';

/** Mini 105 (24 Oct 2026), as its page's window.DN_PUZZLE has it. */
export const mini105: MiniData = {
  type: 'mini',
  id: 'DP·MINI·0105',
  band: 'medium',
  grid: [
    ['M', 'O', 'R', 'E', '#'],
    ['A', '#', 'A', 'N', 'D'],
    ['P', 'R', 'I', 'D', 'E'],
    ['S', 'I', 'N', '#', 'A'],
    ['#', 'D', 'Y', 'E', 'R'],
  ],
  clues: {
    more: "'Please, sir, I want some ___'",
    and: 'Together with',
    pride: 'What comes before a fall — or a group of lions',
    sin: 'Envy or sloth, say',
    dyer: 'One who tints fabric for a living',
    maps: 'Ordnance Survey sheets',
    rid: 'Get ___ of',
    rainy: 'Showery',
    end: 'Finish',
    dear: 'Much loved',
  },
};

/** reports/2026-10-24-crossword-mini-0105.json, as tools/puzzle-json.js writes it. */
export const file105: PuzzleFile<MiniData> = {
  id: 'DP·MINI·0105',
  type: 'mini',
  date: '2026-10-24',
  band: 'medium',
  n: 105,
  name: 'Mini 105',
  headline: 'Mini 105',
  standfirst: 'What comes before a fall, and Ordnance Survey sheets. Medium.',
  read: '~3 min',
  path: 'reports/2026-10-24-crossword-mini-0105.html',
  data: mini105,
};

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
