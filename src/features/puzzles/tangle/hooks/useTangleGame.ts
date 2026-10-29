import { londonDay, type KV, type SaveStore } from '@noodle/core';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useHapticDiff } from '@/shared/haptics';
import { useReduceMotion } from '@/shared/motion';
import { announceFinish } from '@/shared/results';
import { appStorage, saves as appSaves } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import { sheetInfo } from '../finishing';
import { createTangle, KEY, type Rect, type TangleData, type TangleEngine } from '../model';
import { tangleFeel, tangleSnap } from './feel';

interface Deps {
  store?: KV;
  saves?: SaveStore;
  now?: () => number;
  /** Reduced motion asked for (else the app's switch or the phone's setting). */
  reduced?: boolean;
}

/** The engine with what the screen hands it: the board's layout, reduced motion, repaints. */
export class TangleHost {
  readonly engine: TangleEngine;
  private rects: Rect[] = [];
  private reduced = false;
  private version = 0;
  private listeners = new Set<() => void>();

  constructor(file: PuzzleFile<TangleData>, deps: Required<Omit<Deps, 'reduced'>>) {
    const host = this;
    const e: TangleEngine = createTangle(file.data, {
      saves: deps.saves,
      read: () => deps.store.getItem(KEY),
      now: deps.now,
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
      rects: () => host.rects,
      coarse: true,
      get sysRM() {
        return host.reduced;
      },
      changed: () => host.poke(),
      ended: () =>
        announceFinish({
          path: file.path,
          type: 'tangle',
          detail: sheetInfo(e, londonDay(deps.now())).detail,
        }),
    });
    this.engine = e;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getVersion = () => this.version;
  poke = () => {
    this.version++;
    this.listeners.forEach((fn) => fn());
  };
  setRects = (r: Rect[]) => {
    this.rects = r;
  };
  setReduced(on: boolean) {
    this.reduced = on;
  }
}

/**
 * One Tangle open on the screen: the engine (engines/tangle.js, ported) on the real
 * clock, ticking every 100 ms as the page does, paused and saved when the app goes to
 * the background (the page's visibilitychange), saved when the app goes inactive or the
 * screen closes (its pagehide), so a round left part-way comes back after the app is
 * closed as "Round paused" with its time (AF-029), and its first result announced on the results bus with the tracker's
 * detail.
 */
export function useTangleGame(file: PuzzleFile<TangleData>, deps: Deps = {}) {
  const [host] = useState(
    () =>
      new TangleHost(file, {
        store: deps.store ?? appStorage,
        saves: deps.saves ?? appSaves,
        now: deps.now ?? Date.now,
      }),
  );
  useSyncExternalStore(host.subscribe, host.getVersion);
  useHapticDiff(tangleSnap(host.engine), tangleFeel);

  // The app's Animations switch, else the phone's setting (AF-012), kept up to date.
  const system = useReduceMotion();
  const reduced = deps.reduced ?? system;
  useEffect(() => {
    if (reduced !== null) host.setReduced(reduced);
  }, [host, reduced]);

  useEffect(() => {
    const e = host.engine;
    const h = setInterval(() => e.tick(), 100);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') e.visible();
      else if (st === 'background') e.hidden();
      // inactive (iOS's app switcher, a call): the app can be closed from there with no
      // background first, so keep the round where it stands now (the page's pagehide
      // save; nothing in play changes) rather than as of the last 5-second save.
      else e.leave();
    });
    return () => {
      clearInterval(h);
      sub.remove();
      e.leave();
    };
  }, [host]);

  return { engine: host.engine, setRects: host.setRects };
}
