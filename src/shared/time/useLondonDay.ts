import { londonDay } from '@noodle/core';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Milliseconds until the London day next changes (checked a minute at a time near it). */
export function msToNextLondonDay(now: number = Date.now()): number {
  const today = londonDay(now);
  // Step forward an hour at a time, then a minute at a time; London days are 23-25 h.
  let t = now;
  while (londonDay(t + 3_600_000) === today) t += 3_600_000;
  while (londonDay(t) === today) t += 60_000;
  return Math.max(1_000, t - now);
}

/** Today's London day, updated at midnight and whenever the app comes back to the front. */
export function useLondonDay(): string {
  const [day, setDay] = useState(() => londonDay());
  useEffect(() => {
    const check = () => setDay(londonDay());
    const timer = setTimeout(check, msToNextLondonDay());
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [day]);
  return day;
}
