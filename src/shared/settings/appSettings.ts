/**
 * The app-wide switches on Account (tracker AF-012): Vibration and Animations, for every
 * puzzle. Kept under their own new key, `noodle-app-settings`, which sync and the
 * personal link leave out (they skip `noodle-app-*`), so a choice stays on this phone.
 * No puzzle's own saved setting is read or changed: Reckon's `hap` stays in its save,
 * unread, so this one switch rules.
 */
import { useSyncExternalStore } from 'react';

import { appStorage, type CachedStorage } from '@/shared/storage';

export const APP_SETTINGS_KEY = 'noodle-app-settings';

/** Animations: follow the phone's own setting, or always reduced. */
export type MotionChoice = 'phone' | 'reduced';

export interface AppSettings {
  /** Haptic buzzes on taps, wrong answers and wins. On unless switched off. */
  vibration: boolean;
  motion: MotionChoice;
}

export const DEFAULT_SETTINGS: AppSettings = { vibration: true, motion: 'phone' };

/** The settings saved at `raw`, any missing or unreadable part taking its default. */
export function parseSettings(raw: string | null): AppSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof AppSettings, unknown>> | null;
    return {
      vibration: o?.vibration === false ? false : true,
      motion: o?.motion === 'reduced' ? 'reduced' : 'phone',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function readSettings(store: CachedStorage = appStorage): AppSettings {
  return parseSettings(store.getItem(APP_SETTINGS_KEY));
}

/** Change one or both switches; the rest stays as saved. */
export function saveSettings(
  patch: Partial<AppSettings>,
  store: CachedStorage = appStorage,
): AppSettings {
  const next = { ...readSettings(store), ...patch };
  store.setItem(APP_SETTINGS_KEY, JSON.stringify({ v: 1, ...next }));
  return next;
}

/** The switches, re-rendering when either changes. */
export function useAppSettings(store: CachedStorage = appStorage): AppSettings {
  const raw = useSyncExternalStore(
    (fn) => store.subscribe(APP_SETTINGS_KEY, fn),
    () => store.getItem(APP_SETTINGS_KEY),
  );
  return parseSettings(raw);
}
