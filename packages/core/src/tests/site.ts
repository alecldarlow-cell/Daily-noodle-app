/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The site's own code, vendored by scripts/vendor-site.js, loaded for differential
 * tests. Never imported outside tests.
 */
export interface FakeStorage {
  m: Record<string, string>;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  fail: boolean;
}

export function fakeStorage(init: Record<string, unknown> = {}): FakeStorage {
  const s: FakeStorage = {
    m: {},
    fail: false,
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(this.m, k) ? (this.m[k] ?? null) : null;
    },
    setItem(k, v) {
      if (this.fail) throw new Error('QuotaExceededError');
      this.m[k] = String(v);
    },
  };
  for (const [k, v] of Object.entries(init)) s.m[k] = JSON.stringify(v);
  return s;
}

type Fn = (...a: any[]) => any;

export interface DnCore {
  londonDay: (i?: unknown) => string;
  dayBefore: (d: string) => string;
  getDone: Fn;
  putDone: Fn;
  mergeProgress: Fn;
  saveProgress: Fn;
  saveStreak: Fn;
  saveIssues: () => number;
  onSaveChange: Fn;
  retrySaves: () => Promise<boolean>;
}

export interface Site {
  front: { clock: Fn; shownClock: Fn; num: Fn; resultText: Fn; playedState: Fn };
  mini: { followsOn: Fn; bumpStreak: Fn };
  sweep: { followsOn: Fn; recordResult: Fn };
  link: { recordResult: Fn; dnTime: Fn; dnStreak: Fn; dnNum: Fn; dnLinkRow: Fn; dnLink: Fn };
  path: { streakGet: Fn; streakLive: Fn; streakBump: Fn; STREAK_KEY: string };
  doku: { dokuStreakSeed: Fn };
  sweepShare: { dnTime: Fn; dnStreak: Fn; dnNum: Fn; dnSweepDay: Fn; dnSweep: Fn };
  tangle: { plural: Fn };
  setStreak(s: unknown): void;
  getStreak(): unknown;
}

/** A fresh copy of dn-core.js (its save-failure state is module-level). */
export function loadDnCore(): DnCore {
  let core: DnCore | undefined;
  jest.isolateModules(() => {
    core = require('../../vendor/dn-core.js') as DnCore;
  });
  return core!;
}

/** The lifted site functions, reading and writing `storage`. */
export function loadSite(storage: FakeStorage, core: DnCore = loadDnCore()): Site {
  const load = require('../../vendor/site.js') as (env: unknown) => Site;
  return load({
    localStorage: storage,
    dnCore: core,
    londonDay: core.londonDay,
    dayBefore: core.dayBefore,
  });
}
