import type { SaveStore } from '@noodle/core';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useHapticDiff } from '@/shared/haptics';
import { announceFinish, usePuzzleVisit } from '@/shared/results';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import { commitFinish, ensureStreak, reopenInfo, type FinishInfo } from '../finishing';
import {
  apply,
  init,
  message,
  recordSeconds,
  restore,
  SAVE_KEY,
  timerText,
  type DokuData,
  type DokuState,
  type Move,
} from '../model';
import { dokuFeel } from './feel';

export type Phase = 'start' | 'play' | 'finished';

/** How long the solved board shows before the finish sheet rises (the page waits 1.45 s). */
export const SHEET_DELAY_MS = 1450;

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  now?: () => number;
}

/**
 * One Doku being played: the model's state, the clock, the start card, and the finish.
 * Opening it seeds Doku's own streak from its results if it has none yet, as the
 * page's load does, so the start card shows the rebuilt run. The clock ticks once a
 * second from the first tile placed or the first delete, as the page's does (Play
 * only shows the board). On the solve the result is saved (first result kept), the
 * streak bumped, and the finish announced on the results bus with the tracker's
 * detail. A puzzle already finished opens on its finish sheet with the original time
 * and never announces again.
 */
export function useDokuGame(file: PuzzleFile<DokuData>, deps: Deps = {}) {
  const store = deps.store ?? appStorage;
  const saves = deps.saves ?? appSaves;
  const now = deps.now ?? Date.now;
  const id = file.data.id;

  // Before the first paint (not during render: other screens listen to these keys).
  useLayoutEffect(() => ensureStreak(store), [store]);

  const [opened] = useState(() => {
    const rec = saves.getDone(SAVE_KEY, id);
    return rec
      ? { state: restore(file.data), info: reopenInfo(id, rec, store), secs: recordSeconds(rec) }
      : null;
  });
  const [state, setState] = useState<DokuState>(() => opened?.state ?? init(file.data));
  const [phase, setPhase] = useState<Phase>(opened ? 'finished' : 'start');
  const [info, setInfo] = useState<FinishInfo | null>(opened?.info ?? null);
  const [secs, setSecs] = useState(0);
  useHapticDiff(state, dokuFeel);

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
    if (f.first) announceFinish({ path: file.path, type: 'doku', detail: f.detail });
    setInfo(f);
  }, [state, secs, saves, store, now, file.path]);

  useEffect(() => {
    if (!info || phase !== 'play') return;
    const t = setTimeout(() => setPhase('finished'), SHEET_DELAY_MS);
    return () => clearTimeout(t);
  }, [info, phase]);

  const dispatch = useCallback((m: Move) => setState((s) => apply(s, m)), []);
  /** What the phone's keyboard sends: letters, space, or several at once (the page's feed). */
  const feed = useCallback(
    (text: string) => {
      for (const ch of text) {
        if (/[a-z]/i.test(ch)) dispatch({ t: 'key', ch });
        else if (ch === ' ') dispatch({ t: 'space' });
      }
    },
    [dispatch],
  );
  // Play on the start card is the page's start (a tap in its play area).
  const start = usePuzzleVisit(file.path, 'doku', !!opened);
  const play = useCallback(() => {
    start();
    setPhase('play');
  }, [start]);
  const clock = timerText(opened ? opened.secs : secs);

  return { state, phase, info, clock, msg: message(state, clock), dispatch, feed, play };
}
