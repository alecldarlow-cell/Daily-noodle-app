import type { PuzzleType } from '@noodle/core';

import type { ArchiveItem } from '../types';

/** One square of the month: a blank before the 1st, a day with no puzzles, or a day to open. */
export type CalendarCell =
  | { kind: 'blank'; key: string }
  | { kind: 'none'; key: string; day: number }
  | { kind: 'day'; key: string; day: number; date: string; total: number; done: number };

/** "2026-10" → "2026-11" (k = 1) or "2026-09" (k = -1). */
export function addMonth(m: string, k: number): string {
  let y = +m.slice(0, 4);
  let n = +m.slice(5, 7) - 1 + k;
  y += Math.floor(n / 12);
  n = ((n % 12) + 12) % 12;
  return `${y}-${String(n + 1).padStart(2, '0')}`;
}

/**
 * The archive's days, as the website's archive.html: released puzzles before `before` (today's
 * London day; today's set is on the Today tab, AF-030), by date, in the daily order; only `type`
 * when given. Never a forward-dated puzzle: feed-lite lists none, and `before` cuts today.
 */
export function archiveDays(
  items: readonly ArchiveItem[],
  before: string,
  type: PuzzleType | null,
  order: readonly PuzzleType[],
): Record<string, ArchiveItem[]> {
  const out: Record<string, ArchiveItem[]> = {};
  for (const it of items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date) || it.date >= before) continue;
    if (type && it.type !== type) continue;
    (out[it.date] ??= []).push(it);
  }
  for (const d of Object.keys(out))
    out[d]!.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return out;
}

/** The first and last months with puzzles (all types), or null when there are none. */
export function monthRange(days: Record<string, unknown>): { first: string; last: string } | null {
  const keys = Object.keys(days).sort();
  if (!keys.length) return null;
  return { first: keys[0]!.slice(0, 7), last: keys[keys.length - 1]!.slice(0, 7) };
}

/** The month's squares, Monday first, each day with how many of its puzzles are finished. */
export function monthCells(
  month: string,
  days: Record<string, ArchiveItem[]>,
  finished: ReadonlySet<string>,
): CalendarCell[] {
  const y = +month.slice(0, 4);
  const mo = +month.slice(5, 7);
  const lead = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ kind: 'blank', key: `b${i}` });
  for (let d = 1; d <= count; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const list = days[date];
    if (!list?.length) cells.push({ kind: 'none', key: date, day: d });
    else
      cells.push({
        kind: 'day',
        key: date,
        day: d,
        date,
        total: list.length,
        done: list.filter((it) => finished.has(it.id)).length,
      });
  }
  return cells;
}
