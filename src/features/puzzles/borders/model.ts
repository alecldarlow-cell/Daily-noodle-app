/**
 * Borders, as a model: ported line for line from dailynoodle `engines/borders.js`
 * (GATE, the save and its defaults, the shared atlas in Borderline's save, liveStreak,
 * the home screen's words, start, showQuestion, useHint, answer, next, finish, abandon,
 * pause, the active-time clock, and the finish sheet's note and recap). Names follow
 * the engine's.
 *
 * Each question is an outline and four names, in the order the page stamped them at
 * build (`q.o`): nothing is shuffled on the page, so nothing is here. A right answer
 * scores 100 (50 after "Show on map"); a wrong one scores nothing (no bonus for answers
 * in a row since 26 Oct 2026, as the site). A country named
 * right goes into the atlas Borderline keeps (`digi-borderline-v1`), read, changed
 * and written back so nothing else in it is touched.
 *
 * Pure TypeScript: no React, no storage, no clock. A move is applied to a copy of the
 * state with a `Host` for what the page asks the browser (the performance clock, the
 * London day, saveProgress, the atlas). `frame` is the engine's per-frame loop.
 *
 * Controls ported are the ones a phone has: Play / Resume, the four names, Show on
 * map, Next / See result, Pause, Resume, Back to start. Not ported: the keyboard
 * (1–4, M, Enter), and the Sound, Reduced motion and Full screen switches (WP12).
 */

export const SAVE_KEY = 'digi-borders-v1';
export const ATLAS_KEY = 'digi-borderline-v1';
export const NQ = 10;
export const PLAN = [1, 1, 1, 2, 2, 2, 2, 2, 3, 3] as const;
export const ATLAS_TOTAL = 168;
export const LANDS = ['#F2C4C0', '#F3DC8E', '#C6DDA0', '#D6C8E8', '#F4C99A'] as const;
const W = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export interface BordersQ {
  /** name, Borderline atlas index, tier */
  n: string;
  i: number;
  t: number;
  /** centre longitude and latitude, km per unit, the inset pin */
  lo: number;
  la: number;
  km: number;
  x: number;
  y: number;
  /** the outline, and its Mercator scale and offsets */
  d: string;
  K: number;
  tx: number;
  ty: number;
  /** the four names, in display order */
  o: string[];
}

/** The page's `window.DN_PUZZLE` for a Borders. */
export interface BordersData {
  id: string;
  date: string;
  band?: string;
  qs: BordersQ[];
}

/* ---------- ship gate (the engine's GATE; the world inset ships with the app) ---------- */

export function gate(P: unknown, metaDate: string | null = null): string[] {
  const f: string[] = [];
  const num = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
  if (!P || typeof P !== 'object') return ['no puzzle object'];
  const p = P as Partial<BordersData>;
  if (!/^DP·BORD·\d{4}$/.test(p.id || '')) f.push('id ' + p.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) f.push('date ' + p.date);
  if (metaDate != null && metaDate !== p.date) f.push('dn:date ' + metaDate + ' != ' + p.date);
  if (!Array.isArray(p.qs) || p.qs.length !== NQ) return f.concat('expected ' + NQ + ' questions');
  const names = new Set<string>();
  const idx = new Set<number>();
  p.qs.forEach((q: Partial<BordersQ> | null, k) => {
    const w = 'q' + (k + 1) + ' ';
    if (!q || typeof q.n !== 'string' || !q.n) return f.push(w + 'no name');
    if (q.t !== PLAN[k]) f.push(w + 'tier ' + q.t + ', plan wants ' + PLAN[k]);
    if (names.has(q.n)) f.push(w + 'repeats ' + q.n);
    names.add(q.n);
    if (!Number.isInteger(q.i) || q.i! < 0 || q.i! >= ATLAS_TOTAL || idx.has(q.i!))
      f.push(w + 'atlas index');
    idx.add(q.i!);
    for (const k2 of ['lo', 'la', 'km', 'x', 'y', 'K', 'tx', 'ty'] as const)
      if (!num(q[k2])) f.push(w + k2);
    if (typeof q.d !== 'string' || !/^M[-0-9MLHVZmlhvz .,]+$/.test(q.d) || q.d.length < 40)
      f.push(w + 'outline');
    if (
      !Array.isArray(q.o) ||
      q.o.length !== 4 ||
      new Set(q.o).size !== 4 ||
      !q.o.includes(q.n) ||
      q.o.some((s) => typeof s !== 'string' || !s)
    )
      f.push(w + 'options');
  });
  return f;
}

