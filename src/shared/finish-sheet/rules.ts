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
 * The Next button (Alec's design B3, 8 Nov 2026; the pick is finish.js fillNext's):
 * "Next: Doku 103" / "3 of 9 done today"; once every puzzle is done, "All 9 done" /
 * "Try the archive", which opens the Archive.
 */
export function nextRow(list: TodayList | null | undefined, type: PuzzleType, docs: Docs): NextRow {
  if (!list) return { main: 'Today’s puzzles', sub: '\u00a0', item: null, all: false };
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
        main: `Next: ${next.name}`,
        sub: `${played} of ${items.length} done today`,
        item: next,
        all: false,
      }
    : { main: `All ${items.length} done`, sub: 'Try the archive', item: null, all: true };
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
 * "🔥 5-day Doku streak"; nothing under 1.
 */
export function streakLine(
  stats: readonly { value: string | number; label: string }[],
  name: string,
): string {
  const s = stats.find((x) => /day streak/i.test(x.label));
  const n = s ? parseInt(String(s.value), 10) || 0 : 0;
  return n >= 1 ? `🔥 ${n}-day ${name} streak` : '';
}

/** The grid puzzles that play the celebration jingle on a fresh win (AF-013). */
export const JINGLE_TYPES: readonly PuzzleType[] = [
  'mini',
  'doku',
  'sweep',
  'path',
  'link',
  'tally',
];

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

// ---- Design B3 (Alec, 8 Nov 2026): the outcome, the reward line, the labels ----

/** The day streak from a type's stats ("day streak"), 0 when there is none. */
export function dayStreak(stats: readonly { value: string | number; label: string }[]): number {
  const s = stats.find((x) => /day streak/i.test(x.label));
  return s ? parseInt(String(s.value), 10) || 0 : 0;
}

/** The day streaks that are a milestone: the reward line says so, on a gold disc. */
export const MILESTONES: readonly number[] = [7, 30, 50, 100, 365];

/** How many earlier finishes a personal best needs before the sheet calls it one. */
export const PB_MIN_EARLIER = 3;

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** "1:42" → 102, "1:02:03" → 3723; null when it isn't a clock. */
export function clockSecs(t: unknown): number | null {
  const m = /^(\d+):(\d\d)(?::(\d\d))?$/.exec(String(t ?? '').trim());
  if (!m) return null;
  return m[3] ? +m[1]! * 3600 + +m[2]! * 60 + +m[3] : +m[1]! * 60 + +m[2]!;
}

/**
 * How a type's personal best is measured, from the results already on the phone
 * (`digi-<type>-v1` done): a time (lower is better) or points (higher). Link has neither
 * (its result is the guesses), so it never has one.
 */
const PB: Partial<Record<PuzzleType, { kind: 'time' | 'points'; of: (r: Rec) => number | null }>> =
  {
    mini: { kind: 'time', of: (r) => (num(r.s) ? r.s : null) },
    doku: { kind: 'time', of: (r) => (num(r.s) ? r.s : null) },
    sweep: {
      kind: 'time',
      of: (r) => (r.o === 'loss' || r.o === 'gave' ? null : num(r.s) ? r.s : null),
    },
    path: { kind: 'time', of: (r) => clockSecs(r.t) ?? (num(r.s) ? r.s : null) },
    tally: { kind: 'time', of: (r) => clockSecs(r.t) ?? (num(r.s) ? r.s : null) },
    tangle: { kind: 'points', of: (r) => (num(r.s) ? r.s : null) },
    borders: { kind: 'points', of: (r) => (num(r.p) ? r.p : null) },
    reckon: { kind: 'points', of: (r) => (num(r.p) ? r.p : null) },
  };

/**
 * This result as its type measures it: the hero's time ("1:42"), or its points ("46
 * points", "325 pts"); Borders' hero is "7 of 10", so its points come from its stats.
 */
export function resultValue(
  type: PuzzleType,
  hero: string,
  stats: readonly { value: string | number; label: string }[],
): number | null {
  const how = PB[type];
  if (!how) return null;
  if (how.kind === 'time') return clockSecs(hero);
  if (type === 'borders') {
    const p = stats.find((x) => x.label === 'points');
    const v = p ? Number(p.value) : NaN;
    return Number.isFinite(v) ? v : null;
  }
  const m = /^(-?\d+)\s*(pts|points?)?$/.exec(hero.trim());
  return m ? +m[1]! : null;
}

