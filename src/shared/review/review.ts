import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';

import { appStorage } from '@/shared/storage';
import { appRecorder } from '@/shared/track';

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
  /** The puzzle type, for the anonymous ask record. */
  type?: string;
}

/**
 * Records that the app asked the store for its sheet ('review_ask'), or wanted to and the
 * store said it couldn't ('review_skip'), as an anonymous event like `archive_open` (Alec,
 * 20 Nov 2026: no ratings yet, so count the asks). The store never says whether its sheet
 * showed, so this counts asks, not ratings. Never a nickname, email or player id.
 */
export type ReviewLog = (ev: 'review_ask' | 'review_skip', props: Record<string, unknown>) => void;

let skipSaid = false;

/** For tests: forget that this launch already recorded a skip. */
export function resetReviewLog(): void {
  skipSaid = false;
}

const appLog: ReviewLog = (ev, props) => appRecorder.event(ev, props, 'review');

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
  log: ReviewLog = appLog,
): Promise<boolean> {
  try {
    if (!shouldAsk(m, version, appStorage.getItem(REVIEW_KEY))) return false;
    const props = { type: m.type ?? '', streak: m.streak, v: version };
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) {
      // Once per launch: the version keeps its one go, so every later win would say it again.
      if (!skipSaid) safeLog(log, 'review_skip', props);
      skipSaid = true;
      return false;
    }
    appStorage.setItem(REVIEW_KEY, version);
    safeLog(log, 'review_ask', props);
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

function safeLog(log: ReviewLog, ev: 'review_ask' | 'review_skip', props: Record<string, unknown>) {
  try {
    log(ev, props);
  } catch {
    // Recording must never stop the ask.
  }
}
