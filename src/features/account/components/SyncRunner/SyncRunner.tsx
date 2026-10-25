import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { onFinish } from '@/shared/results';
import { appStorage, type CachedStorage } from '@/shared/storage';

import { authClient } from '../../api/authClient';
import { syncNow } from '../../hooks/useAccount';

/**
 * Keeps a signed-in player's saves in step: on opening the app, on coming back to it,
 * and a moment after every finished puzzle. Mounted once at the root. Does nothing when
 * sync is off or nobody is signed in; a failed sync (no signal) just waits for the next.
 */
export function SyncRunner({
  client = authClient(),
  store = appStorage,
  delayMs = 3000,
}: {
  client?: SupabaseClient | null;
  store?: CachedStorage;
  delayMs?: number;
}) {
  const busy = useRef(false);
  useEffect(() => {
    if (!client) return;
    const run = () => {
      if (busy.current) return;
      busy.current = true;
      syncNow(store, client)
        .catch(() => {})
        .finally(() => {
          busy.current = false;
        });
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    };
    run();
    const offFinish = onFinish(later);
    const app = AppState.addEventListener('change', (s) => s === 'active' && run());
    const { data } = client.auth.onAuthStateChange((e) => e === 'SIGNED_IN' && run());
    return () => {
      clearTimeout(timer);
      offFinish();
      app.remove();
      data.subscription.unsubscribe();
    };
  }, [client, store, delayMs]);
  return null;
}
