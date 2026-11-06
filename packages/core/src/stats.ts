/**
 * Personal stats, ported from dailynoodle dn-stats.js (6 Nov 2026, Alec: free for everyone,
 * no sign-in). Worked out only from the saves on this device; read-only, stores nothing.
 * The differential test (tests/stats.test.ts) proves this gives the site's exact answers.
 * Pure: pass today's London day in.
 */
import type { PuzzleType } from './ids';
import type { KV } from './types';

type Obj = Record<string, unknown>;

export const STATS_TYPES: readonly PuzzleType[] = [
  'mini',
  'doku',
  'sweep',
  'path',
  'link',
  'tangle',
  'borders',
  'reckon',
  'tally',
];
const LABEL: Record<PuzzleType, string> = {
  mini: 'Mini',
  doku: 'Doku',
  sweep: 'Sweep',
  path: 'Path',
  link: 'Link',
  tangle: 'Tangle',
  borders: 'Borders',
  reckon: 'Reckon',
  tally: 'Tally',
};
const SCORED: Partial<Record<PuzzleType, 1>> = { tangle: 1, borders: 1, reckon: 1 };
const STREAK_TYPES: readonly PuzzleType[] = ['mini', 'doku', 'sweep', 'path', 'link', 'tally'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const STATS_MIN_SHOW = 3;
export const STATS_MIN_TREND = 5;
export const STATS_MIN_YEAR = 10;

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const obj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const day = (x: unknown): string | null => (typeof x === 'string' && DAY.test(x) ? x : null);

function clockSecs(t: unknown): number | null {
  const m = /^(\d+):(\d\d)(?::(\d\d))?$/.exec(String(t == null ? '' : t));
  if (!m) return null;
  return m[3] ? +m[1]! * 3600 + +m[2]! * 60 + +m[3] : +m[1]! * 60 + +m[2]!;
}
function back(d: string): string {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() - 1);
  return x.toISOString().slice(0, 10);
}

export interface Saved {
  docs: Partial<Record<PuzzleType, Obj>>;
  streaks: Partial<Record<PuzzleType, Obj>>;
}
export type StatsMode = 'all' | 'day' | 'archive';
export interface StatsRow {
  type: PuzzleType;
  id: string;
  played: string | null;
  date: string | null;
  when: 'day' | 'archive' | null;
  secs: number | null;
  won: boolean | null;
  score: number | null;
  mistakes: number | null;
  words: number | null;
  star: boolean | null;
  bulls: number | null;
  correct: number | null;
}
export interface SpreadBin {
  from: number;
  to: number;
  n: number;
  open: boolean;
}
export interface TrendPoint {
  month: string;
  value: number | null;
  n: number;
}
export interface TypeStats {
  type: PuzzleType;
  label: string;
  n: number;
  scored: boolean;
  best?: number | null;
  median?: number | null;
  average?: number | null;
  spread?: SpreadBin[] | null;
  won?: number;
  solveRate?: number | null;
  mistakes?: number | null;
  mostWords?: number | null;
  stars?: number;
  bullseyes?: number;
  bestCorrect?: number | null;
  averageCorrect?: number | null;
  trend?: TrendPoint[] | null;
}
export interface StatsSummary {
  mode: StatsMode;
  overall: {
    finished: number;
    days: number;
    run: number;
    longest: number;
    favourite: { type: PuzzleType; label: string; n: number } | null;
  };
  types: Record<PuzzleType, TypeStats>;
  unknown: number;
}
export interface YearCard {
  year: number;
  finished: number;
  days: number;
  longest: number;
  favourite: { type: PuzzleType; label: string; n: number } | null;
  busiest: string | null;
  bests: { type: PuzzleType; label: string; secs?: number; score?: number }[];
}
export interface StatsOptions {
  today?: string;
  mode?: StatsMode;
  dates?: Record<string, string> | null;
}

