import { dnTime, type SaveStore } from '@noodle/core';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useHapticDiff } from '@/shared/haptics';
import { announceFinish, usePuzzleVisit } from '@/shared/results';
import { usePuzzleClock } from '@/shared/start-card';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import { isMoveOf, resumeRound, useKeepRound, type MoveSpec } from '../../progress';
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

/** Every move the Doku's model takes, for reading a kept round back. */
const MOVES: MoveSpec = {
  tile: { id: 'string' },
  cell: { r: 'number', c: 'number' },
  key: { ch: 'string' },
  del: {},
  space: {},
  hints: {},
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
 * One Doku being played: the model's state, the clock, the start card, and the finish.
 * Opening it seeds Doku's own streak from its results if it has none yet, as the
 * page's load does, so the start card shows the rebuilt run. The clock ticks once a
 * second from the first tile placed or the first delete, as the page's does (Play
 * only shows the board). On the solve the result is saved (first result kept), the
 * streak bumped, and the finish announced on the results bus with the tracker's
 * detail. A puzzle already finished opens on its finish sheet with the original time
 * and never announces again. A round left unfinished is kept (progress.ts) and opens
 * again on its board, at its time, with no start card and the phone's keyboard down.
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
  const [resumed] = useState(() => {
    if (opened) return null;
    const r = resumeRound(store, 'doku', id, init(file.data), apply, isMove);
    // The board as it was, but not the phone's keyboard: that waits for a tap.
    return r ? { ...r, state: { ...r.state, kbd: false } } : null;
  });
  const moves = useRef<Move[]>(resumed?.moves ?? []);
  const [state, setState] = useState<DokuState>(
    () => opened?.state ?? resumed?.state ?? init(file.data),
  );
  const [phase, setPhase] = useState<Phase>(opened ? 'finished' : resumed ? 'play' : 'start');
  const [info, setInfo] = useState<FinishInfo | null>(opened?.info ?? null);
  useHapticDiff(state, dokuFeel);

  // Ticks once a second while in play; time with the app away never counts.
  const { secs, read } = usePuzzleClock(state.started && !state.solved, {
    now,
    initial: resumed?.secs,
  });
  useKeepRound({
    store,
    type: 'doku',
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
    if (f.first) announceFinish({ path: file.path, type: 'doku', detail: f.detail });
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
  // A resumed round was started when it was first played.
  const start = usePuzzleVisit(file.path, 'doku', !!opened || !!resumed);
  const play = useCallback(() => {
    start();
    setPhase('play');
  }, [start]);
  const clock = timerText(opened ? opened.secs : secs);

  // The message keeps the page's "00:14"; the bar's clock reads as Path's does ("0:14").
  return {
    state,
    phase,
    info,
    clock: dnTime(clock),
    msg: message(state, clock),
    dispatch,
    feed,
    play,
  };
}
