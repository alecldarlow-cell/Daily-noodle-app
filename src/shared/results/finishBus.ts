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
  /** 'page' when the site's own page played it (its tracker has already recorded it). */
  source?: 'native' | 'page';
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

/**
 * A native puzzle opened ('open', the page's page_view) or begun ('start', the page's
 * puzzle_start: Play on the start card, never a finished puzzle reopened). The visit
 * recorder (shared/track) turns these into the website's events.
 */
export interface PuzzleVisit {
  ev: 'open' | 'start';
  path: string;
  type: PuzzleType | null;
}

type VisitListener = (v: PuzzleVisit) => void;
const visitListeners = new Set<VisitListener>();

export function announceVisit(v: PuzzleVisit): void {
  for (const fn of [...visitListeners]) {
    try {
      fn(v);
    } catch (e) {
      console.warn('A visit listener failed', e);
    }
  }
}

export function onVisit(fn: VisitListener): () => void {
  visitListeners.add(fn);
  return () => {
    visitListeners.delete(fn);
  };
}
