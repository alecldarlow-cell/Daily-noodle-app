import { dnTime, type SaveStore } from '@noodle/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useHapticDiff } from '@/shared/haptics';
import { announceFinish, usePuzzleVisit } from '@/shared/results';
import { usePuzzleClock } from '@/shared/start-card';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import { isMoveOf, resumeRound, useKeepRound, type MoveSpec } from '../../progress';
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

/** Every move the Mini's model takes, for reading a kept round back. */
const MOVES: MoveSpec = {
  cell: { r: 'number', c: 'number' },
  key: { ch: 'string' },
  del: {},
  bar: {},
  step: { delta: 'number' },
  checkWord: {},
  checkAll: {},
  revealWord: {},
};
const isMove = (x: unknown): x is Move => isMoveOf(MOVES, x);

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
 * announces again. A round left unfinished is kept (progress.ts) and opens again on its
 * board, at its time, with no start card.
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
  const [resumed] = useState(() =>
    opened ? null : resumeRound(store, 'mini', id, init(file.data), apply, isMove),
  );
  const moves = useRef<Move[]>(resumed?.moves ?? []);
  const [state, setState] = useState<MiniState>(
    () => opened?.state ?? resumed?.state ?? init(file.data),
  );
  const [phase, setPhase] = useState<Phase>(opened ? 'finished' : resumed ? 'play' : 'start');
  const [info, setInfo] = useState<FinishInfo | null>(opened?.info ?? null);
  useHapticDiff(state, miniFeel);

  // Ticks once a second while in play; time with the app away never counts.
  const { secs, read } = usePuzzleClock(state.started && !state.solved, {
    now,
    initial: resumed?.secs,
  });
  useKeepRound({
    store,
    type: 'mini',
    id,
    moves,
    read,
    live: !opened && state.started && !state.solved,
    done: !!info,
    state,
  });

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

  const dispatch = useCallback((m: Move) => {
    moves.current.push(m);
    setState((s) => apply(s, m));
  }, []);
  // Play on the start card is the page's start (a tap in its play area); a resumed round
  // was started when it was first played.
  const start = usePuzzleVisit(file.path, 'mini', !!opened || !!resumed);
  const play = useCallback(() => {
    start();
    setPhase('play');
  }, [start]);

  return {
    state,
    phase,
    info,
    bar: clueBar(state),
    // The bar's clock reads as Path's and the finish sheet's do, minutes unpadded ("0:03").
    clock: dnTime(timerText(opened ? opened.secs : secs)),
    dispatch,
    play,
  };
}
