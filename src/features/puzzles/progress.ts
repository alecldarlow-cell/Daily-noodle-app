/**
 * An unfinished round kept on the phone, so leaving a board (Back, or the app closed) and
 * opening the same puzzle again puts it back as it was, with its time. For Mini, Doku,
 * Sweep and Path (Alec's call, 26 Oct 2026): the site keeps no unfinished round for these
 * (SITE.md › Saved progress), so there is no site key to mirror and these keys are the
 * app's own (`noodle-app-*`, which the personal link and sync leave out).
 *
 * What is kept is the round's moves, not its state: a round comes back by playing the
 * same moves through the model's own `init` and `apply`, so a resumed board is one the
 * model made, and nothing here can change what the replay-proved models decide.
 *
 * Every part-played puzzle keeps its own round (22 Nov 2026, Alec: "Only one Tally can be
 * part-played at a time" came up too often): `noodle-app-rounds-<type>` = {id: round}, the
 * newest ten, each stamped `at`. The old one-per-type slot (`noodle-app-progress-<type>`)
 * still holds the latest round, so an older build resumes it; a puzzle reads its own round
 * first, then the slot if it is that puzzle's. The finish clears the puzzle's round.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { progressKey, roundsKey, type ProgressType } from '@/shared/played/rounds';
import type { CachedStorage } from '@/shared/storage';

/** `noodle-app-progress-mini` and so on (in shared/played, which Today and the Archive read). */
export { progressKey, roundsKey, type ProgressType };

/** The most moves kept: far more than any real round; a longer log is not ours. */
export const MAX_MOVES = 5000;

export interface Progress<E> {
  v: 1;
  /** The puzzle's id (`DP·MINI·0100`…). */
  id: string;
  /** Seconds on the clock when it was kept. */
  secs: number;
  moves: E[];
  /** When it was kept (Date.now ms; from 22 Nov 2026): the newest rounds are the ones kept. */
  at?: number;
}

/** How many part-played rounds a type keeps (the newest), as the site's `rounds`. */
export const ROUNDS_KEPT = 10;

type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);

function parsed(store: CachedStorage, key: string): unknown {
  const raw = store.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** The type's kept rounds, `{id: round}` ({} when none or unreadable). */
export function readRounds(store: CachedStorage, type: ProgressType): Obj {
  const r = parsed(store, roundsKey(type));
  return object(r) ? r : {};
}

function writeRounds(store: CachedStorage, type: ProgressType, rounds: Obj): void {
  const all = Object.entries(rounds).filter(([, r]) => object(r));
  const at = (r: unknown) => Number((r as Obj).at) || 0;
  all.sort((a, b) => at(b[1]) - at(a[1]));
  const kept = Object.fromEntries(all.slice(0, ROUNDS_KEPT));
  store.setItem(roundsKey(type), Object.keys(kept).length ? JSON.stringify(kept) : '');
}

/** Keeps `p` as its puzzle's round (and in the old slot, the latest), stamped `now`. */
export function keepProgress<E>(
  store: CachedStorage,
  type: ProgressType,
  p: Progress<E>,
  now: number,
): void {
  const stamped: Progress<E> = { ...p, at: now };
  store.setItem(progressKey(type), JSON.stringify(stamped));
  // The one being written is always kept, even with a clock set back.
  const others = readRounds(store, type);
  delete others[p.id];
  const at = (r: unknown) => Number((r as Obj).at) || 0;
  const rest = Object.entries(others)
    .filter(([, r]) => object(r))
    .sort((a, b) => at(b[1]) - at(a[1]))
    .slice(0, ROUNDS_KEPT - 1);
  writeRounds(store, type, { ...Object.fromEntries(rest), [p.id]: stamped });
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
  const own = readRounds(store, type)[id];
  const slot = parsed(store, progressKey(type));
  const p = object(own) ? own : slot;
  if (!object(p)) return null;
  const o = p;
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

/** Forget this puzzle's kept round (and the old slot, if it is this puzzle's). */
export function clearProgress(store: CachedStorage, type: ProgressType, id: string): void {
  const rounds = readRounds(store, type);
  if (id in rounds) {
    delete rounds[id];
    writeRounds(store, type, rounds);
  }
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
      keepProgress(store, type, p, Date.now());
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
