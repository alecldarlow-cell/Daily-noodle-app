import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useAppSettings } from '@/shared/settings';

/** The last answer the phone gave, so a screen opened later knows at once. */
let known: boolean | null = null;

/**
 * The phone's Reduce motion setting (iOS Reduce Motion, Android Remove animations),
 * kept up to date while the screen is open. `null` until the phone has answered.
 */
export function usePhoneReduceMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(known);
  useEffect(() => {
    let on = true;
    const set = (r: boolean) => {
      known = r;
      if (on) setReduced(r);
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then(set)
      .catch(() => set(false));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', set);
    return () => {
      on = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * Whether to keep motion down: true when the app's Animations switch (Account ›
 * Settings, tracker AF-012) says Reduced, else the phone's own setting. `null` while
 * following the phone and it hasn't answered yet. Every animation in the app asks this.
 */
export function useReduceMotion(): boolean | null {
  const phone = usePhoneReduceMotion();
  const { motion } = useAppSettings();
  return motion === 'reduced' ? true : phone;
}

/** Tests only: forget the phone's last answer. */
export function forgetReduceMotion(): void {
  known = null;
}
