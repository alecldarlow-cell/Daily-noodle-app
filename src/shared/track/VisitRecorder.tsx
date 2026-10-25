import { useEffect } from 'react';
import { AppState } from 'react-native';

import { appRecorder, appTracker } from './app';
import type { Recorder } from './recorder';
import type { Tracker } from './tracker';

/** Mounted once at the root: records native plays, sends every 10 s and when the app is put away. */
export function VisitRecorder({
  recorder = appRecorder,
  tracker = appTracker,
}: {
  recorder?: Recorder;
  tracker?: Tracker;
}) {
  useEffect(() => {
    const off = recorder.listen();
    const h = setInterval(() => tracker.flush(), 10_000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') tracker.flush();
    });
    return () => {
      off();
      clearInterval(h);
      sub.remove();
    };
  }, [recorder, tracker]);
  return null;
}
