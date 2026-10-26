import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Say a line of in-play feedback to a screen reader when it changes ("One away", a
 * verdict, a toast). Android reads it from the text's `accessibilityLiveRegion`; iOS has
 * no live regions, so there it is announced. `key` tells a repeat of the same words
 * apart (a second "Not a group"); it defaults to the words. Nothing is said for an empty
 * line, or for the line already showing when the board opens.
 */
export function useAnnounce(text: string, key: string | number = text) {
  const last = useRef(key);
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    if (text && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [text, key]);
}
