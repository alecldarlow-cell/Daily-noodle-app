/**
 * Completed-result saves, ported line for line from dailynoodle `dn-core.js`
 * (getDone, putDone, mergeStreak, mergeProgress, saveProgress, saveStreak and the
 * save-failure notice). Differences from the browser file, none of which change a
 * result: storage is passed in (no `root.localStorage` default), the clock is
 * injectable for tests, and saveStreak writes to that storage synchronously.
 */
import { dayBefore, londonDay } from './london';
import type { KV, SaveDoc } from './types';

type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);

export interface SaveStoreOptions {
  /** The current instant; defaults to the real clock. */
  now?: () => Date | number;
}

export interface SaveStore {
  read(key: string): SaveDoc | null;
  getDone(key: string, id: string): Obj | null;
  putDone(key: string, id: string, rec: Obj): Obj | null;
  saveProgress(key: string, current: Obj, activeId?: string, report?: boolean): Obj;
  saveStreak(key: string, value: unknown): boolean;
  saveIssues(): number;
  onSaveChange(fn: () => void): () => void;
  retrySaves(): Promise<boolean>;
}

/** Save rules bound to one storage, with its own pending results and failure notices. */
export function createSaveStore(kv: KV, options: SaveStoreOptions = {}): SaveStore {
  const now = options.now ?? (() => new Date());
  const issues = new Map<string, () => unknown>();
  const pendingDone = new Map<string, Record<string, Obj>>();
  const listeners = new Set<() => void>();

  const changed = () =>
    listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* a listener's failure never stops a save */
      }
    });
  const failed = (key: string, retry: () => unknown) => {
    const was = issues.has(key);
    issues.set(key, retry);
    if (!was) changed();
  };
  const saved = (key: string) => {
    if (issues.delete(key)) changed();
  };

  function read(key: string): SaveDoc | null {
    try {
      const s: unknown = JSON.parse(kv.getItem(key) || 'null');
      return object(s) && s.v === 1 ? (s as SaveDoc) : null;
    } catch {
      return null;
    }
  }

  function getDone(key: string, id: string): Obj | null {
    const s = read(key);
    const pending = pendingDone.get(key);
    return (
      ((s && object(s.done) && (s.done[id] as Obj | undefined)) as Obj | undefined) ||
      (pending && pending[id]) ||
      null
    );
  }

  function putDone(key: string, id: string, rec: Obj): Obj | null {
    const pending = pendingDone.get(key) || {};
    const s = (read(key) || { v: 1 }) as SaveDoc & { done: Record<string, Obj> };
    if (!object(s.done)) s.done = {};
    if (s.done[id] && !Object.keys(pending).length) return s.done[id];
    const first: Obj = s.done[id] || pending[id] || Object.assign({}, rec, { d: londonDay(now()) });
    pending[id] = first;
    pendingDone.set(key, pending);
    if (Object.keys(pending).every((k) => s.done[k])) {
      pendingDone.delete(key);
      saved(key);
      return first;
    }
    s.done = Object.assign({}, pending, s.done);
    try {
      kv.setItem(key, JSON.stringify(s));
      pendingDone.delete(key);
      saved(key);
      return first;
    } catch {
      failed(key, () => putDone(key, id, first));
      return null;
    }
  }

  function saveProgress(key: string, current: Obj, activeId?: string, report = true): Obj {
    // Merge even if writing fails, so the current tab retains the results it read.
    let pending = report;
    try {
      const stored = read(key) as Obj | null;
      Object.assign(current, mergeProgress(current, stored, activeId));
      if (stored && same(current, stored)) {
        saved(key);
        return current;
      }
      pending = report && !same(progressOnly(current), progressOnly(stored));
      kv.setItem(key, JSON.stringify(current));
      saved(key);
    } catch {
      if (pending || issues.has(key)) failed(key, () => saveProgress(key, current, activeId, true));
    }
    return current;
  }

  function saveStreak(key: string, value: unknown): boolean {
    try {
      kv.setItem(key, JSON.stringify(value));
      saved(key);
      return true;
    } catch {
      failed(key, () => saveStreak(key, value));
      return false;
    }
  }

  return {
    read,
    getDone,
    putDone,
    saveProgress,
    saveStreak,
    saveIssues: () => issues.size,
    onSaveChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async retrySaves() {
      for (const retry of Array.from(issues.values())) {
        try {
          await retry();
        } catch {
          /* still failing: stays in the list */
        }
      }
      return issues.size === 0;
    },
  };
}

/** Merge two `{last, n, best}` streaks (Tangle, Borders, Reckon), as dn-core.js. */
export function mergeStreak(a: unknown, b: unknown): Obj {
  const A: Obj = object(a) ? a : {};
  const B: Obj = object(b) ? b : {};
  const valid = (s: Obj) => /^\d{4}-\d{2}-\d{2}$/.test(String(s.last || ''));
  const newer = valid(B) && (!valid(A) || String(B.last) > String(A.last)) ? B : A;
  const older = newer === A ? B : A;
  let n = Number(newer.n) || 0;
  if (valid(newer) && valid(older)) {
    if (newer.last === older.last) n = Math.max(n, Number(older.n) || 0);
    else if (dayBefore(String(newer.last)) === older.last)
      n = Math.max(n, (Number(older.n) || 0) + 1);
  }
  return Object.assign({}, older, newer, {
    n,
    best: Math.max(n, Number(A.best) || 0, Number(B.best) || 0),
  });
}

/**
 * Merge a document being saved with what storage already holds. The stored result
 * was committed first, so it wins for any puzzle id; new ids from either side
 * survive; other fields come from `current`.
 */
export function mergeProgress(
  current: Obj,
  stored: Obj | null | undefined,
  activeId?: string,
): Obj {
  if (!stored) return current;
  const merged: Obj = Object.assign({}, stored, current);
  merged.done = Object.assign(
    {},
    object(current.done) ? current.done : {},
    object(stored.done) ? stored.done : {},
  );
  if (object(current.days) || object(stored.days)) {
    const days: Obj = Object.assign(
      {},
      object(current.days) ? current.days : {},
      object(stored.days) ? stored.days : {},
    );
    // As dn-core.js, an absent activeId indexes the key "undefined" (which no save holds).
    const at = String(activeId);
    const local = object(current.days) && current.days[at];
    const remote = object(stored.days) && stored.days[at];
    if (local && (!remote || (remote as Obj).state !== 'done')) days[at] = local;
    merged.days = days;
  }
  if (current.streak || stored.streak) merged.streak = mergeStreak(current.streak, stored.streak);
  if ('best' in current || 'best' in stored)
    merged.best = Math.max(Number(current.best) || 0, Number(stored.best) || 0);
  return merged;
}

/** Deep equality of plain JSON data, ignoring key order. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    !a ||
    !b ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (k) => Object.prototype.hasOwnProperty.call(b, k) && same((a as Obj)[k], (b as Obj)[k]),
    )
  );
}

/** The parts of a document that are game progress, not settings. */
export function progressOnly(s: Obj | null | undefined): Obj {
  const x: Obj = s || {};
  const days = Object.fromEntries(
    Object.entries(object(x.days) ? x.days : {}).filter(
      ([, d]) => d && (d as Obj).state !== 'ready',
    ),
  );
  const streak = x.streak as Obj | undefined;
  return {
    done: x.done || {},
    days,
    cur: x.cur || null,
    streak: streak && streak.last ? streak : null,
    best: x.best || 0,
  };
}