/** The saves as documents, from any Web-Storage-shaped store. A broken document is skipped. */
export function readStats(storage: KV): Saved {
  const get = (k: string): Obj | null => {
    try {
      const v: unknown = JSON.parse(storage.getItem(k) || 'null');
      return obj(v) ? v : null;
    } catch {
      return null;
    }
  };
  const docs: Saved['docs'] = {};
  const streaks: Saved['streaks'] = {};
  for (const t of STATS_TYPES) {
    const d = get(`digi-${t}-v1`);
    if (d) docs[t] = d;
  }
  for (const t of STREAK_TYPES) {
    const s = get(`digi-${t}-streak`);
    if (s) streaks[t] = s;
  }
  return { docs, streaks };
}

function one(
  type: PuzzleType,
  id: string,
  r: unknown,
  dates?: Record<string, string> | null,
): StatsRow | null {
  if (!obj(r)) return null;
  const played = day(r.d) || day(r.on);
  const date = (dates && day(dates[id])) || null;
  const out: StatsRow = {
    type,
    id,
    played,
    date,
    when: played && date ? (played === date ? 'day' : 'archive') : null,
    secs: null,
    won: null,
    score: null,
    mistakes: null,
    words: null,
    star: null,
    bulls: null,
    correct: null,
  };
  switch (type) {
    case 'mini':
    case 'doku':
      out.secs = num(r.s) ? r.s : null;
      out.won = true;
      break;
    case 'tally':
      out.secs = num(r.s) ? r.s : clockSecs(r.t);
      out.won = true;
      break;
    case 'path':
      out.secs = clockSecs(r.t);
      out.won = true;
      break;
    case 'sweep':
      out.won = r.o === 'win';
      out.secs = out.won && num(r.s) ? r.s : null;
      break;
    case 'link':
      out.won = r.o === 'win';
      out.secs = out.won ? clockSecs(r.t) : null;
      out.mistakes = num(r.m) ? r.m : null;
      break;
    case 'tangle':
      out.score = num(r.s) ? r.s : null;
      out.words = num(r.w) ? r.w : null;
      out.star = typeof r.st === 'boolean' ? r.st : null;
      break;
    case 'borders':
      out.score = num(r.p) ? r.p : null;
      out.correct = num(r.c) ? r.c : null;
      break;
    case 'reckon':
      out.score = num(r.p) ? r.p : null;
      out.bulls = num(r.b) ? r.b : null;
      break;
  }
  if (out.secs != null && !(out.secs >= 0)) out.secs = null;
  return out;
}

/** One row per finished puzzle, in the site's order (type, then id). */
export function statsRows(
  docs: Saved['docs'] | undefined,
  dates?: Record<string, string> | null,
): StatsRow[] {
  const out: StatsRow[] = [];
  for (const t of STATS_TYPES) {
    const d = docs && docs[t];
    if (!d || !obj(d.done)) continue;
    const done = d.done;
    for (const id of Object.keys(done).sort()) {
      const r = one(t, id, done[id], dates);
      if (r) out.push(r);
    }
  }
  return out;
}

function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
function mean(a: number[]): number | null {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
}
const TIME_STEPS = [10, 15, 30, 60, 120, 300, 600, 1800];
const SCORE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
function spread(vals: number[], steps: number[]): SpreadBin[] | null {
  if (vals.length < STATS_MIN_SHOW) return null;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  let step = steps[steps.length - 1]!;
  for (const s of steps) {
    if ((hi - lo) / s <= 5) {
      step = s;
      break;
    }
  }
  const start = Math.floor(lo / step) * step;
  const bins: SpreadBin[] = [];
  for (let i = 0; i < 6; i++)
    bins.push({ from: start + i * step, to: start + (i + 1) * step, n: 0, open: i === 5 });
  for (const v of vals) {
    let i = Math.floor((v - start) / step);
    if (i > 5) i = 5;
    bins[i]!.n++;
  }
  while (bins.length > 1 && bins[bins.length - 1]!.n === 0) bins.pop();
  bins[bins.length - 1]!.open = bins.length === 6 && hi >= bins[5]!.from + step;
  return bins;
}
function months(today: string, k: number): string[] {
  const out: string[] = [];
  let y = +today.slice(0, 4);
  let m = +today.slice(5, 7);
  for (let i = 0; i < k; i++) {
    out.unshift(y + '-' + String(m).padStart(2, '0'));
    m--;
    if (!m) {
      m = 12;
      y--;
    }
  }
  return out;
}
function playedDays(rows: StatsRow[], streaks: Saved['streaks'] | undefined): Record<string, 1> {
  const days: Record<string, 1> = {};
  for (const r of rows) if (r.played) days[r.played] = 1;
  for (const t of Object.keys(streaks || {}) as PuzzleType[]) {
    const s = streaks![t];
    if (s && Array.isArray(s.dates)) for (const d of s.dates) if (day(d)) days[d as string] = 1;
  }
  return days;
}
function runs(days: Record<string, 1>, today: string): { current: number; longest: number } {
  let d = days[today] ? today : back(today);
  let cur = 0;
  while (days[d] && cur < 4000) {
    cur++;
    d = back(d);
  }
  let best = 0;
  let n = 0;
  let prev: string | null = null;
  for (const x of Object.keys(days).sort()) {
    n = prev && back(x) === prev ? n + 1 : 1;
    if (n > best) best = n;
    prev = x;
  }
  return { current: cur, longest: best };
}

