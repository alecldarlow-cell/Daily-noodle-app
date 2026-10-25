import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The last answer the phone gave, so a screen opened later knows at once. */
let known: boolean | null = null;

/**
 * The phone's Reduce motion setting (iOS Reduce Motion, Android Remove animations),
 * kept up to date while the screen is open. `null` until the phone has answered.
 */
export function useReduceMotion(): boolean | null {
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

/** Tests only: forget the phone's last answer. */
export function forgetReduceMotion(): void {
  known = null;
}
