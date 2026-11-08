/**
 * The start card's words for the five grid and tile players, verbatim from dailynoodle
 * engines/house.js (RULE, HOW, the stats labels), so every native player says what
 * its page says.
 */
import { TYPE_LABEL, type GridStreakType } from '@noodle/core';

const W = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the rule line counts, read from the puzzle's data as house.js does. */
export interface RuleData {
  clues?: Record<string, unknown> | null;
  bank?: unknown[] | null;
  mines?: unknown[] | null;
}

export function ruleFor(type: GridStreakType, data: RuleData): string {
  const nClues = data.clues ? Object.keys(data.clues).length : 10;
  const tiles = (data.bank || []).length;
  const mines = (data.mines || []).length;
  switch (type) {
    case 'mini':
      return `${cap(W[nClues] || String(nClues))} clues, across and down. The clock starts with your first letter.`;
    case 'doku':
      return `Place the ${W[tiles] || tiles} letter tiles so every word across and down is real.`;
    case 'sweep':
      return `Clear the board without hitting one of the ${W[mines] || mines} mines. Start on the highlighted square.`;
    case 'path':
      return 'Join 1 to 36 in one unbroken path, through every given number.';
    case 'link':
      return 'Sixteen words, four hidden groups of four. Four mistakes and it’s over.';
    case 'tally':
      return 'Fill the grid with 1 to 4, no repeats in a row or column, so every cage makes its number.';
  }
}

/**
 * The open page's line (Alec, 8 Nov 2026): the type's house line, the card description from
 * dailynoodle tools/standfirst.js (TEXT, and link() with the day's trap count), as the site's
 * generated `dnHouseLine` block in engines/house.js, tangle.js, borders.js and reckon.js works it
 * out. Worked out from the puzzle, not the file's standfirst, so a page whose card line is pinned
 * as reviewed legacy (Doku 32) opens on the house line too. The rule sentence leads How to play.
 */
export const HOUSE_LINE = {
  mini: 'A crossword small enough for a coffee break. Fill every square from the clues.',
  doku: 'A crossword with no clues. Place every letter so each line spells a word.',
  sweep: 'Find the mines with logic alone. Flag them, then clear the grid.',
  path: 'One unbroken trail from 1 to 36. Tap square by square to build it.',
  tangle: 'Search for words before the clock runs out. The longer, the better.',
  borders: 'Name the country from its outline. Size, sea and shape are your clues.',
  reckon: 'Guesstimate your way to winning. What do you reckon?',
  tally: 'Sudoku with a maths twist. Can you make every cage hit its number?',
} as const;
const LINK_LINE = 'Four hidden groups. Can you find the links?';
const TRAP_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

export type HouseLineType = keyof typeof HOUSE_LINE | 'link';

export function houseLine(type: HouseLineType, data?: { traps?: unknown[] | null }): string {
  if (type !== 'link') return HOUSE_LINE[type];
  const n = (data?.traps || []).length;
  if (!n) return LINK_LINE;
  return `${LINK_LINE} Today, ${n === 1 ? 'one tile is' : `${TRAP_WORD[n] ?? n} tiles are`} bluffing.`;
}

export const HOW: Record<GridStreakType, readonly string[]> = {
  mini: [
    'Tap a square and type. Tap the clue bar to switch between across and down; the arrows either side step through the clues.',
    'Check word and Check all mark wrong letters; Reveal word fills one in. The clock stops when the grid is right.',
  ],
  doku: [
    'Tap a tile in the bank, then tap a square to place it; or tap a square and type. Every run of letters, across and down, must make a real word.',
    'Shaded letters are given. With Hints on, a word turns green once it matches the answer.',
  ],
  sweep: [
    'Tap to dig, or switch to Flag and tap to mark a mine. Each number counts the mines touching that square.',
    'Every square can be worked out by deduction, so one mine ends the game. Hint shows a square you could have reasoned out, and why.',
  ],
  path: [
    'Tap the marigold 1, then tap a touching square to place 2, and so on. Tap the 1 or the 36 to grow the path from either end.',
    'Given numbers are checkpoints the path must pass through. Undo takes back a step; Hint shows a square that is forced.',
  ],
  link: [
    'Tap four words you think belong together, then Submit. Three right gets a “one away”.',
    'Groups run easiest to hardest: green, blue, yellow, then black. Guessing the same four twice costs nothing.',
  ],
  tally: [
    'Tap a square, then a number. The number in a cage is the answer and the sign is how you get there: 12× multiplies to 12, 9+ adds to 9, 3÷ is the larger over the smaller, 2− the larger minus the smaller. A lone number is that digit.',
    'Notes puts small candidates in a square; Undo takes back a move. Every board is solved by logic alone, so no guessing is ever needed. The clock starts when you tap Play.',
  ],
};

export const nameOf = (type: GridStreakType) => TYPE_LABEL[type];
