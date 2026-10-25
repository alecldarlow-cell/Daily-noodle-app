import { londonDay, type SaveStore } from '@noodle/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useHapticDiff } from '@/shared/haptics';
import { announceFinish } from '@/shared/results';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import { commitFinish, readSave, reopenInfo, saveHost, type FinishInfo } from '../finishing';
import { apply, frame, init, type Move, type ReckonData, type ReckonState } from '../model';
import { reckonFeel, reckonHaptics, reckonSnap } from './feel';

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  /** performance.now(): the clock frames and Lock in are timed by. */
  perf?: () => number;
  /** The wall clock (Date.now): the London day. */
  wall?: () => number;
}

const perfNow = () => globalThis.performance.now();

/**
 * One Reckon being played, as engines/reckon.js runs it: the model's state, saved
 * through the site's save rules after every change the page saves; the active-time
 * clock adding up animation frames on the play screen (not paused, not in the
 * background); the round saved when the app goes to the background (the page's
 * pagehide), so it resumes exactly. The tenth answer's Next saves the result (first
 * one kept), counts the streak on the puzzle's own day only, and announces the finish
 * with the tracker's detail; a finished Reckon opens on its sheet and never announces.
 */
export function useReckonGame(file: PuzzleFile<ReckonData>, deps: Deps = {}) {
  const store = deps.store ?? appStorage;
  const saves = deps.saves ?? appSaves;
  const perf = deps.perf ?? perfNow;
  const wall = deps.wall ?? Date.now;
  const id = file.data.id;
  const host = useMemo(
    () => saveHost(saves, id, perf, () => londonDay(wall())),
    [saves, id, perf, wall],
  );
  const [initial] = useState(() => init(file.data, readSave(store), perf()));
  const ref = useRef<ReckonState>(initial);
  const [state, setState] = useState<ReckonState>(initial);
  const [info, setInfo] = useState<FinishInfo | null>(() => reopenInfo(initial, host.today()));
  // The page's own Vibration setting decides for Reckon.
  useHapticDiff(reckonSnap(state), reckonFeel, reckonHaptics(state));

  const dispatch = useCallback(
    (m: Move) => {
      let s = apply(ref.current, m, host);
      if (s.finishing) {
        const f = commitFinish(s, saves, host);
        s = f.state;
        setInfo(f);
        announceFinish({ path: file.path, type: 'reckon', detail: f.detail });
      }
      ref.current = s;
      setState(s);
    },
    [host, saves, file.path],
  );

  // The engine's loop: every animation frame adds the time since the last.
  useEffect(() => {
    let h = 0;
    const loop = () => {
      frame(ref.current, perf());
      h = requestAnimationFrame(loop);
    };
    h = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(h);
  }, [perf]);

  // pagehide / visibilitychange: save the round on leaving; time away never counts.
  useEffect(() => {
    const save = () => {
      const s = ref.current;
      const playing = !!(s.save.done[s.P.id] || (s.save.cur && s.save.cur.id === s.P.id));
      host.persist(s.save, playing);
    };
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') ref.current.last = perf();
      else save();
    });
    return () => {
      save();
      sub?.remove();
    };
  }, [host, perf]);

  return { state, info, dispatch, today: host.today() };
}
