import { dateOfPath, londonDay, TYPE_LABEL, type PuzzleType } from '@noodle/core';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import { shortDate } from '@/shared/time';

import { fileOf } from './rounds';

export interface PuzzleRef {
  type: PuzzleType;
  /** The card's name ("Mini 105"). */
  name: string;
  path: string;
}

/** How a puzzle's route is opened: pushed above the list (cards), or swapped in (a player). */
export type Opener = (href: {
  pathname: '/play/[type]/[file]';
  params: { type: PuzzleType; file: string };
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

/** A puzzle's day as the question says it: "today", "yesterday" or "Tue 3 Nov" ('' unknown). */
export function dayWord(path: string | undefined, today: string): string {
  const d = dateOfPath(path);
  if (!d) return '';
  if (d === today) return 'today';
  const y = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return d === y ? 'yesterday' : shortDate(d);
}

/**
 * Opens a puzzle from its card (pushed), or from a player's Play more (`open` swaps it in).
 * When another puzzle of the type holds the type's one kept round (`held`: its name and
 * path when the list knows it), asks first, since playing this one replaces that round
 * (AF-020): Cancel, carry on with the other one, or start this one instead. Both are
 * named with their day, and each button says what it does, as "Go to Link 87" and
 * "Start Link 93" were easy to mix up (Alec, 9 Nov 2026).
 */
export function openPuzzle(
  target: PuzzleRef,
  held: { name?: string; path?: string } | null,
  open: Opener = push,
  today: string = londonDay(Date.now()),
) {
  const go = (type: PuzzleType, path: string) =>
    open({ pathname: '/play/[type]/[file]', params: { type, file: fileOf(path) } });
  if (!held) {
    go(target.type, target.path);
    return;
  }
  const label = TYPE_LABEL[target.type];
  const when = (path: string | undefined) => {
    const w = dayWord(path, today);
    return w ? ` (${w})` : '';
  };
  const buttons: AlertButton[] = [{ text: 'Cancel', style: 'cancel' }];
  if (held.name && held.path) {
    const path = held.path;
    buttons.push({ text: `Carry on with ${held.name}`, onPress: () => go(target.type, path) });
  }
  buttons.push({
    text: `Start ${target.name} instead`,
    style: 'destructive',
    onPress: () => go(target.type, target.path),
  });
  const started = held.name
    ? `You started ${held.name}${when(held.path)} and haven’t finished it.`
    : `You have another ${label} part-played.`;
  const lose = held.name ? `your progress on ${held.name}` : 'its progress';
  Alert.alert(
    held.name ? `${held.name} isn’t finished` : `Another ${label} isn’t finished`,
    `${started} Only one ${label} can be part-played at a time, so starting ${target.name}${when(target.path)} loses ${lose}.`,
    buttons,
    { cancelable: true },
  );
}
