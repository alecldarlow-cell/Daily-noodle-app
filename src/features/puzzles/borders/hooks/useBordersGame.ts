import { londonDay, type SaveStore } from '@noodle/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useHapticDiff } from '@/shared/haptics';
import { announceFinish } from '@/shared/results';
import { play, useSoundDiff } from '@/shared/sound';
import { appStorage, saves as appSaves, type CachedStorage } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import { commitFinish, readSave, reopenInfo, saveHost, type FinishInfo } from '../finishing';
import { apply, frame, init, type BordersData, type BordersState, type Move } from '../model';
import { bordersFeel, bordersSnap } from './feel';
import { bordersSound, bordersSoundSnap } from './sound';

interface Deps {
  store?: CachedStorage;
  saves?: SaveStore;
  perf?: () => number;
  wall?: () => number;
}

const perfNow = () => globalThis.performance.now();

/**
 * One Borders being played, as engines/borders.js runs it: the model's state, saved
 * through the site's save rules where the page saves; a right name added to
 * Borderline's atlas in the app's storage; the active-time clock on the question
 * screen; the round saved and the game paused when the app goes to the background (as
 * the page does when hidden). The last Next saves the result, counts the streak (every
 * finished round counts, on whatever day) and announces the finish with the tracker's
 * detail; a finished Borders opens on its sheet and never announces again.
 */
export function useBordersGame(file: PuzzleFile<BordersData>, deps: Deps = {}) {
  const store = deps.store ?? appStorage;
  const saves = deps.saves ?? appSaves;
  const perf = deps.perf ?? perfNow;
  const wall = deps.wall ?? Date.now;
  const id = file.data.id;
  const host = useMemo(
    () => saveHost(saves, store, id, perf, () => londonDay(wall())),
    [saves, store, id, perf, wall],
  );
  const [initial] = useState(() => init(file.data, readSave(store), perf()));
  const ref = useRef<BordersState>(initial);
  const [state, setState] = useState<BordersState>(initial);
  const [info, setInfo] = useState<FinishInfo | null>(() => reopenInfo(initial, host.today()));
  useHapticDiff(bordersSnap(state), bordersFeel);
  // The website's tones (AF-013), read off each new state; never into the model.
  useSoundDiff(bordersSoundSnap(state), bordersSound);

  const settle = useCallback(
    (s: BordersState) => {
      if (s.finishing) {
        const f = commitFinish(s, host);
        s = f.state;
        setInfo(f);
        announceFinish({ path: file.path, type: 'borders', detail: f.detail });
        play('borders-pass'); // the page's one finishing chime, its celebration jingle
      }
      ref.current = s;
      setState(s);
    },
    [host, file.path],
  );
  const dispatch = useCallback((m: Move) => settle(apply(ref.current, m, host)), [settle, host]);

  useEffect(() => {
    let h = 0;
    const loop = () => {
      frame(ref.current, perf());
      h = requestAnimationFrame(loop);
    };
    h = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(h);
  }, [perf]);

  // visibilitychange: hidden pauses a question and saves; back again, time away never counts.
  useEffect(() => {
    const save = () => {
      const s = ref.current;
      const playing = !!(s.save.done[s.P.id] || (s.save.cur && s.save.cur.id === s.P.id));
      host.persist(s.save, playing);
    };
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') ref.current.last = perf();
      else {
        if (ref.current.view === 'quiz' && !ref.current.paused)
          settle(apply(ref.current, { t: 'pause' }, host));
        save();
      }
    });
    return () => {
      save();
      sub?.remove();
    };
  }, [host, perf, settle]);

  return { state, info, dispatch, today: host.today() };
}
