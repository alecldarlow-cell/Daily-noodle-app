import type { PuzzleFile } from '../../types';
import type { TumblerData } from '../model';

/** Tumbler 25 (11 Nov 2026). */
export const tumbler25: TumblerData = {
  type: 'tumbler',
  id: 'DP·TUMB·0025',
  band: 'medium',
  n: 4,
  wheels: ['RTEDLAW', 'BEYJOXU', 'MDNETFO', 'USIAORK'],
  secret: 'lets',
  words: (
    'auto axes deer demo dens dodo does dons door dots duds dues dunk duos dyer dyes exes eyes ' +
    'leek leer lens lets look loos lots ludo redo reds reek refs rods rook rots runs ruts tees ' +
    'tens toes tofu tons took tots tuna tutu week woes'
  ).split(' '),
  seed: 'tumbler-0025',
};

export const file25 = {
  id: 'DP·TUMB·0025',
  type: 'tumbler',
  date: '2026-11-11',
  band: 'medium',
  n: 25,
  name: 'Tumbler 25',
  headline: 'Tumbler 0025',
  standfirst: "Today's word is hidden in four wheels of letters.",
  read: '~1 min',
  path: 'reports/2026-11-11-word-tumbler-0025.html',
  data: tumbler25,
} as unknown as PuzzleFile<TumblerData>;
