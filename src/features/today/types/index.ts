import type { TodayList } from '@noodle/core';

/** What the Today screen can show. */
export type TodayStatus =
  | { kind: 'loading' }
  /** `offline`: the last try to reach the site found no connection (the list is the kept one). */
  | { kind: 'ready'; list: TodayList; stale: boolean; offline: boolean }
  /** The site's list is still yesterday's: today's build hasn't run yet (usually before 4-5 am). */
  | { kind: 'nearly' }
  /** No list for today and the phone looks offline. */
  | { kind: 'offline' }
  /** No list for today: the phone is online but the site's list couldn't be loaded. */
  | { kind: 'failed' };
