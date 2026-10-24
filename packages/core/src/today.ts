/** Today's list (`puzzles-today.json`) and the rule for trusting it. */
import { londonDay } from './london';
import { isPuzzleType, type PuzzleType } from './ids';

export interface TodayItem {
  type: PuzzleType;
  id: string;
  name: string;
  path: string;
}

export interface TodayList {
  today: string;
  items: TodayItem[];
}

/**
 * A list is today's only if it is dated the current London day and has items (the
 * finish sheet's rule). Otherwise the app says "Nearly ready" rather than show
 * yesterday's puzzles as today's.
 */
export function acceptToday(list: unknown, now?: Date | number): list is TodayList {
  if (!list || typeof list !== 'object') return false;
  const l = list as { today?: unknown; items?: unknown };
  return (
    l.today === londonDay(now) &&
    Array.isArray(l.items) &&
    l.items.length > 0 &&
    l.items.every(
      (it) =>
        !!it &&
        typeof it === 'object' &&
        isPuzzleType((it as TodayItem).type) &&
        typeof (it as TodayItem).id === 'string' &&
        typeof (it as TodayItem).path === 'string',
    )
  );
}
