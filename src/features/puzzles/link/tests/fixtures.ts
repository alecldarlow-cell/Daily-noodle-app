import type { PuzzleFile } from '../../types';
import type { LinkData } from '../model';

/** Link 78 (25 Oct 2026), as its page's window.DN_PUZZLE has it. */
export const link78: LinkData = {
  type: 'link',
  id: 'DP·LINK·0078',
  band: 'medium',
  groups: [
    { rank: 1, name: 'In the fruit bowl', members: ['APPLES', 'BANANAS', 'ORANGES', 'PLUMS'] },
    { rank: 2, name: 'Weapons', members: ['SWORD', 'AXE', 'BOW', 'DAGGER'] },
    { rank: 3, name: 'Ten-pin bowling terms', members: ['STRIKE', 'GUTTER', 'ALLEY', 'SPLIT'] },
    { rank: 4, name: 'Anagrams of one another', members: ['PEARS', 'SPEAR', 'SPARE', 'REAPS'] },
  ],
  traps: [
    { tile: 'PEARS', not: 'In the fruit bowl' },
    { tile: 'SPEAR', not: 'Weapons' },
    { tile: 'SPARE', not: 'Ten-pin bowling terms' },
  ],
};

/** reports/2026-10-25-word-link-0078.json, as tools/puzzle-json.js writes it. */
export const file78: PuzzleFile<LinkData> = {
  id: 'DP·LINK·0078',
  type: 'link',
  date: '2026-10-25',
  band: 'medium',
  n: 78,
  name: 'Link 78',
  headline: 'Link 0078',
  standfirst: 'Sixteen tiles, four hidden groups, four mistakes.',
  read: '~4 min',
  path: 'reports/2026-10-25-word-link-0078.html',
  data: link78,
};

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
