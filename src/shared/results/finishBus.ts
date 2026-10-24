/**
 * "A puzzle just finished": announced by whatever played it (the WebView bridge now,
 * native players from WP8) and heard by whoever cares (leagues submit results, WP5).
 * Lets features react to a finish without importing one another.
 */
import type { PuzzleType } from '@noodle/core';

export interface PuzzleFinish {
  /** The puzzle page's path, as the site and leagues name puzzles: "reports/<file>.html". */
  path: string;
  type: PuzzleType | null;
  /**
   * The site's `dn:puzzle_end` detail: {type (site slug, e.g. "crossword-mini"), tv,
   * outcome: solved|failed|revealed|scored, secs, checks, reveals, hints, score?, got?,
   * of?, words?, mistakes?, bulls?, zones?}. Native players send the same fields.
   */
  detail: Record<string, unknown>;
}

type Listener = (f: PuzzleFinish) => void;
const listeners = new Set<Listener>();

export function announceFinish(f: PuzzleFinish): void {
  for (const fn of [...listeners]) {
    try {
      fn(f);
    } catch (e) {
      console.warn('A finish listener failed', e);
    }
  }
}

export function onFinish(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
