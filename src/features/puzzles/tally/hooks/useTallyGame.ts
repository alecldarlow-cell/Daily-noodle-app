import type { SaveStore } from '@noodle/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useHapticDiff } from '@/shared/haptics';
import { announceFinish, usePuzzleVisit } from '@/shared/results';
import { usePuzzleClock } from '@/shared/start-card';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import {
  commitFinish,
  liveStreak,
  recordTime,
  reopenInfo,
  restoreCur,
  saveCur,
  type FinishInfo,
} from '../finishing';
import {
  apply,
  init,
  restoreDone,
  SAVE_KEY,
  timerText,
  type Move,
  type TallyData,
  type TallyState,
} from '../model';
import { tallyFeel } from './feel';

export type Phase = 'start' | 'play' | 'finished';

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  now?: () => number;
}

/**
 * One Tally being played: the model's state, the clock, the start card and the finish.
 * The clock starts on Play, or on the first tap if Play was somehow skipped, and stops
 * while the app is away. A round is kept in `digi-tally-v1.cur` as the page keeps it, so
 * it carries across the website and the app; it opens again on its board at its time. The
 * finish saves the result, bumps the streak and goes straight to the sheet, as the page does.
 */
export function useTallyGame(file: PuzzleFile<TallyData>, deps: Deps = {}) {
  const store = deps.store ?? appStorage;
  const saves = deps.saves ?? appSaves;
  const now = deps.now ?? Date.now;
  const id = file.data.id;

  const [opened] = useState(() => {
    const rec = saves.getDone(SAVE_KEY, id);
    const t = now();
    return {
      streak: liveStreak(store, t),
      done: rec
        ? {
            state: restoreDone(file.data),
            info: reopenInfo(id, rec, store, t),
            time: recordTime(rec),
          }
        : null,
      resumed: rec ? null : restoreCur(store, file.data),
    };
  });
  const { resumed } = opened;
  const [state, setState] = useState<TallyState>(
    () => opened.done?.state ?? resumed?.state ?? init(file.data),
  );
  const [phase, setPhase] = useState<Phase>(opened.done ? 'finished' : resumed ? 'play' : 'start');
  const [info, setInfo] = useState<FinishInfo | null>(opened.done?.info ?? null);
  const [streak, setStreak] = useState(opened.streak);
  const [begun, setBegun] = useState(!!resumed);
  useHapticDiff(state, tallyFeel);

  const { secs, read } = usePuzzleClock(begun && !state.solved, { now, initial: resumed?.secs });
  const [endSecs, setEndSecs] = useState<number | null>(null);

  const finished = useRef(!!opened.done);
  useEffect(() => {
    if (!state.solved || finished.current) return;
    finished.current = true;
    const clock = read();
    setEndSecs(clock);
    const f = commitFinish(state, clock, !!resumed, saves, store, now());
    if (f.first) announceFinish({ path: file.path, type: 'tally', detail: f.detail });
    setStreak(f.streak);
    setInfo(f);
    setPhase('finished');
  }, [state, read, saves, store, now, file.path, resumed]);

  // The round is written after each change, when the app goes away, and on leaving.
  const keep = useRef(() => {});
  const saved = useRef<TallyState | null>(null);
  useEffect(() => {
    keep.current = () => {
      if (!finished.current && begun) saveCur(store, state, read(), saves, now());
    };
    // Only a change to the board is written: a selection moving is not.
    if (state.g !== saved.current?.g || state.notes !== saved.current?.notes) keep.current();
    saved.current = state;
  }, [state, begun, read, saves, store, now]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') keep.current();
    });
    return () => {
      sub?.remove();
      keep.current();
    };
  }, []);

  const dispatch = useCallback((m: Move) => {
    // A tap on a square starts the clock if Play somehow didn't, as the page's does.
    if (m.t === 'cell') setBegun(true);
    setState((s) => apply(s, m));
  }, []);

  const start = usePuzzleVisit(file.path, 'tally', !!opened.done || !!resumed);
  const play = useCallback(() => {
    start();
    setBegun(true);
    setPhase('play');
  }, [start]);

  return {
    state,
    phase,
    info,
    streak,
    clock: opened.done ? opened.done.time : timerText(endSecs ?? secs),
    dispatch,
    play,
  };
}