export function validate(data: unknown, metaDate: string | null = null) {
  const checks = gate(data, metaDate);
  return { ok: checks.length === 0, checks };
}

/* ---------- helpers ---------- */

/** The colour each country has in Borderline's atlas. */
export const colourOf = (q: Pick<BordersQ, 'i'>) => LANDS[(q.i * 7 + 3) % LANDS.length]!;
export const serial = (id: string) => parseInt(String(id).slice(-4), 10);
export function mmss(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = String(s % 60).padStart(2, '0');
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x;
}
/** The atlas's id for a country (slug). */
export const slug = (n: string) =>
  n
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/* ---------- the atlas (Borderline's save) ---------- */

interface Atlas {
  v: 1;
  found: Record<string, number>;
  [k: string]: unknown;
}
export function atlasRead(raw: string | null): Atlas | null {
  try {
    const s = JSON.parse(raw || 'null') as Atlas | null;
    return s && s.v === 1 && s.found && typeof s.found === 'object' ? s : null;
  } catch {
    return null;
  }
}
/**
 * atlasAdd: count a country named; true if it is new to the atlas. A save that isn't
 * an atlas is left alone (nothing is added).
 */
export function atlasAdd(
  kv: { getItem(k: string): string | null; setItem(k: string, v: string): void },
  name: string,
): boolean {
  try {
    const s =
      atlasRead(kv.getItem(ATLAS_KEY)) || (kv.getItem(ATLAS_KEY) ? null : { v: 1, found: {} });
    if (!s) return false;
    const id = slug(name);
    const isNew = !s.found[id];
    s.found[id] = (s.found[id] || 0) + 1;
    kv.setItem(ATLAS_KEY, JSON.stringify(s));
    return isNew;
  } catch {
    return false;
  }
}
export function atlasCount(raw: string | null): number {
  const s = atlasRead(raw);
  return s ? Object.keys(s.found).filter((k) => s.found[k]).length : 0;
}

/* ---------- the save ---------- */

export interface Answer {
  k: number;
  ok: boolean;
  h: boolean;
  nw: boolean;
}
export interface Round {
  id: string;
  i: number;
  ans: Answer[];
  pts: number;
  run: number;
  secs: number;
  hint?: boolean;
}
export interface BordersRecord {
  c: number;
  p: number;
  secs: number;
  ans: Answer[];
  on: string;
}
export interface RoundStreak {
  last: string | null;
  n: number;
  best: number;
}
export interface BordersSave {
  v: 1;
  done: Record<string, BordersRecord>;
  streak: RoundStreak;
  cur: Round | null;
  snd: boolean;
  rm: boolean | null;
  fs: boolean;
  seenCoach: boolean;
  [k: string]: unknown;
}

/** The engine's defaults(). `fs` follows `(pointer: coarse)`: true on a phone. */
export function defaults(): BordersSave {
  return {
    v: 1,
    done: {},
    streak: { last: null, n: 0, best: 0 },
    cur: null,
    snd: true,
    rm: null,
    fs: true,
    seenCoach: false,
  };
}

export function loadSave(stored: unknown): BordersSave {
  const s = stored as { v?: unknown } | null;
  if (s && typeof s === 'object' && s.v === 1) return Object.assign(defaults(), s) as BordersSave;
  return defaults();
}

/* ---------- state ---------- */

export type View = 'home' | 'quiz' | 'winModal';

export interface BordersState {
  P: BordersData;
  save: BordersSave;
  view: View;
  paused: boolean;
  /** The round in play (save.cur itself while there is one). */
  cur: Round | null;
  locked: boolean;
  ending: boolean;
  last: number;
  shown: BordersRecord | null;
  /** The record just finished, until the caller has saved it (finishing.commitFinish). */
  finishing: boolean;
  /** What the open question shows once answered: the right name and its line. */
  plate: { name: string; line: string } | null;
  /** "Show on map" presses since the page opened (what the site's tracker counts). */
  hints: number;
}

export interface Host {
  now(): number;
  today(): string;
  persist(save: BordersSave, report: boolean): BordersSave;
  /** atlasAdd on Borderline's save. */
  atlasAdd(name: string): boolean;
}

export const liveStreakOf = (save: BordersSave, t: string, dayBefore: (d: string) => string) => {
  const s = save.streak || ({ n: 0 } as RoundStreak);
  return s.last === t || s.last === dayBefore(t) ? s.n || 0 : 0;
};
export const bestOf = (save: BordersSave) =>
  Math.max(0, ...Object.values(save.done || {}).map((d) => +d.p || 0));

