/**
 * The app's key-value store. @noodle/core's save rules need synchronous reads and
 * writes (as localStorage gives the site), and AsyncStorage is asynchronous, so this
 * keeps every key in memory, hydrated once at launch, and writes through to the
 * backend in the background. Keys are the site's own (`digi-mini-v1`…), verbatim.
 *
 * Durable writes (hardening R1, R2):
 * - A write that fails to reach the disk stays queued (latest value per key) and is
 *   retried with a backoff, and on every later write. `saveStatus` turns `retrying`
 *   while a critical key (a result, a streak, the league identity: anything that isn't a
 *   cache) is unsaved, so the app can say so; a cache's failed write is dropped, as the
 *   cache refills itself.
 * - `flush()` rejects while a critical write is still unsaved.
 * - Hydration is all-or-nothing: a failed or partial read commits nothing and leaves the
 *   store unhydrated, and nothing is written to the backend until a hydration succeeds;
 *   then the disk's value wins over one written before it was read, so a key that was
 *   never read is never written over.
 */
import type { KV } from '@noodle/core';

export interface AsyncBackend {
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  setItem(key: string, value: string): Promise<void>;
}

/** `saved`: everything critical is on the disk; `retrying`: something critical isn't yet. */
export type SaveStatus = 'saved' | 'retrying';

export interface CachedStorage extends KV {
  /** Load everything from the backend; call once before first use. Rejects on a failed or partial read (retry by calling again). */
  hydrate(): Promise<void>;
  readonly hydrated: boolean;
  /** Run `fn` whenever `key` changes; returns the unsubscribe. */
  subscribe(key: string, fn: () => void): () => void;
  /** Every key held. */
  keys(): string[];
  /** Tries every queued write now; resolves when all reached the backend, rejects while a critical one hasn't. */
  flush(): Promise<void>;
  /** Whether every critical write so far is on the disk. */
  readonly saveStatus: SaveStatus;
  /** Run `fn` whenever `saveStatus` changes; returns the unsubscribe. */
  subscribeStatus(fn: () => void): () => void;
  /** Critical keys whose latest value isn't on the disk yet. */
  unsaved(): string[];
}

export interface CachedStorageOptions {
  onWriteError?: (key: string, error: unknown) => void;
  /** Keys whose failed write may be dropped (caches). Default: none, all critical. */
  isDisposable?: (key: string) => boolean;
  /** Waits between retries of a failing write, the last repeating. */
  retryMs?: readonly number[];
}

export const RETRY_MS = [2000, 5000, 15000, 30000] as const;

/** Thrown by `flush()` while critical writes are unsaved. */
export class UnsavedError extends Error {
  constructor(readonly keys: readonly string[]) {
    super(`Not saved yet: ${keys.join(', ')}`);
    this.name = 'UnsavedError';
  }
}

export function createCachedStorage(
  backend: AsyncBackend,
  optionsOrOnWriteError: CachedStorageOptions | ((key: string, error: unknown) => void) = {},
): CachedStorage {
  const options: CachedStorageOptions =
    typeof optionsOrOnWriteError === 'function'
      ? { onWriteError: optionsOrOnWriteError }
      : optionsOrOnWriteError;
  const onWriteError = options.onWriteError ?? (() => {});
  const disposable = options.isDisposable ?? (() => false);
  const retryMs = options.retryMs?.length ? options.retryMs : RETRY_MS;

  const mem = new Map<string, string>();
  const subs = new Map<string, Set<() => void>>();
  const statusSubs = new Set<() => void>();
  /** Latest value per key not yet on the disk, in first-written order. */
  const queue = new Map<string, string>();
  let hydrated = false;
  let hydrating: Promise<void> | null = null;
  let draining: Promise<void> | null = null;
  let status: SaveStatus = 'saved';
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const notify = (key: string) => subs.get(key)?.forEach((fn) => fn());
  const unsaved = () => [...queue.keys()].filter((k) => !disposable(k));
  const setStatus = (next: SaveStatus) => {
    if (next === status) return;
    status = next;
    statusSubs.forEach((fn) => fn());
  };
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  /** One pass over the queue; true when nothing critical failed. */
  async function pass(): Promise<boolean> {
    let ok = true;
    for (const [k, v] of [...queue]) {
      try {
        await backend.setItem(k, v);
        if (queue.get(k) === v) queue.delete(k);
      } catch (e) {
        onWriteError(k, e);
        if (!disposable(k)) ok = false;
        else if (queue.get(k) === v) queue.delete(k);
      }
    }
    return ok;
  }

  /** Writes the queue; on a failure, schedules a retry (longer after each timed retry fails). */
  async function drain(timed: boolean): Promise<void> {
    clearTimer();
    while (queue.size) {
      if (!(await pass())) {
        setStatus(unsaved().length ? 'retrying' : 'saved');
        if (timed) attempt += 1;
        const wait = retryMs[Math.min(attempt, retryMs.length - 1)];
        timer = setTimeout(() => {
          timer = null;
          void kick(true);
        }, wait);
        return;
      }
    }
    attempt = 0;
    setStatus('saved');
  }

  function kick(timed = false): Promise<void> {
    if (!hydrated) return Promise.resolve();
    if (!draining) draining = drain(timed).finally(() => (draining = null));
    return draining;
  }

  async function load(): Promise<void> {
    const keys = await backend.getAllKeys();
    const pairs = keys.length ? await backend.multiGet(keys) : [];
    const read = new Map<string, string | null>();
    for (const [k, v] of pairs) read.set(k, v);
    const missing = keys.filter((k) => !read.has(k));
    if (missing.length)
      throw new Error(`Saved progress only partly read (${missing.length} missing)`);
    for (const [k, v] of read) {
      if (v === null) continue;
      // The disk wins over a write made before it was read: that write was made without
      // seeing the history (a save doc built on "nothing yet"), so it never replaces it.
      mem.set(k, v);
      queue.delete(k);
    }
    hydrated = true;
    for (const [k] of read) notify(k);
    void kick();
  }

  return {
    get hydrated() {
      return hydrated;
    },
    hydrate() {
      if (hydrated) return Promise.resolve();
      if (!hydrating) hydrating = load().finally(() => (hydrating = null));
      return hydrating;
    },
    getItem(key) {
      return mem.has(key) ? (mem.get(key) as string) : null;
    },
    setItem(key, value) {
      const v = String(value);
      mem.set(key, v);
      queue.set(key, v);
      void kick();
      notify(key);
    },
    subscribe(key, fn) {
      let set = subs.get(key);
      if (!set) subs.set(key, (set = new Set()));
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
    keys() {
      return [...mem.keys()];
    },
    async flush() {
      await kick();
      // A drain already under way may have failed before the latest writes: try once more.
      if (hydrated && queue.size) await kick();
      const left = unsaved();
      if (hydrated && left.length) throw new UnsavedError(left);
    },
    get saveStatus() {
      return status;
    },
    subscribeStatus(fn) {
      statusSubs.add(fn);
      return () => {
        statusSubs.delete(fn);
      };
    },
    unsaved,
  };
}
