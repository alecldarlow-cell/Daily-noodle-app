import { londonDay, saveKey, type PuzzleType, type TodayItem } from '@noodle/core';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { BackHandler } from 'react-native';

import { LAST_FEED_KEY, parseFeedLite } from '@/shared/feed';
import {
  heldElsewhere,
  openPuzzle,
  PROGRESS_TYPES,
  progressKey,
  type Opener,
  type ProgressType,
} from '@/shared/played';
import { appStorage } from '@/shared/storage';
import { cachedToday } from '@/shared/today';

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

function parsed(key: string): unknown {
  try {
    return JSON.parse(appStorage.getItem(key) ?? 'null') as unknown;
  } catch {
    return null;
  }
}

/**
 * The puzzle whose kept round opening `item` would replace, as Today's and the Archive's
 * cards ask (usePlayed's `held`): null when none; else its card's name and path when the
 * kept feed-lite or today's list knows it, as Today names it, or {} ("Your other Doku").
 */
function heldBy(item: TodayItem): { name?: string; path?: string } | null {
  const type: PuzzleType = item.type;
  const grid = (PROGRESS_TYPES as readonly string[]).includes(type);
  const slot = grid ? parsed(progressKey(type as ProgressType)) : null;
  const other = heldElsewhere(type, item.id, parsed(saveKey(type)), slot);
  if (!other) return null;
  let card: { headline: string; path: string } | undefined;
  try {
    card = parseFeedLite(parsed(LAST_FEED_KEY)).items.find((c) => c.id === other);
  } catch {
    card = undefined;
  }
  if (card) return { name: card.headline, path: card.path };
  const it = cachedToday(londonDay())?.items.find((x) => x.id === other);
  return it ? { name: it.name, path: it.path } : {};
}

/**
 * How a player leaves, once. Back closes the puzzle, but a second Back (a double tap on the
 * bar's arrow, or Android's Back pressed again while the screen slides away) would reach the
 * tab bar under it, whose Back goes to the first tab: a puzzle opened from Archive landed on
 * Today. So the first exit wins: later taps on the screen's own Back or Next do nothing, and
 * Android's Back is swallowed until the screen has gone. Once it has, Back is the tabs' own
 * again (Archive, Leagues and Account go to Today first, then leave the app).
 *
 * Nothing above a player is ever pushed, so a hardware Back while it is mounted is always
 * this screen leaving (an open Modal takes Back itself and never reaches here).
 */
export function usePlayerExit(): PlayerExit {
  const leaving = useRef(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
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
      // As a card does (AF-020): when another puzzle of the type holds its one kept round,
      // ask before replacing it. `leaving` is set only when the screen really goes, so a
      // Cancel leaves Back working.
      const go: Opener = (href) => {
        if (leaving.current) return;
        leaving.current = true;
        router.replace(href);
      };
      openPuzzle({ type: item.type, name: item.name, path: item.path }, heldBy(item), go);
    },
    [back],
  );

  return useMemo(() => ({ back, next }), [back, next]);
}
