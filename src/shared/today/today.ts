/**
 * Today's list as more than one screen needs it: the Today tab, and the finish
 * sheet's Next row (which the site fills from the same file, puzzles-today.json).
 */
import { acceptToday, type TodayList } from '@noodle/core';

import { getJson } from '@/shared/net';
import { appStorage, type CachedStorage } from '@/shared/storage';

/** App-only key: the last list accepted for its day, so today works offline. */
export const TODAY_CACHE_KEY = 'noodle-app-today';

/** The kept list, if it is `day`'s. */
export function cachedToday(day: string, store: CachedStorage = appStorage): TodayList | undefined {
  try {
    const list: unknown = JSON.parse(store.getItem(TODAY_CACHE_KEY) ?? 'null');
    return acceptToday(list) && list.today === day ? list : undefined;
  } catch {
    return undefined;
  }
}

/** Today's eight puzzles as the site's build lists them. */
export function fetchToday(): Promise<TodayList> {
  return getJson<TodayList>('puzzles-today.json');
}