function copy(s: BordersState): BordersState {
  const save: BordersSave = JSON.parse(JSON.stringify(s.save));
  const aliased = !!s.cur && s.cur === s.save.cur;
  const cur = s.cur ? (aliased ? save.cur : JSON.parse(JSON.stringify(s.cur))) : null;
  return { ...s, save, cur };
}

/** A page opened: home, or the finish sheet for a round already finished. */
export function init(P: BordersData, stored: unknown, now: number): BordersState {
  const save = loadSave(stored);
  const s: BordersState = {
    P,
    save,
    view: 'home',
    paused: false,
    cur: null,
    locked: false,
    ending: false,
    last: now,
    shown: null,
    finishing: false,
    plate: null,
    hints: 0,
  };
  if (save.done[P.id]) {
    s.view = 'winModal';
    s.shown = save.done[P.id]!;
  }
  return s;
}

function persist(s: BordersState, host: Host, progress = true) {
  const playing = !!(s.save.done[s.P.id] || (s.save.cur && s.save.cur.id === s.P.id));
  const aliased = !!s.cur && s.cur === s.save.cur;
  s.save = host.persist(s.save, progress && playing);
  if (aliased) s.cur = s.save.cur;
}

function start(s: BordersState, host: Host) {
  if (s.save.done[s.P.id]) {
    s.shown = s.save.done[s.P.id]!;
    s.view = 'winModal';
    return;
  }
  const c = s.save.cur;
  const cur: Round =
    c && c.id === s.P.id && Array.isArray(c.ans)
      ? c
      : { id: s.P.id, i: 0, ans: [], pts: 0, run: 0, secs: 0 };
  cur.i = cur.ans.length;
  cur.hint = false;
  cur.run = 0;
  for (const a of cur.ans) cur.run = a.ok ? cur.run + 1 : 0;
  s.save.cur = cur;
  s.cur = cur;
  persist(s, host);
  if (cur.i >= NQ) {
    s.finishing = true;
    return;
  }
  s.ending = false;
  s.paused = false;
  s.view = 'quiz';
  showQuestion(s, host);
}

function showQuestion(s: BordersState, host: Host) {
  s.locked = false;
  s.cur!.hint = false;
  s.plate = null;
  s.last = host.now();
}

/** The engine's useHint. */
function takeHint(s: BordersState) {
  if (s.locked || !s.cur || s.cur.hint) return;
  s.cur.hint = true;
}

function answer(s: BordersState, host: Host, k: number) {
  if (s.locked || !s.cur || s.view !== 'quiz') return;
  s.locked = true;
  const cur = s.cur;
  const q = s.P.qs[cur.i]!;
  const ok = q.o[k] === q.n;
  cur.run = ok ? cur.run + 1 : 0;
  const gain = ok ? (cur.hint ? 50 : 100) : 0;
  cur.pts += gain;
  const isNew = ok && host.atlasAdd(q.n);
  cur.ans.push({ k, ok, h: !!cur.hint, nw: !!isNew });
  if (!s.save.seenCoach) s.save.seenCoach = true;
  s.save.cur = cur;
  persist(s, host);
  s.plate = {
    name: q.n,
    line: ok ? (isNew ? 'New in your atlas. ' : '') + '+' + gain + ' points' : 'Not this time.',
  };
}

function next(s: BordersState, host: Host) {
  if (!s.locked || !s.cur) return;
  s.cur.i++;
  s.save.cur = s.cur;
  persist(s, host);
  if (s.cur.i >= NQ) s.finishing = true;
  else showQuestion(s, host);
}

function openPause(s: BordersState, host: Host) {
  if (s.view !== 'quiz' || s.paused) return;
  s.paused = true;
  persist(s, host);
}
function closePause(s: BordersState, host: Host) {
  s.paused = false;
  s.last = host.now();
}

/* ---------- moves ---------- */

export type Move =
  | { t: 'play' }
  /** One of the four names, by its place (0–3). */
  | { t: 'answer'; k: number }
  /** Show on map (half points). */
  | { t: 'hint' }
  /** Next / See result. */
  | { t: 'next' }
  | { t: 'pause' }
  | { t: 'resume' }
  /** Back to start, in the pause sheet. */
  | { t: 'quit' }
  /** The page closed and opened again. */
  | { t: 'reload' };

