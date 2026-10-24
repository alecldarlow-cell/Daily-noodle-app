import type { TodayList } from '@noodle/core';

/** What the Today screen can show. */
export type TodayStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; list: TodayList; stale: boolean }
  /** The site's list is still yesterday's: today's build hasn't run yet (usually before 4-5 am). */
  | { kind: 'nearly' }
  /** No list for today and the site can't be reached. */
  | { kind: 'offline' };