/** "12s", "1m 05s". */
function gap(s: number): string {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/**
 * "Your fastest Mini yet, by 12s" / "Your best Tangle yet, by 6 points": when this result
 * beats every other finish of the type kept on the phone, and there are at least three of
 * them. This result is among the saved ones, so one saved result equal to it is left out
 * (it is this one); nothing is asked of the server.
 */
export function personalBest(
  type: PuzzleType,
  value: number | null,
  name: string,
  doc: unknown,
): string | null {
  const how = PB[type];
  if (!how || value === null) return null;
  const done = isRec(doc) && isRec(doc.done) ? doc.done : {};
  const others: number[] = [];
  let self = false;
  for (const r of Object.values(done)) {
    const v = isRec(r) ? how.of(r) : null;
    if (v === null) continue;
    if (!self && v === value) self = true;
    else others.push(v);
  }
  if (others.length < PB_MIN_EARLIER) return null;
  if (how.kind === 'time') {
    const best = Math.min(...others);
    return value < best ? `Your fastest ${name} yet, by ${gap(best - value)}` : null;
  }
  const best = Math.max(...others);
  const by = value - best;
  return by > 0 ? `Your best ${name} yet, by ${by} ${by === 1 ? 'point' : 'points'}` : null;
}

export type RewardKind = 'pb' | 'milestone' | 'streak';

/**
 * The reward block's main line, the first that applies: a personal best, a streak
 * milestone (7, 30, 50, 100, 365 days), else the streak itself from 2 days; null for none.
 */
export function rewardLine(
  pb: string | null,
  streak: number,
  name: string,
): { kind: RewardKind; text: string } | null {
  if (pb) return { kind: 'pb', text: pb };
  if (MILESTONES.includes(streak))
    return { kind: 'milestone', text: `${streak}-day ${name} streak: a milestone` };
  if (streak >= 2) return { kind: 'streak', text: `${streak}-day ${name} streak` };
  return null;
}

/** The small label over each type's recap, in the style of its old title. */
export const RECAP_LABEL: Record<PuzzleType, string> = {
  mini: 'YOUR GRID',
  doku: 'YOUR GRID',
  sweep: 'YOUR BOARD',
  path: 'YOUR PATH',
  tally: 'YOUR BOARD',
  link: 'THE GROUPS',
  tangle: 'YOUR WORDS',
  borders: 'THE TEN',
  reckon: 'THE TEN',
};

/** The recap's label: the type's own, or "THE ANSWER" on a lost round. */
export const recapLabel = (type: PuzzleType, solved: boolean): string =>
  solved ? RECAP_LABEL[type] : 'THE ANSWER';

/**
 * The types whose note says something nothing else on the sheet shows, so it stays as a
 * small line under the outcome: Tangle's longest word, Reckon's bullseyes, the countries
 * Borders adds to the atlas, and which Link group caught you out. The others' notes ("All
 * seven mines found.", "No checks, no reveals.") only repeat the outcome, and go.
 */
export const NOTE_TYPES: readonly PuzzleType[] = ['tangle', 'reckon', 'borders', 'link'];

/** "0:31" → "31 seconds", "1:42" → "1 minute 42 seconds"; anything else as it is. */
export function spokenHero(hero: string): string {
  const s = clockSecs(hero);
  if (s === null) return hero;
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const sec = s % 60;
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const parts = [
    h ? unit(h, 'hour') : '',
    m ? unit(m, 'minute') : '',
    sec || (!h && !m) ? unit(sec, 'second') : '',
  ];
  return parts.filter(Boolean).join(' ');
}

/**
 * What a screen reader hears on a fresh finish: "Swept in 31 seconds. 26-day Sweep
 * streak." (the outcome, the result, then the reward's main line).
 */
export function announcement(title: string, hero: string, main: string | null): string {
  const word = title.replace(/[.!]+$/, '');
  const result = clockSecs(hero) !== null ? `${word} in ${spokenHero(hero)}` : `${word}, ${hero}`;
  return main ? `${result}. ${main}.` : `${result}.`;
}