export function apply(prev: BordersState, move: Move, host: Host): BordersState {
  if (move.t === 'reload') throw new Error('apply: a reload is the caller’s');
  const s = copy(prev);
  const quiz = s.view === 'quiz' && !s.paused;
  switch (move.t) {
    case 'play':
      if (s.view === 'home') start(s, host);
      break;
    case 'answer':
      if (quiz && !s.locked) answer(s, host, move.k);
      break;
    case 'hint':
      if (quiz && !s.locked && !s.cur!.hint) {
        s.hints++; // the tracker counts a press of the enabled button
        takeHint(s);
      }
      break;
    case 'next':
      if (quiz && s.locked) next(s, host);
      break;
    case 'pause':
      if (s.view === 'quiz') openPause(s, host);
      break;
    case 'resume':
      if (s.paused) closePause(s, host);
      break;
    case 'quit':
      if (s.paused) {
        closePause(s, host);
        s.cur = null;
        s.view = 'home';
      }
      break;
  }
  return s;
}

/** The active-time clock on an animation frame at `t` (mutates; nothing drawn changes). */
export function frame(s: BordersState, t: number): void {
  const dt = Math.min(0.25, Math.max(0, (t - s.last) / 1000));
  s.last = t;
  if (s.view === 'quiz' && !s.paused && s.cur) s.cur.secs += dt;
}

/* ---------- the finish ---------- */

export function finishRecord(s: BordersState, on: string): BordersRecord {
  const cur = s.cur!;
  const correct = cur.ans.filter((a) => a.ok).length;
  return {
    c: correct,
    p: cur.pts,
    secs: Math.round(cur.secs),
    ans: cur.ans.map((a) => ({ k: a.k, ok: a.ok, h: a.h, nw: a.nw })),
    on,
  };
}

/** The finish sheet's line: who you missed, and how many countries are new in your atlas. */
export function noteFor(P: BordersData, rec: BordersRecord): string {
  const freshN = rec.ans.filter((a) => a.nw).length;
  const missed = P.qs.filter((_q, i) => rec.ans[i] && !rec.ans[i]!.ok).map((q) => q.n);
  const list = (a: string[]) =>
    a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  let note = missed.length ? `You missed ${list(missed)}.` : 'All ten named.';
  if (freshN)
    note += ` ${W[freshN] ? W[freshN]![0]!.toUpperCase() + W[freshN]!.slice(1) : freshN} new ${freshN === 1 ? 'country' : 'countries'} in your atlas.`;
  return note;
}

/** The finish sheet's "Today's ten": each outline, named, marked right or not. */
export function recapTiles(P: BordersData, rec: BordersRecord) {
  return P.qs.map((q, i) => {
    const a = rec.ans[i];
    return {
      q,
      ok: !!(a && a.ok),
      caption: q.n + (a && a.ok && a.h ? ' (map)' : ''),
    };
  });
}

/* ---------- what the screens show ---------- */

export function quizView(s: BordersState) {
  const cur = s.cur!;
  const q = s.P.qs[Math.min(cur.i, NQ - 1)]!;
  const last = cur.ans[cur.ans.length - 1];
  return {
    q,
    ticks: Array.from({ length: NQ }, (_, i) => {
      const a = cur.ans[i];
      return a ? (a.ok ? 'ok' : 'bad') : i === cur.i ? 'cur' : '';
    }),
    pts: cur.pts,
    options: q.o.map((name, j) => ({
      name,
      mark: !s.locked ? '' : name === q.n ? 'right' : last && j === last.k ? 'wrong' : 'dim',
    })),
    plate: s.plate,
    hintHidden: s.locked,
    hintDisabled: !!cur.hint,
    nextHidden: !s.locked,
    nextLabel: cur.i === NQ - 1 ? 'See result' : 'Next',
    /** The world inset with its pin: after a hint or an answer. */
    inset: s.locked || !!cur.hint,
    coachOff: !!s.save.seenCoach,
    revealed: s.locked,
  };
}

export function homeView(s: BordersState, t: string, dayBefore: (d: string) => string) {
  const c = s.save.cur && s.save.cur.id === s.P.id ? s.save.cur : null;
  return {
    stats: [
      String(liveStreakOf(s.save, t, dayBefore)),
      String(bestOf(s.save)),
      String(Object.keys(s.save.done || {}).length),
    ],
    status: c
      ? `Question ${Math.min(NQ, c.ans.length + 1)} of ${NQ}, ${c.pts} points so far.`
      : 'Ten country outlines, easiest first. Name them from four; 100 points each.',
    button: c ? 'Resume' : 'Play',
  };
}
