import { TYPE_LABEL, type PuzzleType } from '@noodle/core';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

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

const push: Opener = (href) => router.push(href);

/**
 * Opens a puzzle from its card (pushed), or from a player's Play more (`open` swaps it in).
 * When another puzzle of the type holds the type's one kept round (`held`: its name and
 * path when the list knows it), asks first, since playing this one replaces that round
 * (AF-020): Cancel, go to the other one, or start this one.
 */
export function openPuzzle(
  target: PuzzleRef,
  held: { name?: string; path?: string } | null,
  open: Opener = push,
) {
  const go = (type: PuzzleType, path: string) =>
    open({ pathname: '/play/[type]/[file]', params: { type, file: fileOf(path) } });
  if (!held) {
    go(target.type, target.path);
    return;
  }
  const label = TYPE_LABEL[target.type];
  const other = held.name ?? `Your other ${label}`;
  const buttons: AlertButton[] = [{ text: 'Cancel', style: 'cancel' }];
  if (held.name && held.path) {
    const path = held.path;
    buttons.push({ text: `Go to ${held.name}`, onPress: () => go(target.type, path) });
  }
  buttons.push({
    text: `Start ${target.name}`,
    style: 'destructive',
    onPress: () => go(target.type, target.path),
  });
  Alert.alert(
    `Replace your ${label} in progress?`,
    `${other} is part-way. One ${label} round is kept at a time, so playing ${target.name} replaces it.`,
    buttons,
    { cancelable: true },
  );
}
