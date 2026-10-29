/**
 * Haptics for the native players (WP12): a light tap when a letter or tile goes down
 * or a word goes in, a success when a puzzle is solved or finished, an error buzz on a
 * wrong check, a mine or a failed guess. Through expo-haptics (ADR-006). In tests the
 * native module is jest-expo's mock, so every call is a no-op there.
 *
 * Screens and hooks call this; puzzle models never do (they are proved identical to
 * the website by replay, and know nothing of the phone).
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { readSettings } from '@/shared/settings';

export type Buzz = 'tap' | 'success' | 'error';

/**
 * The app's one Vibration switch (Account › Settings, tracker AF-012), on by default.
 * Every buzz in the app comes through `buzz`, so this gates them all. No puzzle's own
 * saved setting is read: one switch rules.
 */
export function hapticsOn(): boolean {
  return readSettings().vibration;
}

const ANDROID: Record<Buzz, Haptics.AndroidHaptics> = {
  tap: Haptics.AndroidHaptics.Keyboard_Tap,
  success: Haptics.AndroidHaptics.Confirm,
  error: Haptics.AndroidHaptics.Reject,
};

/** Feel one buzz, unless the app's switch (or the caller) says no. Never throws. */
export function buzz(kind: Buzz | null | undefined, allowed = true): void {
  if (!kind || !allowed || !hapticsOn()) return;
  try {
    // Android: the system's own haptic effects (the SDK 58 docs advise them over the
    // Vibrator that impactAsync / notificationAsync simulate there).
    const p =
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(ANDROID[kind])
        : kind === 'tap'
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          : Haptics.notificationAsync(
              kind === 'success'
                ? Haptics.NotificationFeedbackType.Success
                : Haptics.NotificationFeedbackType.Error,
            );
    void Promise.resolve(p).catch(() => undefined);
  } catch {
    // A phone without a haptic engine: nothing to feel.
  }
}

/**
 * Buzz on what changed between one state and the next, as `classify` reads it (pure:
 * the type's own rule, e.g. "a bad mark appeared" → 'error'). The state a screen opens
 * with never buzzes, so a finished puzzle reopened is silent.
 */
export function useHapticDiff<S>(
  state: S,
  classify: (prev: S, next: S) => Buzz | null,
  allowed = true,
): void {
  const prev = useRef(state);
  useEffect(() => {
    const was = prev.current;
    prev.current = state;
    if (was === state) return;
    buzz(classify(was, state), allowed);
  }, [state, classify, allowed]);
}

/** The strongest of several: success over error over tap. */
export function strongest(...kinds: (Buzz | null | false | undefined)[]): Buzz | null {
  for (const k of ['success', 'error', 'tap'] as const) if (kinds.includes(k)) return k;
  return null;
}
