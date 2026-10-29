import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSaveStore } from '@noodle/core';

import { createCachedStorage } from './cachedStorage';

/**
 * Keys that only cache what the site can send again (a puzzle's data, Today's list, the
 * feed, when sync last ran, a dismissed prompt, the visit clock). A failed write to one of
 * these is dropped rather than retried and never raises the "Couldn't save" notice. Every
 * other key (results, streaks, rounds in progress, the league identity) is critical.
 */
export function isDisposableKey(key: string): boolean {
  return (
    key.startsWith('noodle-app-puzzle:') ||
    key === 'noodle-app-today' ||
    key === 'noodle-app-feed-lite' ||
    key === 'noodle-app-sync' ||
    key === 'noodle-board-pinlater' ||
    key === 'digi.sid' ||
    key === 'digi.last'
  );
}

/** The one store for the app, shared by every feature. */
export const appStorage = createCachedStorage(AsyncStorage, {
  isDisposable: isDisposableKey,
  onWriteError: (key, error) => console.warn(`Couldn't save ${key}`, error),
});

/** The site's save rules (first result kept, merges, notices) over the app's store. */
export const saves = createSaveStore(appStorage);
