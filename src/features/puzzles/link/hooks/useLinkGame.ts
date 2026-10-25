import type { SaveStore } from '@noodle/core';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useHapticDiff } from '@/shared/haptics';
import { announceFinish, usePuzzleVisit } from '@/shared/results';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import type { LinkData } from '../model';
import { linkFeel } from './feel';
import { LinkGame, type ScreenMove } from './linkGame';

export type { Phase, ScreenMove } from './linkGame';

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  now?: () => number;
  random?: () => number;
  /** The phone asks for reduced motion (read from the system when not given). */
  reduced?: boolean;
}

/** A Link on screen: the game (linkGame.ts) on the real clock, repainted as it changes. */
export function useLinkGame(file: PuzzleFile<LinkData>, deps: Deps = {}) {
  const [game] = useState(
    () =>
      new LinkGame(file, {
        store: deps.store ?? appStorage,
        saves: deps.saves ?? appSaves,
        now: deps.now ?? Date.now,
        random: deps.random ?? Math.random,
        announce: (f) => announceFinish({ path: file.path, type: 'link', detail: f.detail }),
      }),
  );
  useSyncExternalStore(game.subscribe, game.getVersion);
  useHapticDiff(game.state, linkFeel);

  const reduced = deps.reduced;
  useEffect(() => {
    if (reduced !== undefined) {
      game.setReduced(reduced);
      return;
    }
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => {
        if (on) game.setReduced(r);
      })
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [game, reduced]);
  useEffect(() => () => game.dispose(), [game]);

  // The page repaints its clock every 250 ms while it runs.
  const running = game.state.timer === 'running';
  useEffect(() => {
    if (!running) return;
    const h = setInterval(game.poke, 250);
    return () => clearInterval(h);
  }, [game, running]);

  const dispatch = useCallback((m: ScreenMove) => game.dispatch(m), [game]);
  // Play on the start card is the page's start; a finished Link reopened is not.
  const [doneAtOpen] = useState(() => game.phase === 'finished');
  const start = usePuzzleVisit(file.path, 'link', doneAtOpen);
  const play = useCallback(() => {
    start();
    game.play();
  }, [game, start]);
  return {
    state: game.state,
    phase: game.phase,
    info: game.info,
    clock: game.clock(),
    dispatch,
    play,
  };
}
