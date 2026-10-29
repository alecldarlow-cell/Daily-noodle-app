import { isDisposableKey } from '@/shared/storage';

import { PUZZLE_CACHE_PREFIX } from '../api/usePuzzleData';
import { progressKey } from '../progress';

describe('GIVEN a downloaded puzzle’s data and a round in progress', () => {
  describe('WHEN their writes fail', () => {
    it('THEN the data may be dropped (it downloads again) but the round is kept for retry', () => {
      expect(isDisposableKey(`${PUZZLE_CACHE_PREFIX}mini-100`)).toBe(true);
      expect(isDisposableKey(progressKey('mini'))).toBe(false);
    });
  });
});
