import { BOARD_TYPE, type BoardTypeId } from '@noodle/core';

import { onFinish, onVisit, type PuzzleFinish, type PuzzleVisit } from '@/shared/results';

import { pageId, type Tracker } from './tracker';

/**
 * Turns native puzzles' lifecycle (shared/results) into the website's events:
 * open → page_view, start → puzzle_start, finish → puzzle_end. Finishes the site's own
 * page reported (source 'page') are skipped: its tracker recorded them already. A
 * finish with no start recorded sends a flagged late start first, as dn-track.js does.
 */
export function createRecorder(tracker: Tracker, uuid: () => string) {
  const visits = new Map<string, { pv: string; started: boolean }>();
  const visit = (path: string) => {
    let v = visits.get(path);
    if (!v) {
      v = { pv: pageId(uuid), started: false };
      visits.set(path, v);
    }
    return v;
  };
  const slug = (type: PuzzleVisit['type']): string =>
    type && type in BOARD_TYPE ? BOARD_TYPE[type as BoardTypeId].tv : '';

  function heardVisit(e: PuzzleVisit): void {
    if (e.ev === 'open') {
      const v = { pv: pageId(uuid), started: false };
      visits.set(e.path, v);
      tracker.pageView(e.path, v.pv, 'puzzle');
      return;
    }
    const v = visit(e.path);
    if (v.started) return;
    v.started = true;
    tracker.track('puzzle_start', { type: slug(e.type), tv: 3 }, e.path, v.pv);
  }

  function heardFinish(f: PuzzleFinish): void {
    if (f.source === 'page') return;
    const v = visit(f.path);
    const type = typeof f.detail.type === 'string' ? f.detail.type : slug(f.type);
    if (!v.started) {
      v.started = true;
      tracker.track('puzzle_start', { type, tv: 3, late: true }, f.path, v.pv);
    }
    tracker.track('puzzle_end', { ...f.detail, type, tv: 3 }, f.path, v.pv);
    tracker.flush();
  }

  return {
    /** Listen to the bus; returns the unsubscribe. */
    listen(): () => void {
      const a = onVisit(heardVisit);
      const b = onFinish(heardFinish);
      return () => {
        a();
        b();
      };
    },
    /** One of the app's own lists opened, recorded as the site page it stands for. */
    screen(path: string): void {
      tracker.pageView(path, pageId(uuid), '');
    },
  };
}

export type Recorder = ReturnType<typeof createRecorder>;
