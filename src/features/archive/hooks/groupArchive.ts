import type { PuzzleType } from '@noodle/core';

import { monthLabel } from '@/shared/time';

import type { ArchiveItem, ArchiveSection } from '../types';

/**
 * The archive as month sections, newest first: only `type` when given, and only the
 * puzzles you've finished (`done`) or not (`todo`) when asked, by the ids in `finished`.
 */
export type DoneFilter = 'all' | 'todo' | 'done';

export function groupArchive(
  items: readonly ArchiveItem[],
  type: PuzzleType | null,
  status: DoneFilter = 'all',
  finished: ReadonlySet<string> = new Set(),
): ArchiveSection[] {
  const kept = items
    .filter((it) => !type || it.type === type)
    .filter((it) => status === 'all' || (status === 'done') === finished.has(it.id))
    .slice()
    .sort((a, b) => (a.date === b.date ? a.path.localeCompare(b.path) : a.date < b.date ? 1 : -1));
  const sections: ArchiveSection[] = [];
  for (const it of kept) {
    const title = monthLabel(it.date);
    const last = sections.at(-1);
    if (last && last.title === title) last.data.push(it);
    else sections.push({ title, data: [it] });
  }
  return sections;
}
