import { uuid } from 'expo';

import { appStorage } from '@/shared/storage';

import { createRecorder } from './recorder';
import { createTracker, type TrackEvent } from './tracker';

/**
 * The app's recorder, sending to the site's `log_events` with the public key. Off in
 * development builds (as the website records nothing from automated browsers), and when
 * the build has no Supabase settings.
 */
export function logEventsSender(
  env: Record<string, string | undefined> = process.env,
  dev: boolean = __DEV__,
  post: typeof fetch = fetch,
): (batch: TrackEvent[]) => Promise<unknown> {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (dev || !url || !key) return async () => undefined;
  return (batch) =>
    post(`${url}/rest/v1/rpc/log_events`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch }),
    });
}

export const appTracker = createTracker({
  store: appStorage,
  send: logEventsSender(),
  uuid: () => uuid.v4(),
});
export const appRecorder = createRecorder(appTracker, () => uuid.v4());