function typeStats(type: PuzzleType, rows: StatsRow[], today: string | null): TypeStats {
  const n = rows.length;
  const s: TypeStats = { type, label: LABEL[type], n, scored: !!SCORED[type] };
  if (!n) return s;
  const show = n >= STATS_MIN_SHOW;
  if (s.scored) {
    const sc = rows.map((r) => r.score).filter(num);
    s.best = sc.length ? Math.max(...sc) : null;
    s.average = show && sc.length >= STATS_MIN_SHOW ? Math.round(mean(sc)!) : null;
    s.spread = show ? spread(sc, SCORE_STEPS) : null;
    if (type === 'tangle') {
      const w = rows.map((r) => r.words).filter(num);
      s.mostWords = w.length ? Math.max(...w) : null;
      s.stars = rows.filter((r) => r.star === true).length;
    }
    if (type === 'reckon') s.bullseyes = rows.reduce((a, r) => a + (num(r.bulls) ? r.bulls : 0), 0);
    if (type === 'borders') {
      const c = rows.map((r) => r.correct).filter(num);
      s.bestCorrect = c.length ? Math.max(...c) : null;
      s.averageCorrect = show && c.length >= STATS_MIN_SHOW ? Math.round(mean(c)! * 10) / 10 : null;
    }
  } else {
    const t = rows.map((r) => r.secs).filter(num);
    s.best = t.length ? Math.min(...t) : null;
    s.median = show && t.length >= STATS_MIN_SHOW ? Math.round(median(t)!) : null;
    s.spread = show ? spread(t, TIME_STEPS) : null;
    if (type === 'sweep' || type === 'link') {
      s.won = rows.filter((r) => r.won).length;
      s.solveRate = show ? Math.round((100 * s.won) / n) : null;
    }
    if (type === 'link') {
      const m = rows.map((r) => r.mistakes).filter(num);
      s.mistakes = show && m.length >= STATS_MIN_SHOW ? Math.round(mean(m)! * 10) / 10 : null;
    }
  }
  s.trend = null;
  if (show && today) {
    const pts = months(today, 6).map((m) => {
      const v = rows
        .filter((r) => (r.played || r.date || '').slice(0, 7) === m)
        .map((r) => (s.scored ? r.score : r.secs))
        .filter(num);
      return {
        month: m,
        value: v.length >= STATS_MIN_TREND ? Math.round(s.scored ? mean(v)! : median(v)!) : null,
        n: v.length,
      };
    });
    if (pts.filter((p) => p.value != null).length >= 2) s.trend = pts;
  }
  return s;
}

