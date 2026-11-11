import * as StoreReview from 'expo-store-review';

import { appStorage } from '@/shared/storage';

import { askForReview, REVIEW_KEY, REVIEW_STREAK, shouldAsk, type ReviewMoment } from '../review';

const store = StoreReview as jest.Mocked<typeof StoreReview>;
const WIN: ReviewMoment = { celebrate: true, solved: true, today: true, streak: REVIEW_STREAK };

beforeEach(() => {
  appStorage.removeItem(REVIEW_KEY);
  store.isAvailableAsync.mockReset().mockResolvedValue(true);
  store.hasAction.mockReset().mockResolvedValue(true);
  store.requestReview.mockReset().mockResolvedValue(undefined);
});

describe('GIVEN a player finishing a puzzle (ADR-010)', () => {
  describe('WHEN it is a fresh win of today’s puzzle on a five-day streak', () => {
    it('THEN the store is asked for its rating sheet, and the version is remembered', async () => {
      await expect(askForReview(WIN, '0.5.0')).resolves.toBe(true);
      expect(store.requestReview).toHaveBeenCalledTimes(1);
      expect(appStorage.getItem(REVIEW_KEY)).toBe('0.5.0');
    });

    it('THEN a second win on the same version never asks again', async () => {
      await askForReview(WIN, '0.5.0');
      await expect(askForReview({ ...WIN, streak: 40 }, '0.5.0')).resolves.toBe(false);
      expect(store.requestReview).toHaveBeenCalledTimes(1);
    });

    it('THEN a new app version may ask once more', async () => {
      await askForReview(WIN, '0.5.0');
      await expect(askForReview(WIN, '0.6.0')).resolves.toBe(true);
      expect(store.requestReview).toHaveBeenCalledTimes(2);
      expect(appStorage.getItem(REVIEW_KEY)).toBe('0.6.0');
    });
  });

  describe('WHEN it is not that moment', () => {
    it.each([
      ['a streak of four', { ...WIN, streak: REVIEW_STREAK - 1 }],
      ['a lost round', { ...WIN, solved: false }],
      ['a puzzle from the archive', { ...WIN, today: false }],
      ['a finished puzzle reopened', { ...WIN, celebrate: false }],
    ])('THEN %s asks nothing and uses nothing up', async (_label, moment) => {
      expect(shouldAsk(moment, '0.5.0', null)).toBe(false);
      await expect(askForReview(moment, '0.5.0')).resolves.toBe(false);
      expect(store.isAvailableAsync).not.toHaveBeenCalled();
      expect(store.requestReview).not.toHaveBeenCalled();
      expect(appStorage.getItem(REVIEW_KEY)).toBeNull();
    });
  });

  describe('WHEN the store can’t show its sheet (a preview build, no Play Store)', () => {
    it.each([
      ['not available', () => store.isAvailableAsync.mockResolvedValue(false)],
      ['no action', () => store.hasAction.mockResolvedValue(false)],
    ])('THEN %s: nothing is asked and the version keeps its one go', async (_label, arrange) => {
      arrange();
      await expect(askForReview(WIN, '0.5.0')).resolves.toBe(false);
      expect(store.requestReview).not.toHaveBeenCalled();
      expect(appStorage.getItem(REVIEW_KEY)).toBeNull();
    });

    it('THEN a store error is swallowed: the finish sheet is never disturbed', async () => {
      store.requestReview.mockRejectedValue(new Error('no store'));
      await expect(askForReview(WIN, '0.5.0')).resolves.toBe(false);
      expect(appStorage.getItem(REVIEW_KEY)).toBe('0.5.0');
    });
  });
});
