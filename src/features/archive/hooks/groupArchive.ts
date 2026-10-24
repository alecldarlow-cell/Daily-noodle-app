import type { PuzzleType } from '@noodle/core';

import { monthLabel } from '@/shared/time';

import type { ArchiveItem, ArchiveSection } from '../types';

/**
 * The archive as month sections, newest first: only `type` when given, and only
 * puzzles whose number starts with `query` when it holds digits ("10" finds 10, 100…).
 */
export function groupArchive(
  items: readonly ArchiveItem[],
  type: PuzzleType | null,
  query: string,
): ArchiveSection[] {
  const digits = query.replace(/\D/g, '');
  const kept = items
    .filter((it) => !type || it.type === type)
    .filter((it) => !digits || (/(\d+)\s*$/.exec(it.headline)?.[1] ?? '').startsWith(digits))
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
