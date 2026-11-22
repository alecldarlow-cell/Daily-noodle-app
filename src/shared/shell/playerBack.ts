import { type TodayItem } from '@noodle/core';
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { BackHandler } from 'react-native';

import { openPuzzle, type Opener } from '@/shared/played';

export interface PlayerExit {
  /** Leave the puzzle for the screen underneath it (Today when it was opened cold). */
  back: () => void;
  /** Swap the puzzle for the next one, or leave when there is none. */
  next: (item: TodayItem | null) => void;
}

/** A puzzle's route params from its feed path: `reports/mini-100.html` → `mini-100`. */
export function fileOf(path: string): string {
  return path.replace(/^reports\//, '').replace(/\.html$/, '');
}

/**
 * How a player leaves, once. Back closes the puzzle, but a second Back (a double tap on the
 * bar's arrow, or Android's Back pressed again while the screen slides away) would reach the
 * tab bar under it, whose Back goes to the first tab: a puzzle opened from Archive landed on
 * Today. So the first exit wins: later taps on the screen's own Back or Next do nothing, and
 * Android's Back is swallowed until the screen has gone. Once it has, Back is the tabs' own
 * again (Archive, Leagues and Account go to Today first, then leave the app).
 *
 * Android's Back counts only while this player is the screen on show. A screen can sit above
 * a player (the finish page's How to play), or a second player can (a card tapped twice),
 * and their Back used to trip this one's latch too: once back on it, its Back and Android's
 * did nothing (Alec, 10 Nov 2026). Under another screen, Back is that screen's, untouched.
 * An open Modal takes Back itself and never reaches here.
 */
export function usePlayerExit(): PlayerExit {
  const leaving = useRef(false);
  const focused = useIsFocused();
  const onShow = useRef(focused);
  useEffect(() => {
    onShow.current = focused;
  }, [focused]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!onShow.current) return false;
      if (leaving.current) return true;
      leaving.current = true;
      return false;
    });
    return () => sub.remove();
  }, []);

  const back = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const next = useCallback(
    (item: TodayItem | null) => {
      if (!item) return back();
      if (leaving.current) return;
      // Every puzzle keeps its own round (22 Nov 2026), so nothing is asked first.
      // `leaving` is set only when the screen really goes.
      const go: Opener = (href) => {
        if (leaving.current) return;
        leaving.current = true;
        router.replace(href);
      };
      openPuzzle({ type: item.type, name: item.name, path: item.path }, go);
    },
    [back],
  );

  return useMemo(() => ({ back, next }), [back, next]);
}
