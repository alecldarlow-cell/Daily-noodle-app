import type { PuzzleType } from '@noodle/core';
import { useCallback, useEffect, useRef } from 'react';

import { announceVisit } from './finishBus';

/**
 * For a native puzzle screen: announces the open once, and returns `start`, which
 * announces the start once (call it where the page's tracker would count a start:
 * Play on the start card). A finished puzzle reopened is never a new start.
 */
export function usePuzzleVisit(
  path: string,
  type: PuzzleType | null,
  finished = false,
  /** A Lab trial has no daily type: its tracker slug ("word-redact") names it instead. */
  slug?: string,
): () => void {
  const started = useRef(false);
  useEffect(() => {
    announceVisit({ ev: 'open', path, type, ...(slug ? { slug } : {}) });
  }, [path, type, slug]);
  return useCallback(() => {
    if (started.current || finished) return;
    started.current = true;
    announceVisit({ ev: 'start', path, type, ...(slug ? { slug } : {}) });
  }, [path, type, finished, slug]);
}
