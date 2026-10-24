/**
 * The finish sheet's rules, ported from dailynoodle engines/finish.js: the Next row
 * (fillNext), the countdown to the next London day (toMidnight, hm) and its run line.
 */
import {
  PUZZLE_TYPES,
  saveKey,
  type PuzzleType,
  type TodayItem,
  type TodayList,
} from '@noodle/core';

type Docs = Record<string, unknown>;

function doneOf(docs: Docs, type: PuzzleType): Record<string, unknown> {
  const s = docs[saveKey(type)] as { done?: unknown } | null | undefined;
  return s && s.done && typeof s.done === 'object' ? (s.done as Record<string, unknown>) : {};
}

export interface NextRow {
  main: string;
  sub: string;
  /** The puzzle to open, or null for today's list. */
  item: TodayItem | null;
}

/** "Next: Doku 103" / "3 of 8 played today", from today's list and the saves. */
export function nextRow(list: TodayList | null | undefined, type: PuzzleType, docs: Docs): NextRow {
  if (!list) return { main: 'Today’s puzzles', sub: ' ', item: null };
  const items = list.items;
  let played = 0;
  for (const it of items) if (doneOf(docs, it.type)[it.id]) played++;
  const start = PUZZLE_TYPES.indexOf(type);
  let next: TodayItem | null = null;
  for (let k = 1; k <= PUZZLE_TYPES.length && !next; k++) {
    const t = PUZZLE_TYPES[(start + k) % PUZZLE_TYPES.length]!;
    for (const it of items) if (!next && it.type === t && !doneOf(docs, t)[it.id]) next = it;
  }
  const sub = `${played} of ${items.length} played today`;
  return next
    ? { main: `Next: ${next.name}`, sub, item: next }
    : { main: 'All today’s puzzles done', sub, item: null };
}

/** Seconds until the next London midnight. */
export function toMidnight(now: Date | number = Date.now()): number {
  const p: Record<string, number> = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(now))
    .forEach((x) => {
      p[x.type] = +x.value;
    });
  return 86400 - ((p.hour ?? 0) * 3600 + (p.minute ?? 0) * 60 + (p.second ?? 0));
}

/** "5h 12m", "48m", "1m". */
export function hm(s: number): string {
  let h = Math.floor(s / 3600);
  let m = Math.ceil((s % 3600) / 60);
  if (m === 60) {
    h++;
    m = 0;
  }
  return h ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
}

export interface ClockLine {
  /** Before the bold part. */
  lead: string;
  bold: string | null;
  after: string;
  run: number;
}

/** The countdown line's parts: "A new Mini in **5h 12m**." plus the run, as finish.js paints it. */
export function clockLine(name: string, s: number, run: number): ClockLine {
  if (s <= 60 || s >= 86340)
    return { lead: 'Today’s puzzles are out.', bold: null, after: '', run };
  return { lead: `A new ${name} in `, bold: hm(s), after: '.', run };
}
