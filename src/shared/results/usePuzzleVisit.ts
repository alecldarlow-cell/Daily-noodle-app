import type { PuzzleType } from '@noodle/core';
import { useCallback, useEffect, useRef } from 'react';

import { announceVisit } from './finishBus';

/**
 * For a native puzzle screen: announces the open once, and returns `start`, which
 * announces the start once (call it where the page's tracker would count a start:
 * Play on the start card). A finished puzzle reopened is never a new start.
 */
export function usePuzzleVisit(path: string, type: PuzzleType, finished = false): () => void {
  const started = useRef(false);
  useEffect(() => {
    announceVisit({ ev: 'open', path, type });
  }, [path, type]);
  return useCallback(() => {
    if (started.current || finished) return;
    started.current = true;
    announceVisit({ ev: 'start', path, type });
  }, [path, type, finished]);
}
