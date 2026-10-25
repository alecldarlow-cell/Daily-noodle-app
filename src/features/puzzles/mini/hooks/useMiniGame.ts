import type { SaveStore } from '@noodle/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useHapticDiff } from '@/shared/haptics';
import { announceFinish, usePuzzleVisit } from '@/shared/results';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import { commitFinish, reopenInfo, type FinishInfo } from '../finishing';
import {
  apply,
  clueBar,
  init,
  recordSeconds,
  restore,
  SAVE_KEY,
  timerText,
  type MiniData,
  type MiniState,
  type Move,
} from '../model';
import { miniFeel } from './feel';

export type Phase = 'start' | 'play' | 'finished';

/** How long the solved board shows before the finish sheet rises (the page waits 1.45 s). */
export const SHEET_DELAY_MS = 1450;

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  now?: () => number;
}

/**
 * One Mini being played: the model's state, the clock, the start card, and the finish.
 * The clock ticks once a second from the first letter, delete or reveal, as the page's
 * does (Play only shows the board; the start card says "The clock starts with your
 * first letter"). On the solve the result is saved (first result kept), the streak
 * bumped, and the finish announced on the results bus with the tracker's detail. A
 * puzzle already finished opens on its finish sheet with the original time and never
 * announces again.
 */
export function useMiniGame(file: PuzzleFile<MiniData>, deps: Deps = {}) {
  const store = deps.store ?? appStorage;
  const saves = deps.saves ?? appSaves;
  const now = deps.now ?? Date.now;
  const id = file.data.id;

  const [opened] = useState(() => {
    const rec = saves.getDone(SAVE_KEY, id);
    return rec
      ? { state: restore(file.data), info: reopenInfo(id, rec, store), secs: recordSeconds(rec) }
      : null;
  });
  const [state, setState] = useState<MiniState>(() => opened?.state ?? init(file.data));
  const [phase, setPhase] = useState<Phase>(opened ? 'finished' : 'start');
  const [info, setInfo] = useState<FinishInfo | null>(opened?.info ?? null);
  const [secs, setSecs] = useState(0);
  useHapticDiff(state, miniFeel);

  const running = state.started && !state.solved;
  useEffect(() => {
    if (!running) return;
    const h = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(h);
  }, [running]);

  const finished = useRef(!!opened);
  useEffect(() => {
    if (!state.solved || finished.current) return;
    finished.current = true;
    const f = commitFinish(state, secs, saves, store, now());
    if (f.first) announceFinish({ path: file.path, type: 'mini', detail: f.detail });
    setInfo(f);
  }, [state, secs, saves, store, now, file.path]);

  useEffect(() => {
    if (!info || phase !== 'play') return;
    const t = setTimeout(() => setPhase('finished'), SHEET_DELAY_MS);
    return () => clearTimeout(t);
  }, [info, phase]);

  const dispatch = useCallback((m: Move) => setState((s) => apply(s, m)), []);
  // Play on the start card is the page's start (a tap in its play area).
  const start = usePuzzleVisit(file.path, 'mini', !!opened);
  const play = useCallback(() => {
    start();
    setPhase('play');
  }, [start]);

  return {
    state,
    phase,
    info,
    bar: clueBar(state),
    clock: timerText(opened ? opened.secs : secs),
    dispatch,
    play,
  };
}
