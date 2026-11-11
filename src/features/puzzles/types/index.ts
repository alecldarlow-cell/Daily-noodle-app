import type { AnyType } from '@noodle/core';

/** reports/<page>.json, published by the site since WP2 (tools/puzzle-json.js). */
export interface PuzzleFile<D = unknown> {
  id: string;
  /** A daily type, or a Lab trial's (11 Nov 2026). */
  type: AnyType;
  date: string;
  band: string;
  n: number | null;
  name: string;
  headline: string;
  standfirst: string;
  read: string;
  /** "reports/<page>.html": how the site and leagues name the puzzle. */
  path: string;
  /** The page's window.DN_PUZZLE, verbatim. */
  data: D;
}
