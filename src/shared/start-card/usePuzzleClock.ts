import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

interface ClockOptions {
  now?: () => number;
  /** Change it to put the clock back to zero (Sweep's Play again: a new round). */
  reset?: unknown;
}

/**
 * The seconds a grid player's clock shows. It adds up wall-clock time while `running`
 * and the app is in front, and stops while the app is away (another app, the lock
 * screen): time away never counts, as Borders, Reckon and Tangle already do. The shown
 * seconds move once a second; `read()` gives the exact whole seconds at that moment
 * (Path's finish time).
 */
export function usePuzzleClock(running: boolean, opts: ClockOptions = {}) {
  const now = opts.now ?? Date.now;
  const { reset } = opts;
  const [secs, setSecs] = useState(0);
  const [away, setAway] = useState(false);
  const acc = useRef(0);
  const since = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAway(st !== 'active'));
    return () => sub?.remove();
  }, []);

  // A new round: back to zero (the counting effect below has already banked its time).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    acc.current = 0;
    setSecs(0);
  }, [reset]);

  const counting = running && !away;
  useEffect(() => {
    if (!counting) return;
    const from = now();
    since.current = from;
    const h = setInterval(() => setSecs(Math.floor((acc.current + now() - from) / 1000)), 1000);
    return () => {
      clearInterval(h);
      acc.current += now() - from;
      since.current = null;
    };
  }, [counting, now, reset]);

  const read = useCallback(() => {
    const live = since.current === null ? 0 : now() - since.current;
    return Math.floor((acc.current + live) / 1000);
  }, [now]);

  return { secs, read };
}
