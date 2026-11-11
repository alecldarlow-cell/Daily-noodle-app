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
  outMsg,
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
  turnTime,
  type Move,
  type TiltData,
  type TiltState,
} from '../model';
import { tiltFeel } from './feel';

export type Phase = 'start' | 'play' | 'finished';

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  now?: () => number;
  /** Motion kept down: the ball goes out at once, as the page's does under reduced motion. */
  reduced?: boolean;
}

/**
 * One Tilt maze being played: the model's state, the clock, the start card and the finish.
 * The clock starts on Play and stops while the app is away. A maze part-turned is kept in
 * `digi-tilt-v1.cur` as the page keeps it, so it carries across the website and the app.
 * When the ball goes out, the finish waits for its turn, roll and exit to play (the clock
 * still running, as the page's does), then saves the result and opens the sheet.
 */
export function useTiltGame(file: PuzzleFile<TiltData>, deps: Deps = {}) {
  const store = deps.store ?? appStorage;
  const saves = deps.saves ?? appSaves;
  const now = deps.now ?? Date.now;
  const reduced = !!deps.reduced;
  const id = file.data.id;

  const [opened] = useState(() => {
    const rec = saves.getDone(SAVE_KEY, id);
    const t = now();
    if (rec) {
      const info = reopenInfo(file.data, rec, store, t);
      const time = recordTime(rec);
      return {
        streak: liveStreak(store, t),
        done: {
          state: { ...restoreDone(file.data, info.turns), msg: outMsg(time, info.turns) },
          info,
          time,
        },
        resumed: null,
      };
    }
    return { streak: liveStreak(store, t), done: null, resumed: restoreCur(store, file.data) };
  });
  const { resumed } = opened;
  const [state, setState] = useState<TiltState>(
    () => opened.done?.state ?? resumed?.state ?? init(file.data),
  );
  const [phase, setPhase] = useState<Phase>(opened.done ? 'finished' : 'start');
  const [info, setInfo] = useState<FinishInfo | null>(opened.done?.info ?? null);
  const [begun, setBegun] = useState(false);
  const [endSecs, setEndSecs] = useState<number | null>(null);
  useHapticDiff(state, tiltFeel);

  const { secs, readExact: read } = usePuzzleClock(begun && endSecs === null && !opened.done, {
    now,
    initial: resumed?.secs,
  });

  const finished = useRef(!!opened.done);
  useEffect(() => {
    if (!state.solved || finished.current) return;
    finished.current = true;
    const wait = reduced ? 0 : turnTime(state);
    const h = setTimeout(() => {
      const clock = read();
      setEndSecs(clock);
      const f = commitFinish(state, clock, !!resumed, saves, store, now());
      if (f.first) announceFinish({ path: file.path, type: null, detail: f.detail });
      setInfo(f);
      setState((s) => ({ ...s, msg: outMsg(f.hero, s.turns) }));
      setPhase('finished');
    }, wait);
    return () => clearTimeout(h);
  }, [state, read, saves, store, now, file.path, resumed, reduced]);

  // The maze is written after each turn and Undo, when the app goes away, and on leaving.
  const keep = useRef(() => {});
  const saved = useRef<TiltState>(state);
  useEffect(() => {
    keep.current = () => {
      if (!finished.current && begun) saveCur(store, state, read(), saves, now());
    };
    if (state.turns !== saved.current.turns || state.hist !== saved.current.hist) keep.current();
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
    // A turn starts the clock if Play somehow didn't, as the page's does.
    if (m.t === 'turn') setBegun(true);
    setState((s) => apply(s, m));
  }, []);

  const start = usePuzzleVisit(file.path, null, !!opened.done || !!resumed, 'logic-tilt');
  const play = useCallback(() => {
    start();
    setBegun(true);
    setPhase('play');
  }, [start]);

  return {
    state,
    phase,
    info,
    streak: info?.streak ?? opened.streak,
    resumed: !!resumed,
    clock: opened.done ? opened.done.time : timerText(endSecs ?? secs),
    dispatch,
    play,
  };
}
