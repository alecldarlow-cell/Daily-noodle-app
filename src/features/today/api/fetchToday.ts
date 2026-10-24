import type { TodayList } from '@noodle/core';

import { getJson } from '@/shared/net';

/** Today's eight puzzles as the site's build lists them. */
export function fetchToday(): Promise<TodayList> {
  return getJson<TodayList>('puzzles-today.json');
}
