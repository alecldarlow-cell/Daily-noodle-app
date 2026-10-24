/** Puzzle types, ids and numbers. Order and labels from the site's PUZZLE_TYPES. */
export const PUZZLE_TYPES = [
  'mini',
  'doku',
  'sweep',
  'path',
  'link',
  'tangle',
  'borders',
  'reckon',
] as const;

export type PuzzleType = (typeof PUZZLE_TYPES)[number];

export const TYPE_LABEL: Record<PuzzleType, string> = {
  mini: 'Mini',
  doku: 'Doku',
  sweep: 'Sweep',
  path: 'Path',
  link: 'Link',
  tangle: 'Tangle',
  borders: 'Borders',
  reckon: 'Reckon',
};

/** The id prefix after "DP·" for each type (tools/build-feed.js TYPE_OF_ID). */
export const TYPE_OF_ID: Record<string, PuzzleType> = {
  MINI: 'mini',
  LEXI: 'doku',
  SWEEP: 'sweep',
  PATH: 'path',
  LINK: 'link',
  TANG: 'tangle',
  BORD: 'borders',
  RECK: 'reckon',
};

export function isPuzzleType(x: unknown): x is PuzzleType {
  return typeof x === 'string' && (PUZZLE_TYPES as readonly string[]).includes(x);
}

/** The type of a puzzle id such as "DP·MINI·0105" (U+00B7 middle dots), or null. */
export function typeOfId(id: string): PuzzleType | null {
  const m = /^DP·([A-Z]+)·/.exec(id);
  return (m && TYPE_OF_ID[m[1] ?? '']) || null;
}

/**
 * The number shown to players, leading zeros dropped ("DP·MINI·0105" → 105), as the
 * engines' dnNum does. Sweep ids end in a date, so its number comes from the headline.
 */
export function puzzleNumber(id: string, headline?: string): number | null {
  if (typeOfId(id) === 'sweep') {
    const m = /(\d+)\s*$/.exec(headline ?? '');
    return m ? Number(m[1]) : null;
  }
  const n = parseInt(String(id).split('·').pop() ?? '', 10);
  return Number.isNaN(n) ? null : n;
}

/** The storage keys of a type: its result document and, for the five grid types, its streak. */
export function saveKey(type: PuzzleType): string {
  return `digi-${type}-v1`;
}

export const GRID_STREAK_TYPES = ['mini', 'doku', 'sweep', 'path', 'link'] as const;
export type GridStreakType = (typeof GRID_STREAK_TYPES)[number];

export function streakKey(type: GridStreakType): string {
  return `digi-${type}-streak`;
}
