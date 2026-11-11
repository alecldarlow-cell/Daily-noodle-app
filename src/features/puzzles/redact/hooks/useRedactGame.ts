import type { SaveStore } from '@noodle/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useHapticDiff, strongest, type Buzz } from '@/shared/haptics';
import { useReduceMotion } from '@/shared/motion';
import { announceFinish, usePuzzleVisit } from '@/shared/results';
import { usePuzzleClock } from '@/shared/start-card';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import {
  commitFinish,
  liveStreak,
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
  type RedactData,
  type RedactState,
} from '../model';

export type Phase = 'start' | 'play' | 'finished';

/** The site's tracker slug: a Lab trial has no daily type. */
export const SLUG = 'word-redact';
/** After the solved grid's wave, the short hold before the sheet (the engine's HOLD). */
const HOLD_MS = 250;
const POP_MS = 600;

/** The engine's win beat: each step ~0.84 s / (2n − 2), at most 90 ms; then a 0.6 s pop and the hold. */
export function waveStep(n: number): number {
  return Math.min(90, Math.round(840 / (2 * n - 2)));
}
export function sheetDelay(n: number, reduced: boolean): number {
  return reduced ? 0 : waveStep(n) * (2 * n - 2) + POP_MS + HOLD_MS;
}

/** What a Redact move feels like: the solve, a wrong try at the full count, or a tap. */
export function redactFeel(prev: RedactState, next: RedactState): Buzz | null {
  return strongest(
    next.solved && !prev.solved && 'success',
    next.shake > prev.shake && 'error',
    next.taps > prev.taps && 'tap',
  );
}

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  now?: () => number;
}

/**
 * One Redact being played: the model's state, the clock, the start card and the finish. The
 * clock starts on Play (or the first tap) and stops while the app is away. An unfinished
 * board is kept in `digi-redact-v1.cur` as the page keeps it, so it carries across the
 * website and the app. The finish is saved at once; the sheet follows the solved grid's wave.
 */
export function useRedactGame(file: PuzzleFile<RedactData>, deps: Deps = {}) {
  const store = deps.store ?? appStorage;
  const saves = deps.saves ?? appSaves;
  const now = deps.now ?? Date.now;
  const id = file.data.id;
  const reduced = useReduceMotion() === true;

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
  const [state, setState] = useState<RedactState>(
    () => opened.done?.state ?? resumed?.state ?? init(file.data),
  );
  const [phase, setPhase] = useState<Phase>(opened.done ? 'finished' : 'start');
  const [info, setInfo] = useState<FinishInfo | null>(opened.done?.info ?? null);
  const [played] = useState(() => playedCount(store));
  const [begun, setBegun] = useState(false);
  useHapticDiff(state, redactFeel);

  const { secs, readExact: read } = usePuzzleClock(begun && !state.solved, {
    now,
    initial: resumed?.secs,
  });
  const [endSecs, setEndSecs] = useState<number | null>(null);

  const finished = useRef(!!opened.done);
  useEffect(() => {
    if (!state.solved || finished.current) return;
    finished.current = true;
    const clock = read();
    setEndSecs(clock);
    const f = commitFinish(state, clock, !!resumed, saves, store, now());
    // A Lab trial: tracked as the page is (its slug in the detail), never a league result.
    if (f.first) announceFinish({ path: file.path, type: null, detail: f.detail });
    setInfo(f);
  }, [state, read, saves, store, now, file.path, resumed]);

  // The solved grid is seen first: the sheet follows the wave (at once with reduced motion).
  useEffect(() => {
    if (!info || phase !== 'play') return;
    const t = setTimeout(() => setPhase('finished'), sheetDelay(state.n, reduced));
    return () => clearTimeout(t);
  }, [info, phase, state.n, reduced]);

  const keep = useRef(() => {});
  const saved = useRef<RedactState>(state);
  useEffect(() => {
    keep.current = () => {
      if (!finished.current && begun) saveCur(store, state, read(), saves, now());
    };
    if (state.black !== saved.current.black) keep.current();
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

  const start = usePuzzleVisit(file.path, null, !!opened.done || !!resumed, SLUG);
  const play = useCallback(() => {
    start();
    setBegun(true);
    setPhase('play');
  }, [start]);

  return {
    state,
    phase,
    info,
    streak: opened.streak,
    played,
    resumed: !!resumed,
    /** The win beat is playing: the grid is solved, the sheet not yet up. */
    winning: phase === 'play' && !!info,
    clock: opened.done ? opened.done.time : timerText(endSecs ?? secs),
    dispatch,
    play,
  };
}
