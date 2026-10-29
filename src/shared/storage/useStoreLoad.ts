import { useCallback, useEffect, useState } from 'react';

import { appStorage } from './appStorage';
import type { CachedStorage } from './cachedStorage';

/** `failed`: the saves couldn't be read; `retrying`: Try again pressed, reading again. */
export type StoreLoad = 'loading' | 'ready' | 'failed' | 'retrying';

/**
 * Reads the saves at launch. A failed read is a state of its own (hardening R2), never
 * "ready": the app shows "Couldn't load your saves" with Try again rather than running on
 * an empty store whose next save would write over the history it couldn't read.
 */
export function useStoreLoad(store: CachedStorage = appStorage): {
  state: StoreLoad;
  retry: () => void;
} {
  const [state, setState] = useState<StoreLoad>(store.hydrated ? 'ready' : 'loading');
  const run = useCallback(() => {
    store.hydrate().then(
      () => setState('ready'),
      (e: unknown) => {
        console.warn('Saved progress could not be read', e);
        setState('failed');
      },
    );
  }, [store]);
  useEffect(() => {
    if (!store.hydrated) run();
  }, [run, store]);
  const retry = useCallback(() => {
    setState('retrying');
    run();
  }, [run]);
  return { state, retry };
}