/** Everything the Stats screen shows. Runs always count every day played. */
export function statsSummary(
  saved: Saved | null | undefined,
  opts: StatsOptions = {},
): StatsSummary {
  const today = day(opts.today);
  const mode: StatsMode = opts.mode === 'day' || opts.mode === 'archive' ? opts.mode : 'all';
  const all = statsRows(saved?.docs, opts.dates);
  const rows = mode === 'all' ? all : all.filter((r) => r.when === mode);
  const days: Record<string, 1> = {};
  for (const r of rows) if (r.played) days[r.played] = 1;
  const per = {} as Record<PuzzleType, TypeStats>;
  for (const t of STATS_TYPES)
    per[t] = typeStats(
      t,
      rows.filter((r) => r.type === t),
      today,
    );
  let fav: PuzzleType | null = null;
  for (const t of STATS_TYPES) if (per[t].n && (!fav || per[t].n > per[fav].n)) fav = t;
  const run = today ? runs(playedDays(all, saved?.streaks), today) : { current: 0, longest: 0 };
  return {
    mode,
    overall: {
      finished: rows.length,
      days: Object.keys(days).length,
      run: run.current,
      longest: run.longest,
      favourite: fav ? { type: fav, label: LABEL[fav], n: per[fav].n } : null,
    },
    types: per,
    unknown: all.filter((r) => r.when === null).length,
  };
}

/** "Your 2026 in Noodle": 1 Dec to 31 Jan (the year just gone in January), from 10 results. */
export function statsYearCard(
  saved: Saved | null | undefined,
  opts: StatsOptions = {},
): YearCard | null {
  const today = day(opts.today);
  if (!today) return null;
  const m = +today.slice(5, 7);
  if (m !== 12 && m !== 1) return null;
  const year = m === 12 ? +today.slice(0, 4) : +today.slice(0, 4) - 1;
  const Y = String(year);
  const all = statsRows(saved?.docs, opts.dates);
  const rows = all.filter((r) => (r.played || r.date || '').slice(0, 4) === Y);
  if (rows.length < STATS_MIN_YEAR) return null;
  const days: Record<string, 1> = {};
  const byMonth: Record<string, number> = {};
  for (const r of rows) {
    const d = (r.played || r.date)!;
    days[d] = 1;
    const k = d.slice(0, 7);
    byMonth[k] = (byMonth[k] || 0) + 1;
  }
  const yd: Record<string, 1> = {};
  for (const d of Object.keys(playedDays(all, saved?.streaks))) if (d.slice(0, 4) === Y) yd[d] = 1;
  const longest = runs(yd, Y + '-12-31').longest;
  const count: Partial<Record<PuzzleType, number>> = {};
  for (const r of rows) count[r.type] = (count[r.type] || 0) + 1;
  let fav: PuzzleType | null = null;
  for (const t of STATS_TYPES) if (count[t] && (!fav || count[t]! > count[fav]!)) fav = t;
  let busiest: string | null = null;
  for (const k of Object.keys(byMonth).sort())
    if (!busiest || byMonth[k]! > byMonth[busiest]!) busiest = k;
  const bests: YearCard['bests'] = [];
  for (const t of STATS_TYPES) {
    const r = rows.filter((x) => x.type === t);
    if (!r.length) continue;
    if (SCORED[t]) {
      const v = r.map((x) => x.score).filter(num);
      if (v.length) bests.push({ type: t, label: LABEL[t], score: Math.max(...v) });
    } else {
      const v = r.map((x) => x.secs).filter(num);
      if (v.length) bests.push({ type: t, label: LABEL[t], secs: Math.min(...v) });
    }
  }
  return {
    year,
    finished: rows.length,
    days: Object.keys(days).length,
    longest,
    favourite: fav ? { type: fav, label: LABEL[fav], n: count[fav]! } : null,
    busiest,
    bests,
  };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export function monthName(k: string): string {
  return MONTHS[+k.slice(5, 7) - 1] || '';
}
/** The house share style: one line, no link (SITE.md › Archive and personal stats). */
export function yearShare(y: YearCard | null): string {
  if (!y) return '';
  return (
    '🍜 My ' +
    y.year +
    ' in Noodle — ' +
    y.finished +
    ' puzzle' +
    (y.finished === 1 ? '' : 's') +
    ' · ' +
    y.days +
    ' day' +
    (y.days === 1 ? '' : 's') +
    (y.longest >= 2 ? ' · 🔥' + y.longest + ' best run' : '') +
    (y.favourite ? ' · ' + y.favourite.label + ' most' : '')
  );
}
