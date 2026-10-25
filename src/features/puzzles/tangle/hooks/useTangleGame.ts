import { londonDay, type KV, type SaveStore } from '@noodle/core';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

import { announceFinish } from '@/shared/results';
import { appStorage, saves as appSaves } from '@/shared/storage';

import type { PuzzleFile } from '../../types';
import { sheetInfo } from '../finishing';
import { createTangle, KEY, type Rect, type TangleData, type TangleEngine } from '../model';

interface Deps {
  store?: KV;
  saves?: SaveStore;
  now?: () => number;
  /** The phone asks for reduced motion (read from the system when not given). */
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
 * the background (the page's visibilitychange), saved when the screen closes (its
 * pagehide), and its first result announced on the results bus with the tracker's
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

  const reduced = deps.reduced;
  useEffect(() => {
    if (reduced !== undefined) {
      host.setReduced(reduced);
      return;
    }
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => {
        if (on) host.setReduced(r);
      })
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [host, reduced]);

  useEffect(() => {
    const e = host.engine;
    const h = setInterval(() => e.tick(), 100);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') e.visible();
      else if (st === 'background') e.hidden();
    });
    return () => {
      clearInterval(h);
      sub.remove();
      e.leave();
    };
  }, [host]);

  return { engine: host.engine, setRects: host.setRects };
}
