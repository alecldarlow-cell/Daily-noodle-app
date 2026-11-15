import type { SaveStore } from '@noodle/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useHapticDiff } from '@/shared/haptics';
import { useReduceMotion } from '@/shared/motion';
import { announceFinish, announceVisit } from '@/shared/results';
import { usePuzzleClock } from '@/shared/start-card';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import {
  commitFinish,
  playedCount,
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
  type TumblerData,
  type TumblerState,
} from '../model';
import { tumblerFeel } from './feel';

export type Phase = 'start' | 'play' | 'finished';

/** The site's slug for a Tumbler's events (dn-track.js PTYPE). */
export const SLUG = 'word-tumbler';

/** The win beat (engines/tumbler.js winBeat): the line's letters pop left to right, a hold. */
export const beatMs = (n: number) => 160 * (n - 1) + 600 + 350;

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  now?: () => number;
}

/**
 * One Tumbler being played: the model's state, the clock, the start card and the finish.
 * The clock starts on Play and stops while the app is away. A board is kept in
 * `digi-tumbler-v1.cur` as the page keeps it, so it carries across the website and the app.
 * The solving submit saves the result at once, the line's beat plays, then the sheet.
 * A Lab trial: its plays are recorded (open, start, end) but it has no league.
 */
export function useTumblerGame(file: PuzzleFile<TumblerData>, deps: Deps = {}) {
  const store = deps.store ?? appStorage;
  const saves = deps.saves ?? appSaves;
  const now = deps.now ?? Date.now;
  const id = file.data.id;
  const reduce = useReduceMotion();

  const [opened] = useState(() => {
    const rec = saves.getDone(SAVE_KEY, id);
    const t = now();
    return {
      played: playedCount(store),
      done: rec
        ? {
            state: restoreDone(file.data, rec.w),
            info: reopenInfo(file.data, rec, store, t),
            time: recordTime(rec),
          }
        : null,
      resumed: rec ? null : restoreCur(store, file.data),
    };
  });
  const { resumed } = opened;
  const [state, setState] = useState<TumblerState>(
    () => opened.done?.state ?? resumed?.state ?? init(file.data),
  );
  const [phase, setPhase] = useState<Phase>(opened.done ? 'finished' : 'start');
  const [info, setInfo] = useState<FinishInfo | null>(opened.done?.info ?? null);
  const [begun, setBegun] = useState(false);
  useHapticDiff(state, tumblerFeel);

  const { secs, readExact: read } = usePuzzleClock(begun && !state.solved, {
    now,
    initial: resumed?.secs,
  });
  const [endSecs, setEndSecs] = useState<number | null>(null);

  useEffect(() => {
    announceVisit({ ev: 'open', path: file.path, type: null, slug: SLUG });
  }, [file.path]);

  const finished = useRef(!!opened.done);
  useEffect(() => {
    if (!state.solved || finished.current) return;
    finished.current = true;
    const clock = read();
    setEndSecs(clock);
    const f = commitFinish(state, clock, !!resumed, saves, store, now());
    if (f.first) announceFinish({ path: file.path, type: null, detail: f.detail });
    setInfo(f);
  }, [state, read, saves, store, now, file.path, resumed]);

  // The sheet follows the line's beat; with reduced motion, straight away.
  useEffect(() => {
    if (!info || phase !== 'play') return;
    const t = setTimeout(() => setPhase('finished'), reduce === false ? beatMs(file.data.n) : 0);
    return () => clearTimeout(t);
  }, [info, phase, reduce, file.data.n]);

  // The board is written after each change, when the app goes away, and on leaving.
  const keep = useRef(() => {});
  const saved = useRef<TumblerState>(state);
  useEffect(() => {
    keep.current = () => {
      if (!finished.current && begun) saveCur(store, state, read(), saves, now());
    };
    const was = saved.current;
    if (state.off !== was.off || state.tries !== was.tries) keep.current();
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
    setBegun(true);
    setState((s) => apply(s, m));
  }, []);

  const started = useRef(false);
  const play = useCallback(() => {
    if (!started.current && !opened.done) {
      started.current = true;
      announceVisit({ ev: 'start', path: file.path, type: null, slug: SLUG });
    }
    setBegun(true);
    setPhase('play');
  }, [file.path, opened.done]);

  return {
    state,
    phase,
    info,
    played: opened.played,
    resumed: !!resumed,
    clock: opened.done ? opened.done.time : timerText(endSecs ?? secs),
    dispatch,
    play,
  };
}
