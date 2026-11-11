/**
 * The Lab's trials as the app lists them, from feed-lite's Lab cards: each type's puzzles up
 * to today, which trials are running (a puzzle today or yesterday) and which are retired.
 */
import { LAB_TYPES, labRunning, type LabType } from '@noodle/core';
import { useMemo } from 'react';

import { useFeedLite, type LabFeedItem } from '@/shared/feed';
import { useLondonDay } from '@/shared/time';

export interface LabTrials {
  /** The running trials in the Lab's order, each with its newest puzzle (today's, or yesterday's). */
  current: LabFeedItem[];
  /** Every released Lab puzzle, newest first. */
  all: LabFeedItem[];
  /** Types whose trial has ended: their puzzles stay in the Archive, marked Retired. */
  retired: ReadonlySet<LabType>;
}

const EMPTY: LabFeedItem[] = [];

/** `items` (any order) as the Lab's trials on `today`. */
export function labTrials(items: readonly LabFeedItem[], today: string): LabTrials {
  const all = items
    .filter((it) => it.date <= today)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.path.localeCompare(b.path) : a.date < b.date ? 1 : -1));
  const current: LabFeedItem[] = [];
  const retired = new Set<LabType>();
  for (const type of LAB_TYPES) {
    const newest = all.find((it) => it.type === type);
    if (!newest) continue;
    if (labRunning(newest.date, today)) current.push(newest);
    else retired.add(type);
  }
  return { current, all, retired };
}

/** The Lab's trials today, from the kept card list (so it shows offline too). */
export function useLabTrials(): LabTrials {
  const feed = useFeedLite();
  const day = useLondonDay();
  const lab = feed.data?.lab ?? EMPTY;
  return useMemo(() => labTrials(lab, day), [lab, day]);
}

/**
 * The trial to offer after finishing `type`: the next running one in the Lab's order (wrapping),
 * skipping `type` itself and any already played (`done`), or null.
 */
export function nextTrial(
  current: readonly LabFeedItem[],
  type: LabType,
  done: (it: LabFeedItem) => boolean,
): LabFeedItem | null {
  const i = current.findIndex((it) => it.type === type);
  const order = i < 0 ? current : [...current.slice(i + 1), ...current.slice(0, i)];
  return order.find((it) => it.type !== type && !done(it)) ?? null;
}
