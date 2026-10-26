import type { PuzzleType } from '@noodle/core';

import { SITE } from '@/shared/net';

export type NavDecision =
  | { kind: 'allow' }
  /** Back to the app's own lists (the page's "← Puzzles" and similar). */
  | { kind: 'back' }
  /** Another puzzle (the finish sheet's Next row): open it in the app. */
  | { kind: 'play'; type: PuzzleType; file: string }
  /** The board ("See today's board"): the Leagues tab, on board.html's puzzle and day. */
  | { kind: 'leagues'; params: { p?: string; d?: string; join?: string } }
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
  if (p === '/board.html') {
    // A personal link (#dnmove=) is for a browser to import; it stays in the browser.
    if (/dnmove=/.test(u.hash)) return { kind: 'external' };
    const params: { p?: string; d?: string; join?: string } = {};
    for (const k of ['p', 'd', 'join'] as const) {
      const v = u.searchParams.get(k);
      if (v) params[k] = v;
    }
    return { kind: 'leagues', params };
  }
  // The app's invite link (SITE.md › App links): the league's invite, as board.html?join=.
  if (p === '/join.html') {
    const c = u.searchParams.get('c');
    return { kind: 'leagues', params: c ? { join: c } : {} };
  }
  if (p.endsWith('.html')) return { kind: 'external' };
  return { kind: 'allow' };
}

/** The live page for a puzzle file, tagged as opened from the app. */
export function pageUrl(file: string): string {
  return `${SITE}/reports/${encodeURIComponent(file)}.html?via=app`;
}

/**
 * Where the app goes for a link the phone hands it (expo-router's +native-intent).
 * Android opens the site's invite links, https://dailynoodle.co.uk/join.html?c=CODE, in the
 * app (app.json intentFilters); they go to that league's invite on the Leagues tab. Anything
 * else (dailynoodle://auth, the app's own routes) is left to the router as it came.
 */
export function systemPath(path: string): string {
  let u: URL;
  try {
    u = new URL(path, SITE);
  } catch {
    return path;
  }
  if (u.origin !== SITE || u.pathname !== '/join.html') return path;
  const c = (u.searchParams.get('c') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{4,12}$/.test(c) ? `/leagues?join=${c}` : '/leagues';
}
