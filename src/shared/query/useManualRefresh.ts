import { useRef, useState } from 'react';

interface Refetchable {
  /** React Query's: when the data last arrived. */
  dataUpdatedAt: number;
  /** React Query's: the last attempt's error, kept while retries carry on. */
  failureReason: unknown;
}

interface Pull {
  dataUpdatedAt: number;
  failureReason: unknown;
}

/**
 * Pull-to-refresh's spinner: shown from the pull until that fetch's first answer, new data
 * or a failed attempt, and never for the quiet refetches React Query makes on its own.
 * Retries after a failure carry on behind the page without holding the spinner.
 */
export function useManualRefresh(q: Refetchable, run: () => Promise<unknown>) {
  const [pull, setPull] = useState<Pull | null>(null);
  const gen = useRef(0);
  const answered =
    pull !== null &&
    (q.dataUpdatedAt !== pull.dataUpdatedAt ||
      (q.failureReason != null && q.failureReason !== pull.failureReason));
  if (answered) setPull(null);
  const refresh = () => {
    const mine = ++gen.current;
    setPull({ dataUpdatedAt: q.dataUpdatedAt, failureReason: q.failureReason });
    void run()
      .catch(() => undefined)
      .finally(() => {
        if (gen.current === mine) setPull(null);
      });
  };
  return { refreshing: pull !== null && !answered, refresh };
}
