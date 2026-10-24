import type { PuzzleType } from '@noodle/core';

import { SITE } from '@/shared/net';

export type NavDecision =
  | { kind: 'allow' }
  /** Back to the app's own lists (the page's "← Puzzles" and similar). */
  | { kind: 'back' }
  /** Another puzzle (the finish sheet's Next row): open it in the app. */
  | { kind: 'play'; type: PuzzleType; file: string }
  /** Anything else: the phone's browser. */
  | { kind: 'external' };

const SLUG: [RegExp, PuzzleType][] = [
  [/crossword-mini|\bmini\b/, 'mini'],
  [/logic-doku|doku/, 'doku'],
  [/logic-sweep|sweep/i, 'sweep'],
  [/logic-path|\bpath\b/, 'path'],
  [/word-link/, 'link'],
  [/word-tangle/, 'tangle'],
  [/geo-borders/, 'borders'],
  [/quiz-reckon/, 'reckon'],
];

/** A puzzle page's type from its file name ("2026-10-24-crossword-mini-0105" → mini). */
export function typeOfFile(file: string): PuzzleType | null {
  for (const [re, type] of SLUG) if (re.test(file)) return type;
  return null;
}

/** What to do when the page wants to go to `url`, while showing puzzle `current`. */
export function decide(url: string, current: string): NavDecision {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { kind: 'allow' };
  }
  if (u.protocol === 'about:' || u.protocol === 'data:' || u.protocol === 'blob:')
    return { kind: 'allow' };
  if (u.origin !== SITE) return { kind: 'external' };
  const p = u.pathname;
  const m = /^\/reports\/([^/]+)\.html$/.exec(p);
  if (m) {
    const file = decodeURIComponent(m[1]!);
    if (file === current) return { kind: 'allow' };
    const type = typeOfFile(file);
    return type ? { kind: 'play', type, file } : { kind: 'external' };
  }
  if (p === '/' || p === '/index.html' || p === '/puzzles.html') return { kind: 'back' };
  if (p === '/how-to-play.html' || p === '/privacy.html') return { kind: 'allow' };
  if (p.endsWith('.html') || p === '/board.html') return { kind: 'external' };
  return { kind: 'allow' };
}

/** The live page for a puzzle file, tagged as opened from the app. */
export function pageUrl(file: string): string {
  return `${SITE}/reports/${encodeURIComponent(file)}.html?via=app`;
}
