import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';

import { appStorage } from '@/shared/storage';

/**
 * The store's own "rate this app" sheet (ADR-010; Alec, 10 Nov 2026): asked for at most once
 * per app version, on a fresh win of today's puzzle that puts the type's day streak at
 * REVIEW_STREAK or more. The store decides whether its sheet actually shows (Google and
 * Apple both ration it), tells the app nothing either way, and never shows it outside a
 * store install, so this only ever asks; it can't nag.
 */
export const REVIEW_STREAK = 5;
/** After the sheet's entrance and jingle, so the question never covers the result as it lands. */
export const REVIEW_DELAY_MS = 2500;
/** The app version that last asked. A plain string; not a result, so safe to lose. */
export const REVIEW_KEY = 'noodle-app-review';

export interface ReviewMoment {
  /** The finish happened on this screen, just now (never a reopened puzzle). */
  celebrate: boolean;
  solved: boolean;
  /** The puzzle is today's, not one from the archive. */
  today: boolean;
  /** The type's day streak after this finish. */
  streak: number;
}

/** Whether this finish is the moment to ask, for this version. */
export function shouldAsk(m: ReviewMoment, version: string, asked: string | null): boolean {
  return m.celebrate && m.solved && m.today && m.streak >= REVIEW_STREAK && asked !== version;
}

/**
 * Ask the store for its rating sheet if this is the moment. Marks the version as asked
 * before asking, so a crash or a second finish can't ask twice. Never throws.
 */
export async function askForReview(
  m: ReviewMoment,
  version: string = Constants.expoConfig?.version ?? '0.0.0',
): Promise<boolean> {
  try {
    if (!shouldAsk(m, version, appStorage.getItem(REVIEW_KEY))) return false;
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return false;
    appStorage.setItem(REVIEW_KEY, version);
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
