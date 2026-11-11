/** A Lab trial's plays (11 Nov 2026): recorded like the website's, never sent to a league. */
import { submitArgs } from '@noodle/core';

import { announceFinish, announceVisit } from '@/shared/results';

import { createRecorder } from '../recorder';

const PATH = 'reports/2026-11-11-word-tumbler-0025.html';

describe('GIVEN a Lab puzzle played natively', () => {
  it('WHEN it opens, starts and finishes THEN the events carry its own slug', () => {
    const tracker = { track: jest.fn(), pageView: jest.fn(), flush: jest.fn(), pending: () => 0 };
    let n = 0;
    const off = createRecorder(tracker, () => `id-${++n}`).listen();
    try {
      announceVisit({ ev: 'open', path: PATH, type: null, slug: 'word-tumbler' });
      announceVisit({ ev: 'start', path: PATH, type: null, slug: 'word-tumbler' });
      const detail = { type: 'word-tumbler', tv: 3, outcome: 'solved', secs: 40 };
      announceFinish({ path: PATH, type: null, detail });
      expect(tracker.pageView).toHaveBeenCalledWith(PATH, expect.any(String), 'puzzle');
      expect(tracker.track.mock.calls.map((c) => [c[0], c[1].type])).toEqual([
        ['puzzle_start', 'word-tumbler'],
        ['puzzle_end', 'word-tumbler'],
      ]);
    } finally {
      off();
    }
  });
  it('THEN its finish is never a league result', () => {
    expect(submitArgs('p', PATH, { type: 'word-tumbler', outcome: 'solved', secs: 40 })).toBeNull();
  });
});
