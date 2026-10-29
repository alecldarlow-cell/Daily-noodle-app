/**
 * An unfinished round kept on the phone, so leaving a board (Back, or the app closed) and
 * opening the same puzzle again puts it back as it was, with its time. For Mini, Doku,
 * Sweep and Path (Alec's call, 26 Oct 2026): the site keeps no unfinished round for these
 * (SITE.md › Saved progress), so there is no site key to mirror and these keys are the
 * app's own (`noodle-app-*`, which the personal link and sync leave out).
 *
 * What is kept is the round's moves, not its state: a round comes back by playing the
 * same moves through the model's own `init` and `apply`, so a resumed board is one the
 * model made, and nothing here can change what the replay-proved models decide. One slot
 * per type, holding the puzzle it belongs to; a different puzzle never takes it up, and
 * the finish clears it.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { progressKey, type ProgressType } from '@/shared/played/rounds';
import type { CachedStorage } from '@/shared/storage';

/** `noodle-app-progress-mini` and so on (in shared/played, which Today and the Archive read). */
export { progressKey, type ProgressType };

/** The most moves kept: far more than any real round; a longer log is not ours. */
export const MAX_MOVES = 5000;

export interface Progress<E> {
  v: 1;
  /** The puzzle's id (`DP·MINI·0100`…). */
  id: string;
  /** Seconds on the clock when it was kept. */
  secs: number;
  moves: E[];
}

/** A move's shape: its `t`, and the fields it must carry with their types. */
export type MoveSpec = Record<string, Record<string, 'number' | 'string' | 'boolean'>>;

/** True when `x` is one of the moves `spec` lists, with every field it needs. */
export function isMoveOf(spec: MoveSpec, x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  const fields = typeof m.t === 'string' ? spec[m.t] : undefined;
  if (!fields || !Object.prototype.hasOwnProperty.call(spec, m.t as string)) return false;
  return Object.entries(fields).every(([k, ty]) => {
    const v = m[k];
    return typeof v === ty && (ty !== 'number' || Number.isFinite(v));
  });
}

/** The kept round for `id`, or null: none, another puzzle's, or not one we can read. */
export function readProgress<E>(
  store: CachedStorage,
  type: ProgressType,
  id: string,
  isEntry: (x: unknown) => x is E,
): Progress<E> | null {
  const raw = store.getItem(progressKey(type));
  if (!raw) return null;
  let p: unknown;
  try {
    p = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  if (o.v !== 1 || o.id !== id) return null;
  if (typeof o.secs !== 'number' || !Number.isFinite(o.secs) || o.secs < 0) return null;
  if (!Array.isArray(o.moves) || o.moves.length > MAX_MOVES) return null;
  if (!o.moves.every((m) => isEntry(m))) return null;
  return { v: 1, id, secs: Math.floor(o.secs), moves: o.moves as E[] };
}

/**
 * The round for `id` played back from `start` through the model's own `step`, or null when
 * there is none or it can't be played back (a bad save is dropped, never half-applied).
 */
export function resumeRound<S, E>(
  store: CachedStorage,
  type: ProgressType,
  id: string,
  start: S,
  step: (s: S, e: E) => S,
  isEntry: (x: unknown) => x is E,
): { state: S; secs: number; moves: E[] } | null {
  const p = readProgress(store, type, id, isEntry);
  if (!p || p.moves.length === 0) return null;
  try {
    return { state: p.moves.reduce(step, start), secs: p.secs, moves: p.moves };
  } catch {
    clearProgress(store, type, id);
    return null;
  }
}

/** Forget the kept round, if it is this puzzle's. */
export function clearProgress(store: CachedStorage, type: ProgressType, id: string): void {
  const raw = store.getItem(progressKey(type));
  if (!raw) return;
  let held: unknown = null;
  try {
    held = (JSON.parse(raw) as { id?: unknown } | null)?.id;
  } catch {
    // Unreadable: nobody's round, so it goes.
  }
  if (held === null || held === undefined || held === id) store.setItem(progressKey(type), '');
}

interface Keep<E> {
  store: CachedStorage;
  type: ProgressType;
  id: string;
  /** The moves so far, in order (the hook appends as it dispatches). */
  moves: { current: E[] };
  /** The clock's exact seconds now. */
  read: () => number;
  /** A round worth keeping is on the board: started, not finished, not a replay. */
  live: boolean;
  /** The round is over (a result was saved): the slot is cleared. */
  done: boolean;
  /** Changes with every move, so the round is written as it is played. */
  state: unknown;
}

/**
 * Keeps the round as it is played: after each move, when the app goes to the background
 * (where Android may close it), and when the screen is left. Clears it at the finish.
 */
export function useKeepRound<E>({ store, type, id, moves, read, live, done, state }: Keep<E>) {
  const latest = useRef({ live, read });
  useEffect(() => {
    latest.current = { live, read };
  }, [live, read]);

  const write = useRef(() => {});
  useEffect(() => {
    write.current = () => {
      if (!latest.current.live || moves.current.length === 0) return;
      const p: Progress<E> = { v: 1, id, secs: latest.current.read(), moves: moves.current };
      store.setItem(progressKey(type), JSON.stringify(p));
    };
  }, [store, type, id, moves]);

  useEffect(() => {
    if (live) write.current();
  }, [live, state]);

  useEffect(() => {
    if (done) clearProgress(store, type, id);
  }, [done, store, type, id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') write.current();
    });
    return () => {
      sub?.remove();
      write.current();
    };
  }, []);
}
