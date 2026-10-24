import { useCallback, useSyncExternalStore } from 'react';

import { appStorage } from './appStorage';
import type { CachedStorage } from './cachedStorage';

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * The raw string at `key`, re-rendering when it changes. Strings are stable between
 * changes, so React can compare snapshots cheaply.
 */
export function useStoredRaw(key: string, store: CachedStorage = appStorage): string | null {
  const subscribe = useCallback((fn: () => void) => store.subscribe(key, fn), [store, key]);
  return useSyncExternalStore(subscribe, () => store.getItem(key));
}

/** Several keys' parsed JSON, re-rendering when any of them changes. */
export function useStoredDocs(
  keys: readonly string[],
  store: CachedStorage = appStorage,
): Record<string, unknown> {
  const joined = keys.join('\n');
  const subscribe = useCallback(
    (fn: () => void) => {
      const offs = joined.split('\n').map((k) => store.subscribe(k, fn));
      return () => offs.forEach((off) => off());
    },
    [store, joined],
  );
  // Snapshot: the raw strings joined, stable until one changes.
  const snapshot = useSyncExternalStore(subscribe, () =>
    joined
      .split('\n')
      .map((k) => store.getItem(k) ?? '')
      .join('\u0000'),
  );
  const raws = snapshot.split('\u0000');
  const out: Record<string, unknown> = {};
  joined.split('\n').forEach((k, i) => {
    out[k] = parse(raws[i] || null);
  });
  return out;
}
