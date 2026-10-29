/**
 * The finish sheet's rules, ported from dailynoodle engines/finish.js: the Play more row
 * (fillNext), the countdown to the next London day (toMidnight, hm), the day streak line
 * and which round counts as solved (AF-019, 29 Oct 2026).
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
  /** The puzzle to open, or null for today's list (or the archive, when `all`). */
  item: TodayItem | null;
  /** Every puzzle today is done: a quiet line to the archive instead of a button. */
  all: boolean;
}

/**
 * "Play Doku 103" / "3 of 8 done today", from today's list and the saves; once every
 * puzzle is done, "All 8 done today. Try the archive ›" (finish.js fillNext).
 */
export function nextRow(list: TodayList | null | undefined, type: PuzzleType, docs: Docs): NextRow {
  if (!list) return { main: 'Today’s puzzles', sub: ' ', item: null, all: false };
  const items = list.items;
  let played = 0;
  for (const it of items) if (doneOf(docs, it.type)[it.id]) played++;
  const start = PUZZLE_TYPES.indexOf(type);
  let next: TodayItem | null = null;
  for (let k = 1; k <= PUZZLE_TYPES.length && !next; k++) {
    const t = PUZZLE_TYPES[(start + k) % PUZZLE_TYPES.length]!;
    for (const it of items) if (!next && it.type === t && !doneOf(docs, t)[it.id]) next = it;
  }
  return next
    ? {
        main: `Play ${next.name}`,
        sub: `${played} of ${items.length} done today`,
        item: next,
        all: false,
      }
    : { main: `All ${items.length} done today. Try the archive`, sub: '', item: null, all: true };
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
}

/** The footer's countdown: "New Mini in **5h 12m**", as finish.js paints it. */
export function clockLine(name: string, s: number): ClockLine {
  if (s <= 60 || s >= 86340) return { lead: 'Today’s puzzles are out.', bold: null };
  return { lead: `New ${name} in `, bold: hm(s) };
}

/**
 * The line under the score (finish.js streakLine): the type's "day streak" stat as
 * "🔥 5-day streak"; nothing under 1.
 */
export function streakLine(stats: readonly { value: string | number; label: string }[]): string {
  const s = stats.find((x) => /day streak/i.test(x.label));
  const n = s ? parseInt(String(s.value), 10) || 0 : 0;
  return n >= 1 ? `🔥 ${n}-day streak` : '';
}

/** The five grid puzzles that play the celebration jingle on a fresh win (AF-013). */
export const JINGLE_TYPES: readonly PuzzleType[] = ['mini', 'doku', 'sweep', 'path', 'link'];

/** Whether a finish plays the jingle: a fresh (not reopened) solve of one of the five. */
export const playsJingle = (type: PuzzleType, fresh: boolean, solved: boolean): boolean =>
  fresh && solved && JINGLE_TYPES.includes(type);

/**
 * The result and its unit, drawn apart as finish.js draws them (`325<small>pts</small>`):
 * "325 pts" → ["325", "pts"], "39 points" → ["39", "points"], "1:27" → ["1:27", ""].
 */
export function splitHero(hero: string): [string, string] {
  const m = /^(.*\S)\s+(pts|points?)$/.exec(hero);
  return m ? [m[1]!, m[2]!] : [hero, ''];
}
