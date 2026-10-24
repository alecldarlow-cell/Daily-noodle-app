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
      return 'Join 1 to 36 in one unbroken thread, through every given number.';
    case 'link':
      return 'Sixteen words, four hidden groups of four. Four mistakes and it’s over.';
  }
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
    'Tap the marigold 1, then tap a touching square to place 2, and so on. Tap the 1 or the 36 to grow the thread from either end.',
    'Given numbers are checkpoints the thread must pass through. Undo takes back a step; Hint shows a square that is forced.',
  ],
  link: [
    'Tap four words you think belong together, then Submit. Three right gets a “one away”.',
    'Groups run easiest to hardest: green, blue, yellow, then black. Guessing the same four twice costs nothing.',
  ],
};

export const nameOf = (type: GridStreakType) => TYPE_LABEL[type];
