import { type AnyType } from '@noodle/core';
import { router } from 'expo-router';

import { fileOf } from './rounds';

export interface PuzzleRef {
  /** A daily type, or a Lab trial's (11 Nov 2026). */
  type: AnyType;
  /** The card's name ("Mini 105"). */
  name: string;
  path: string;
}

/** How a puzzle's route is opened: pushed above the list (cards), or swapped in (a player). */
export type Opener = (href: {
  pathname: '/play/[type]/[file]';
  params: { type: AnyType; file: string };
}) => void;

/** When the last card push went out, and where to: a double tap must not open two copies. */
let lastPush = { at: -Infinity, file: '' };
/** How long a second tap on the same card is taken as the same tap. */
export const DOUBLE_TAP_MS = 800;

/**
 * A card's push, once per tap: a second tap on the same card while the first is still
 * opening is dropped. Two copies stacked meant the first Back closed the top one and left
 * the one under it unable to leave (Alec, 10 Nov 2026: Sweep's Back did nothing).
 */
const push: Opener = (href) => {
  const now = Date.now();
  const file = `${href.params.type}/${href.params.file}`;
  // (A clock set back since the last push is not a double tap.)
  if (file === lastPush.file && now >= lastPush.at && now - lastPush.at < DOUBLE_TAP_MS) return;
  lastPush = { at: now, file };
  router.push(href);
};

/** A card's push from outside a card list (a league board's "Play …"), with the same guard. */
export const pushPuzzle: Opener = (href) => push(href);

/**
 * Opens a puzzle from its card (pushed), or from a player's Play more (`open` swaps it in).
 * Every puzzle keeps its own part-played round (22 Nov 2026, Alec: the "Only one Tally can
 * be part-played at a time" question came up too often), so opening one never replaces
 * another's and nothing is asked first (AF-020's question is gone).
 */
export function openPuzzle(target: PuzzleRef, open: Opener = push) {
  open({
    pathname: '/play/[type]/[file]',
    params: { type: target.type, file: fileOf(target.path) },
  });
}
