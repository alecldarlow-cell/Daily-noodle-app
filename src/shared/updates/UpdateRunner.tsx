import { usePathname } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { appStorage } from '@/shared/storage';

import { createUpdater, type UpdatesApi } from './updater';

/** Mounted once at the root: looks for updates as the app comes back to the front. */
export function UpdateRunner({ updates = Updates as UpdatesApi }: { updates?: UpdatesApi }) {
  const path = usePathname();
  const where = useRef(path);
  useEffect(() => {
    where.current = path;
  }, [path]);
  useEffect(() => {
    const updater = createUpdater({
      updates,
      canApply: () => where.current === '/',
      flush: () => appStorage.flush(),
    });
    void updater.onActive();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void updater.onActive();
      else updater.onAway();
    });
    return () => sub.remove();
  }, [updates]);
  return null;
}
