/**
 * Each puzzle's latest result on its way to the board, so the finish sheet's board slot
 * can wait for it before asking board_moment (dn-board.js keeps `submitted` for the
 * page's one puzzle; the app keeps one per path). The promise never rejects: as the
 * site, a failed send is let go and the moment is asked for anyway.
 */
const sent = new Map<string, { n: number; done: Promise<void> }>();
const listeners = new Set<() => void>();
let count = 0;

export function recordSubmission(path: string, p: Promise<unknown>): void {
  sent.set(path, {
    n: ++count,
    done: p.then(
      () => undefined,
      () => undefined,
    ),
  });
  for (const fn of [...listeners]) fn();
}

/** The latest submission of `path` (n 0 and already done when there is none). */
export function submissionOf(path: string): { n: number; done: Promise<void> } {
  return sent.get(path) ?? { n: 0, done: Promise.resolve() };
}

export function onSubmission(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Tests only. */
export function clearSubmissions(): void {
  sent.clear();
}
