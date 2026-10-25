import type { SaveStore } from '@noodle/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { announceFinish } from '@/shared/results';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import { commitFinish, liveStreak, reopenInfo, type FinishInfo } from '../finishing';
import {
  apply,
  init,
  recordTime,
  restore,
  SAVE_KEY,
  timerText,
  type Move,
  type PathData,
  type PathState,
} from '../model';
import { SHEET_DELAY_MS } from '../simulate';

export type Phase = 'start' | 'play' | 'finished';

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  now?: () => number;
}

/**
 * One Path being played: the model's state, the clock, the start card and the finish.
 * The clock waits at zero on the start card and starts on Play (SITE.md › Players: Path
 * and Link clocks start on Play), or on the first tap if Play was somehow skipped. On
 * the last square the result is saved (first kept), the streak bumped, and the finish
 * announced with the tracker's detail; the sheet rises 0.9 s later. A puzzle already
 * finished opens on its sheet with its saved time and never announces again.
 */
export function usePathGame(file: PuzzleFile<PathData>, deps: Deps = {}) {
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
            state: restore(file.data, rec),
            info: reopenInfo(restore(file.data, rec), rec, store, t),
            time: recordTime(rec),
          }
        : null,
    };
  });
  const [state, setState] = useState<PathState>(() => opened.done?.state ?? init(file.data));
  const [phase, setPhase] = useState<Phase>(opened.done ? 'finished' : 'start');
  const [info, setInfo] = useState<FinishInfo | null>(opened.done?.info ?? null);
  const [streak, setStreak] = useState(opened.streak);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secs, setSecs] = useState(0);

  const begin = useCallback(() => setStartedAt((t) => t ?? now()), [now]);

  useEffect(() => {
    if (startedAt === null || state.solved) return;
    const tick = () => setSecs(Math.floor((now() - startedAt) / 1000));
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [startedAt, state.solved, now]);

  const finished = useRef(!!opened.done);
  useEffect(() => {
    if (!state.solved || finished.current) return;
    finished.current = true;
    const at = now();
    const clock = startedAt === null ? 0 : Math.floor((at - startedAt) / 1000);
    setSecs(clock);
    const f = commitFinish(state, clock, saves, store, at);
    if (f.first) announceFinish({ path: file.path, type: 'path', detail: f.detail });
    setStreak(f.streak);
    setInfo(f);
  }, [state, startedAt, saves, store, now, file.path]);

  useEffect(() => {
    if (!info || phase !== 'play') return;
    const t = setTimeout(() => setPhase('finished'), SHEET_DELAY_MS);
    return () => clearTimeout(t);
  }, [info, phase]);

  // The clock starts on Play; a tap starts it too, as the page's fallback does.
  const dispatch = useCallback(
    (m: Move) => {
      if (m.t !== 'undo') begin();
      setState((s) => apply(s, m));
    },
    [begin],
  );
  const play = useCallback(() => {
    begin();
    setPhase('play');
  }, [begin]);

  return {
    state,
    phase,
    info,
    streak,
    clock: opened.done ? opened.done.time : timerText(secs),
    dispatch,
    play,
  };
}
