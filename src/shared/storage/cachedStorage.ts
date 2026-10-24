/**
 * The app's key-value store. @noodle/core's save rules need synchronous reads and
 * writes (as localStorage gives the site), and AsyncStorage is asynchronous, so this
 * keeps every key in memory, hydrated once at launch, and writes through to the
 * backend in the background. Keys are the site's own (`digi-mini-v1`…), verbatim.
 */
import type { KV } from '@noodle/core';

export interface AsyncBackend {
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  setItem(key: string, value: string): Promise<void>;
}

export interface CachedStorage extends KV {
  /** Load everything from the backend; call once before first use. */
  hydrate(): Promise<void>;
  readonly hydrated: boolean;
  /** Run `fn` whenever `key` changes; returns the unsubscribe. */
  subscribe(key: string, fn: () => void): () => void;
  /** Every key held. */
  keys(): string[];
  /** Resolves when every write so far has reached the backend. */
  flush(): Promise<void>;
}

export function createCachedStorage(
  backend: AsyncBackend,
  onWriteError: (key: string, error: unknown) => void = () => {},
): CachedStorage {
  const mem = new Map<string, string>();
  const subs = new Map<string, Set<() => void>>();
  let hydrated = false;
  let pending: Promise<unknown> = Promise.resolve();

  const notify = (key: string) => subs.get(key)?.forEach((fn) => fn());

  return {
    get hydrated() {
      return hydrated;
    },
    async hydrate() {
      const keys = await backend.getAllKeys();
      const pairs = keys.length ? await backend.multiGet(keys) : [];
      for (const [k, v] of pairs) {
        // A key written in memory before hydration finished is newer; keep it.
        if (v !== null && !mem.has(k)) mem.set(k, v);
      }
      hydrated = true;
      for (const [k] of pairs) notify(k);
    },
    getItem(key) {
      return mem.has(key) ? (mem.get(key) as string) : null;
    },
    setItem(key, value) {
      const v = String(value);
      mem.set(key, v);
      pending = pending.then(() => backend.setItem(key, v)).catch((e) => onWriteError(key, e));
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
    flush() {
      return pending.then(() => undefined);
    },
  };
}
