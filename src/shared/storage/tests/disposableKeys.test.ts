import { LAST_FEED_KEY } from '@/shared/feed';
import { TODAY_CACHE_KEY } from '@/shared/today';

import { isDisposableKey } from '../appStorage';

describe('GIVEN the app’s storage keys', () => {
  describe('WHEN a write fails', () => {
    it('THEN only caches may be dropped; results, streaks and the league identity are critical', () => {
      for (const k of [
        TODAY_CACHE_KEY,
        LAST_FEED_KEY,
        'noodle-app-puzzle:mini-100',
        'noodle-app-sync',
        'noodle-board-pinlater',
        'digi.sid',
        'digi.last',
      ])
        expect(isDisposableKey(k)).toBe(true);
      for (const k of [
        'digi-mini-v1',
        'digi-mini-streak',
        'digi-tangle-v1',
        'digi-borderline-v1',
        'digi.aid',
        'digi.aid.prev',
        'digi.optout',
        'noodle-board-v1',
        'noodle-app-progress-mini',
      ])
        expect(isDisposableKey(k)).toBe(false);
    });
  });
});
