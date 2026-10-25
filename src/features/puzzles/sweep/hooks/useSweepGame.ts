import type { SaveStore } from '@noodle/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useHapticDiff } from '@/shared/haptics';
import { announceFinish, usePuzzleVisit } from '@/shared/results';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import { commitFinish, isRanked, reopenInfo, type FinishInfo } from '../finishing';
import {
  apply,
  init,
  MARK_MS,
  restore,
  SAVE_KEY,
  timerText,
  unmark,
  type Move,
  type SweepData,
  type SweepState,
} from '../model';
import { SHEET_DELAY_MS } from '../simulate';
import { sweepFeel } from './feel';

export type Phase = 'start' | 'play' | 'finished';

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  now?: () => number;
}

/**
 * One Sweep being played: the model's state, the clock, the start card and the finish.
 * The clock ticks once a second from digging the start square, as the page's does, and
 * stops when the round ends. A mine ends it at once (the result saved, the streak reset
 * to 0); a cleared board shows for 1.45 s before the sheet rises. Play again after a
 * mine starts a replay that records nothing, as on the page. The first finish is
 * announced on the results bus with the tracker's detail; a reopened puzzle shows its
 * sheet and never announces again.
 */
export function useSweepGame(file: PuzzleFile<SweepData>, deps: Deps = {}) {
  const store = deps.store ?? appStorage;
  const saves = deps.saves ?? appSaves;
  const now = deps.now ?? Date.now;
  const id = file.data.id;

  const [opened] = useState(() => {
    const ranked = isRanked(store, now());
    const rec = saves.getDone(SAVE_KEY, id);
    const back = rec ? restore(file.data, rec, ranked) : null;
    const gave = !!back && !back.won && back.boomed.size === 0;
    return {
      rec,
      gave,
      state: back ?? init(file.data, { ranked, done: !!rec }),
      info: back && !gave ? reopenInfo(back, store) : null,
    };
  });
  const [state, setState] = useState<SweepState>(opened.state);
  // A saved result opens on its sheet (a "gave" result on its board, as the page shows it);
  // one the page won't reopen plays again with no start card.
  const [phase, setPhase] = useState<Phase>(
    opened.rec ? (opened.info ? 'finished' : 'play') : 'start',
  );
  const [info, setInfo] = useState<FinishInfo | null>(opened.info);
  const [secs, setSecs] = useState(0);
  useHapticDiff(state, sweepFeel);

  const running = state.started && !state.over;
  useEffect(() => {
    if (!running) return;
    const h = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(h);
  }, [running, state.round]);

  // Hint's mark fades after 2.4 s
  const mark = state.mark;
  useEffect(() => {
    if (!mark) return;
    const t = setTimeout(() => setState((s) => unmark(s, mark.n)), MARK_MS);
    return () => clearTimeout(t);
  }, [mark]);

  const announced = useRef(!!opened.rec);
  const ended = useRef<number>(opened.state.over ? opened.state.round : 0);
  useEffect(() => {
    if (!state.over || ended.current === state.round) return;
    ended.current = state.round;
    const f = commitFinish(state, saves, store, now());
    if (f.first && !announced.current)
      announceFinish({ path: file.path, type: 'sweep', detail: f.detail });
    announced.current = true;
    setInfo(f);
  }, [state, saves, store, now, file.path]);

  useEffect(() => {
    if (!info || phase !== 'play' || !state.over) return;
    const t = setTimeout(() => setPhase('finished'), state.won ? SHEET_DELAY_MS : 0);
    return () => clearTimeout(t);
  }, [info, phase, state.over, state.won]);

  const secsRef = useRef(secs);
  useEffect(() => {
    secsRef.current = secs;
  }, [secs]);
  const dispatch = useCallback(
    (m: Move) => setState((s) => apply(s, m, { secs: secsRef.current })),
    [],
  );
  // Play on the start card is the page's start; a finished puzzle reopened is not.
  const start = usePuzzleVisit(file.path, 'sweep', !!opened.rec);
  const play = useCallback(() => {
    start();
    setPhase('play');
  }, [start]);
  /** The sheet's "Play again (not recorded)": a fresh board, the clock back at zero. */
  const again = useCallback(() => {
    setSecs(0);
    setInfo(null);
    setState((s) => apply(s, { t: 'again' }, { ranked: isRanked(store, now()) }));
    setPhase('play');
  }, [store, now]);

  return {
    state,
    phase,
    info,
    clock: timerText(state.over ? state.endSecs : state.started ? secs : 0),
    dispatch,
    play,
    again,
  };
}
