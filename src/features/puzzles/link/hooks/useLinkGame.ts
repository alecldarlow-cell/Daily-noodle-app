import type { SaveStore } from '@noodle/core';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useHapticDiff } from '@/shared/haptics';
import { useReduceMotion } from '@/shared/motion';
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
  /** Reduced motion asked for (else the app's switch or the phone's setting). */
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

  // The app's Animations switch, else the phone's setting (AF-012), kept up to date.
  const system = useReduceMotion();
  const reduced = deps.reduced ?? system;
  useEffect(() => {
    if (reduced !== null) game.setReduced(reduced);
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
    past: game.past,
    clock: game.clock(),
    dispatch,
    play,
  };
}
