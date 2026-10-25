/**
 * Reckon, as a model: ported line for line from dailynoodle `engines/reckon.js` (GATE,
 * the save and its defaults, liveStreak, bestScore, Ballpark's numbers and scale: grp,
 * trim, fmt, fmtA, withU, shortLab, zone, ladder, offText; the round: start, renderQ's
 * state, nearest, setIdx, first, lockIn, reveal's words, nextQ, goTo, act, the slider
 * and − / + controls with hold-to-repeat, pause, Back to start, the active-time clock,
 * and the finish sheet's note, recap and review). Names follow the engine's.
 *
 * Pure TypeScript: no React, no storage, no clock of its own. A move is applied to a
 * copy of the state with a `Host` that answers what the page asks the browser: the
 * performance clock (`now`, ms), the London day, and `persist` (the engine's
 * `dnCore.saveProgress`, whose merge result replaces the save). The active-time clock
 * is `frame`, called on every animation frame as the engine's `loop` is.
 *
 * Controls ported are the ones a phone has: Play / Resume, the scale (drag or tap),
 * − and + (tap or hold), Lock in / Next / See result, ‹ ›, the question pips, Pause,
 * Resume, Back to start, and on the finish sheet the recap rows (review) and Back to
 * results. Not ported: the keyboard (no phone has one), and the Sound, Vibration,
 * Reduced motion and Full screen switches (sound and haptics are WP12; the switches
 * only change those settings, which the save keeps as it found them).
 */

export const SAVE_KEY = 'digi-reckon-v1';
export const NQ = 10;
export const SPAN = 2;
export const BAND = [1.15, 1.3, 1.6, 3] as const;
export const PTS = [100, 75, 50, 25, 0] as const;
export const ZN = ['Bullseye', 'Close', 'Ballpark', 'In range', 'Miss'] as const;
const MANT = [
  1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4,
  2.5, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.2, 4.4, 4.6, 4.8, 5, 5.2, 5.4, 5.6, 5.8, 6, 6.25, 6.5,
  6.75, 7, 7.25, 7.5, 7.75, 8, 8.25, 8.5, 8.75, 9, 9.25, 9.5, 9.75,
];
/** Ballpark's twelve packs: name and colour (the engine's PACKS, without the icons). */
export const PACKS: Record<string, { n: string; c: string }> = {
  earth: { n: 'Earth', c: '#2D8457' },
  space: { n: 'Space', c: '#4B4FC4' },
  places: { n: 'Places', c: '#BF542D' },
  body: { n: 'Body', c: '#C9406B' },
  build: { n: 'Engineering', c: '#2F6F9E' },
  animals: { n: 'Animals', c: '#9B6C0D' },
  sport: { n: 'Sport', c: '#6D28D9' },
  food: { n: 'Food', c: '#4D7C0F' },
  everyday: { n: 'Everyday', c: '#57534E' },
  weather: { n: 'Weather', c: '#0369A1' },
  britain: { n: 'Britain', c: '#B91C1C' },
  science: { n: 'Science', c: '#0F766E' },
};
const L10 = Math.log10;
const W = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ReckonQ {
  /** fact id, pack key, question, unit, answer, note, whole numbers only, easy, scale start */
  f: string;
  k: string;
  q: string;
  u: string;
  a: number;
  n: string;
  i?: number;
  e?: number;
  lo: number;
}

/** The page's `window.DN_PUZZLE` for a Reckon. */
export interface ReckonData {
  id: string;
  date: string;
  qs: ReckonQ[];
}

/* ---------- ship gate (the engine's GATE) ---------- */

export function gate(P: unknown, metaDate: string | null = null): string[] {
  const f: string[] = [];
  const num = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
  if (!P || typeof P !== 'object') return ['no puzzle object'];
  const p = P as Partial<ReckonData>;
  if (!/^DP·RECK·\d{4}$/.test(p.id || '')) f.push('id ' + p.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) f.push('date ' + p.date);
  if (metaDate != null && metaDate !== p.date) f.push('dn:date ' + metaDate + ' != ' + p.date);
  if (!Array.isArray(p.qs) || p.qs.length !== NQ) return f.concat('expected ' + NQ + ' questions');
  const ids = new Set<unknown>();
  const packs = new Set<unknown>();
  p.qs.forEach((q: Partial<ReckonQ> | null, k) => {
    const w = 'q' + (k + 1) + ' ';
    if (!q || typeof q !== 'object') return f.push(w + 'missing');
    if (typeof q.q !== 'string' || q.q.length < 9) f.push(w + 'question');
    if (!num(q.a) || q.a <= 0) f.push(w + 'answer');
    if (!num(q.lo)) f.push(w + 'scale');
    else {
      const a = L10(q.a as number);
      const r = L10(BAND[1]);
      if (a - r < q.lo - 1e-9 || a + r > q.lo + SPAN + 1e-9) f.push(w + 'zones off the scale');
      if (q.i && q.lo < 0) f.push(w + 'whole-number scale below 1');
    }
    if (typeof q.u !== 'string' || typeof q.n !== 'string') f.push(w + 'unit or note');
    if (typeof q.f !== 'string' || ids.has(q.f)) f.push(w + 'fact id');
    ids.add(q.f);
    if (typeof q.k !== 'string' || packs.has(q.k)) f.push(w + 'pack');
    packs.add(q.k);
  });
  if (p.qs[0] && !p.qs[0].e) f.push('opener is not an easy one');
  return f;
}

/** The gate's verdict in the shape every native player's validate returns. */
export function validate(data: unknown, metaDate: string | null = null) {
  const checks = gate(data, metaDate);
  return { ok: checks.length === 0, checks };
}

/* ---------- numbers and the scale (Ballpark's own) ---------- */

export function grp(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export function trim(x: number): string {
  return String(+(+x).toPrecision(3));
}
export function fmt(v: number): string {
  const A = Math.abs(v);
  if (A >= 1e12) return trim(v / 1e12) + ' trillion';
  if (A >= 1e9) return trim(v / 1e9) + ' billion';
  if (A >= 1e6) return trim(v / 1e6) + ' million';
  if (A >= 1000) return grp(v);
  return trim(v);
}
export function fmtA(a: number): string {
  if (a >= 1e6) return fmt(a);
  if (a >= 1000) return grp(a);
  return String(a);
}
export function withU(s: string, u: string): string {
  return u ? (u === '%' ? s + '%' : s + ' ' + u) : s;
}
export function shortLab(v: number): string {
  if (v >= 1e12) return trim(v / 1e12) + 'tn';
  if (v >= 1e9) return trim(v / 1e9) + 'bn';
  if (v >= 1e6) return trim(v / 1e6) + 'M';
  if (v >= 1e3) return trim(v / 1e3) + 'k';
  return trim(v);
}
export function zone(g: number, a: number): number {
  const r = Math.max(g / a, a / g);
  for (let i = 0; i < BAND.length; i++) if (r <= BAND[i]! + 1e-9) return i;
  return 4;
}
export function ladder(lo: number, isInt: boolean): number[] {
  const out: number[] = [];
  const a = Math.pow(10, lo) * 0.9999;
  const b = Math.pow(10, lo + SPAN) * 1.0001;
  for (let d = Math.floor(lo); d <= Math.ceil(lo + SPAN); d++)
    for (const m of MANT) {
      let v = +(m * Math.pow(10, d)).toPrecision(3);
      if (isInt) {
        if (v < 10 && v !== Math.round(v)) continue;
        v = Math.round(v);
        if (v < 1) continue;
      }
      if (v < a || v > b) continue;
      if (!out.length || out[out.length - 1] !== v) out.push(v);
    }
  return out;
}
/** How far out a guess was, in words (gaps measured from the smaller number, rounded up). */
export function offText(g: number, a: number): string {
  const r = g / a;
  if (Math.abs(r - 1) < 0.005) return 'Spot on.';
  const k = Math.max(r, 1 / r);
  const pc = Math.ceil((k - 1) * 100 - 1e-6);
  const x = String(Math.ceil(k * 10 - 1e-6) / 10);
  if (r < 1)
    return k < 2
      ? 'The answer was ' + pc + '% more than your guess.'
      : 'The answer was about ' + x + '× your guess.';
  return k < 2
    ? 'Your guess was ' + pc + '% more than the answer.'
    : 'Your guess was about ' + x + '× the answer.';
}
/** Seconds as the finish sheet shows them: "1:27", "1:02:03". */
export function mmss(secs: number): string {
  const s = Math.max(0, Math.round(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = String(s % 60).padStart(2, '0');
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + x : m + ':' + x;
}
export const serial = (id: string) => parseInt(String(id).slice(-4), 10);

/** The scale's tick marks and labels for a question (renderQ's tk and lb). */
export function scaleMarks(lo: number) {
  const ticks: { x: number; kind: 'mj' | 'md' | '' }[] = [];
  const labels: { x: number; text: string }[] = [];
  for (let d = Math.floor(lo); d <= Math.ceil(lo + SPAN); d++)
    for (let k = 1; k <= 9; k++) {
      const lv = d + L10(k);
      const x = ((lv - lo) / SPAN) * 100;
      if (x < -0.01 || x > 100.01) continue;
      ticks.push({ x, kind: k === 1 ? 'mj' : k === 3 ? 'md' : '' });
      if ((k === 1 || k === 3) && x > 4 && x < 96)
        labels.push({ x, text: shortLab(k * Math.pow(10, d)) });
    }
  return { ticks, labels };
}

/* ---------- the save ---------- */

export interface Round {
  id: string;
  /** The question being played. */
  i: number;
  /** 'g' guessing, 'r' locked in (the answer showing). */
  ph: 'g' | 'r';
  g: number[];
  z: number[];
  /** The live guess, a ladder value. */
  cur: number | null;
  secs: number;
}

export interface ReckonRecord {
  p: number;
  b: number;
  z: number[];
  g: number[];
  secs: number;
  d?: string;
}

export interface RoundStreak {
  last: string | null;
  n: number;
  best: number;
}

export interface ReckonSave {
  v: 1;
  done: Record<string, ReckonRecord>;
  streak: RoundStreak;
  best: number;
  cur: Round | null;
  snd: boolean;
  hap: boolean;
  rm: boolean | null;
  fs: boolean;
  tip: number;
  [k: string]: unknown;
}

/** The engine's defaults(). `fs` follows `(pointer: coarse)`: true on a phone. */
export function defaults(): ReckonSave {
  return {
    v: 1,
    done: {},
    streak: { last: null, n: 0, best: 0 },
    best: 0,
    cur: null,
    snd: true,
    hap: true,
    rm: null,
    fs: true,
    tip: 0,
  };
}

/** The save as the engine loads it: the stored document over the defaults, if it is a v1 one. */
export function loadSave(stored: unknown): ReckonSave {
  let save = defaults();
  const s = stored as { v?: unknown } | null;
  if (s && typeof s === 'object' && s.v === 1) save = Object.assign(defaults(), s) as ReckonSave;
  if (!save.done || typeof save.done !== 'object') save.done = {};
  return save;
}

/* ---------- state ---------- */

export type View = 'home' | 'play' | 'winModal';

export interface ReckonState {
  P: ReckonData;
  save: ReckonSave;
  view: View;
  paused: boolean;
  /** The round in play (`save.cur` itself while there is one: R === save.cur). */
  R: Round | null;
  /** The round on screen: 'R' the live one, a finished record being reviewed, or none. */
  VR: 'R' | { g: number[]; z: number[] } | null;
  /** The question on screen. */
  Q: number;
  /** The slider's ladder index. */
  CI: number;
  lockedAt: number;
  /** The coach tip's hidden attribute. */
  tipHidden: boolean;
  /** The record on the finish sheet. */
  shown: ReckonRecord | null;
  /** The clock's last frame time (the engine's `last`). */
  last: number;
  ending: boolean;
  /** A finished round waiting for `finishing.commitFinish` (set by nextQ on the tenth). */
  finishing: boolean;
}

/** What the page asks of the browser. */
export interface Host {
  /** performance.now(): ms. */
  now(): number;
  /** The London day now. */
  today(): string;
  /** dnCore.saveProgress(KEY, save, P.id): returns the merged save. */
  persist(save: ReckonSave, report: boolean): ReckonSave;
}

const vr = (s: ReckonState) => (s.VR === 'R' ? s.R : s.VR);
export const live = (s: ReckonState) => !!s.R && s.VR === 'R' && s.Q === s.R.i;
export const endRev = (s: ReckonState) => !!s.VR && s.VR !== 'R';
export function score(r: { z?: (number | null | undefined)[] } | null | undefined): number {
  return ((r && r.z) || []).reduce<number>((s, z) => s + (z == null ? 0 : PTS[z]!), 0);
}
export function liveStreak(save: ReckonSave, t: string, dayBefore: (d: string) => string) {
  const s = save.streak || ({} as RoundStreak);
  return s.last === t || s.last === dayBefore(t) ? s.n || 0 : 0;
}
export function bestScore(save: ReckonSave): number {
  return Math.max(
    0,
    +save.best || 0,
    ...Object.values(save.done || {}).map((d) => +(d && d.p) || 0),
  );
}

/** A copy of the state for one move, keeping the engine's aliasing (R is save.cur). */
function copy(s: ReckonState): ReckonState {
  const save: ReckonSave = JSON.parse(JSON.stringify(s.save));
  const aliased = !!s.R && s.R === s.save.cur;
  const R: Round | null = s.R ? (aliased ? save.cur : JSON.parse(JSON.stringify(s.R))) : null;
  const VR = s.VR && s.VR !== 'R' ? JSON.parse(JSON.stringify(s.VR)) : s.VR;
  return { ...s, save, R, VR };
}

/** A page opened: home, or the finish sheet for a round already finished. */
export function init(P: ReckonData, stored: unknown, now: number): ReckonState {
  const save = loadSave(stored);
  const s: ReckonState = {
    P,
    save,
    view: 'home',
    paused: false,
    R: null,
    VR: null,
    Q: 0,
    CI: 0,
    lockedAt: -1e9,
    tipHidden: true,
    shown: null,
    last: now,
    ending: false,
    finishing: false,
  };
  if (save.done[P.id]) {
    s.view = 'winModal';
    s.shown = save.done[P.id]!;
  }
  return s;
}

/* ---------- the ladder on screen ---------- */

export function ladderOf(s: ReckonState): number[] {
  const q = s.P.qs[s.Q]!;
  return ladder(q.lo, !!q.i);
}
const logs = (lad: number[]) => lad.map(L10);
function nearestIn(LOGS: number[], lv: number): number {
  let a = 0;
  let b = LOGS.length - 1;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (LOGS[m]! < lv) a = m;
    else b = m;
  }
  return lv - LOGS[a]! <= LOGS[b]! - lv ? a : b;
}
/** The ladder index nearest a log value on the question on screen (the engine's nearest). */
export function nearest(s: ReckonState, lv: number): number {
  return nearestIn(logs(ladderOf(s)), lv);
}
/** Where a value sits on the scale, 0–100 (posOf). */
export function posOf(lo: number, v: number): number {
  return Math.max(0, Math.min(100, ((L10(v) - lo) / SPAN) * 100));
}
/** The index a touch at fraction `fr` (0–1) of the track picks (fromX). */
export function fromFraction(s: ReckonState, fr: number): number {
  const f = Math.max(0, Math.min(1, fr));
  return nearest(s, s.P.qs[s.Q]!.lo + f * SPAN);
}
/** The fraction of the track a ladder index sits at (where a replay aims a drag). */
export function fractionOf(s: ReckonState, i: number): number {
  const lad = ladderOf(s);
  return (L10(lad[Math.max(0, Math.min(lad.length - 1, i))]!) - s.P.qs[s.Q]!.lo) / SPAN;
}

function setIdx(s: ReckonState, i: number) {
  const LAD = ladderOf(s);
  i = Math.max(0, Math.min(LAD.length - 1, i));
  s.CI = i;
  if (live(s) && s.R!.ph === 'g') s.R!.cur = LAD[i]!; // only the live guess is ever changed
}

/* ---------- the engine's functions ---------- */

function persist(s: ReckonState, host: Host, progress = true) {
  const playing = !!(s.save.done[s.P.id] || (s.save.cur && s.save.cur.id === s.P.id));
  const aliased = !!s.R && s.R === s.save.cur;
  s.save = host.persist(s.save, progress && playing);
  if (aliased) s.R = s.save.cur;
}

function renderQ(s: ReckonState) {
  const q = s.P.qs[s.Q]!;
  const guessing = live(s) && s.R!.ph === 'g';
  const LAD = ladder(q.lo, !!q.i);
  const LOGS = logs(LAD);
  if (guessing) {
    const R = s.R!;
    let CI = R.cur == null ? nearestIn(LOGS, q.lo + SPAN / 2) : Math.max(0, LAD.indexOf(R.cur));
    if (CI < 0) CI = nearestIn(LOGS, q.lo + SPAN / 2);
    s.CI = CI;
    setIdx(s, CI);
  } else {
    const g = vr(s)!.g[s.Q]!;
    s.CI = LAD.indexOf(g) >= 0 ? LAD.indexOf(g) : nearestIn(LOGS, L10(g));
    setIdx(s, s.CI);
  }
  s.tipHidden = !!s.save.tip || s.Q > 0 || !guessing;
}

function start(s: ReckonState, host: Host) {
  if (s.save.done[s.P.id]) {
    showResult(s, s.save.done[s.P.id]!);
    return;
  }
  const c = s.save.cur;
  const R: Round =
    c && c.id === s.P.id && Array.isArray(c.g) && Array.isArray(c.z)
      ? c
      : { id: s.P.id, i: 0, ph: 'g', g: [], z: [], cur: null, secs: 0 };
  if (!(R.i >= 0 && R.i < NQ)) R.i = Math.min(NQ - 1, R.z.length);
  s.save.cur = R;
  s.R = R;
  persist(s, host);
  s.paused = false;
  s.VR = 'R';
  s.Q = s.R!.i;
  s.view = 'play';
  renderQ(s);
  s.last = host.now();
}

function first(s: ReckonState, host: Host) {
  if (!s.tipHidden) {
    s.tipHidden = true;
    s.save.tip = 1;
    persist(s, host);
  }
}

function lockIn(s: ReckonState, host: Host) {
  if (!live(s) || s.R!.ph !== 'g' || s.paused) return;
  first(s, host);
  s.lockedAt = host.now();
  const R = s.R!;
  const q = s.P.qs[s.Q]!;
  const g = ladder(q.lo, !!q.i)[s.CI]!;
  const z = zone(g, q.a);
  R.g[R.i] = g;
  R.z[R.i] = z;
  R.ph = 'r';
  R.cur = null;
  persist(s, host);
}

function nextQ(s: ReckonState, host: Host) {
  if (!live(s) || s.R!.ph !== 'r') return;
  first(s, host);
  const R = s.R!;
  if (R.i < NQ - 1) {
    R.i++;
    R.ph = 'g';
    R.cur = null;
    s.Q = R.i;
    persist(s, host);
    renderQ(s);
  } else s.finishing = true;
}

function goTo(s: ReckonState, j: number) {
  if (!s.VR) return;
  const maxQ = endRev(s) ? NQ - 1 : s.R!.i;
  j = Math.max(0, Math.min(maxQ, j));
  if (j === s.Q) return;
  s.Q = j;
  renderQ(s);
}

function act(s: ReckonState, host: Host) {
  if (endRev(s)) {
    backToResult(s);
    return;
  }
  if (!s.R) return;
  if (!live(s)) {
    s.Q = s.R.i;
    renderQ(s);
    return;
  }
  if (s.R.ph === 'g') lockIn(s, host);
  else if (host.now() - s.lockedAt > 450) nextQ(s, host);
}

function step(s: ReckonState, host: Host, d: number) {
  if (!live(s) || s.R!.ph !== 'g' || s.paused) return;
  first(s, host);
  setIdx(s, s.CI + d);
}

function showResult(s: ReckonState, rec: ReckonRecord) {
  s.shown = rec;
  s.view = 'winModal';
}

function reviewEnd(s: ReckonState, k: number) {
  if (!s.shown) return;
  s.VR = { g: s.shown.g, z: s.shown.z };
  s.R = null;
  s.Q = k;
  s.paused = false;
  s.view = 'play';
  renderQ(s);
}

function backToResult(s: ReckonState) {
  s.VR = null;
  showResult(s, s.shown!);
}

function openPause(s: ReckonState, host: Host) {
  if (s.view !== 'play' || s.paused || endRev(s)) return;
  s.paused = true;
  persist(s, host);
}
function closePause(s: ReckonState, host: Host) {
  s.paused = false;
  s.last = host.now();
}

/* ---------- moves ---------- */

export type Move =
  /** Play or Resume on the start screen. */
  | { t: 'play' }
  /** A touch on the scale, dragged to `fr` (0–1 along the track) and let go. */
  | { t: 'drag'; fr: number }
  /** − (d −1) or + (d 1) tapped, or held for `hold` ms. */
  | { t: 'nudge'; d: -1 | 1; hold?: number }
  /** On the screen, a held − or + as it happens: one repeat (every 75 ms after 380 ms)… */
  | { t: 'repeat'; d: -1 | 1 }
  /** …and letting go of it (the press that follows a hold does nothing). */
  | { t: 'release' }
  /** Lock in / Next / See result / Back to question n / Back to results. */
  | { t: 'act' }
  /** ‹ (−1) or › (1). */
  | { t: 'nav'; d: -1 | 1 }
  /** A question pip. */
  | { t: 'pip'; k: number }
  | { t: 'pause' }
  | { t: 'resume' }
  /** Back to start, in the pause sheet. */
  | { t: 'quit' }
  /** A row of the finish sheet's recap: review that question. */
  | { t: 'recap'; k: number }
  /** The page closed and opened again (the save is all that's left). */
  | { t: 'reload' };

/** Steps a hold of `ms` makes: a repeat every 75 ms after 380 ms; a short press is one click. */
export function holdSteps(ms: number | undefined): number {
  if (!ms || ms < 380) return 1;
  return Math.floor((ms - 380) / 75);
}

/**
 * One move, as the page handles the taps that make it. Returns a new state; `persist`
 * is called wherever the engine saves. A finished ten sets `finishing`: the caller
 * then runs `finishing.commitFinish`, as the engine's finish() runs inside nextQ.
 */
export function apply(prev: ReckonState, move: Move, host: Host): ReckonState {
  if (move.t === 'reload') throw new Error('apply: a reload is the caller’s (see reopen)');
  const s = copy(prev);
  const playing = s.view === 'play';
  switch (move.t) {
    case 'play':
      if (s.view === 'home') start(s, host);
      break;
    case 'drag':
      if (!playing || !live(s) || s.R!.ph !== 'g' || s.paused) break;
      first(s, host);
      setIdx(s, fromFraction(s, move.fr));
      persist(s, host); // endDrag
      break;
    case 'nudge': {
      if (!playing || s.paused) break;
      // pointerdown, then the hold's repeats; pointerup saves; the click steps unless held
      if (move.hold && move.hold >= 380) {
        for (let k = holdSteps(move.hold); k > 0; k--) step(s, host, move.d);
        persist(s, host);
      } else {
        persist(s, host);
        step(s, host, move.d);
      }
      break;
    }
    case 'repeat':
      if (playing) step(s, host, move.d);
      break;
    case 'release':
      if (playing) persist(s, host);
      break;
    case 'act':
      if (playing && !s.paused) act(s, host);
      break;
    case 'nav':
      if (playing && !s.paused) goTo(s, s.Q + move.d);
      break;
    case 'pip':
      if (playing && !s.paused && s.VR) {
        const maxQ = endRev(s) ? NQ - 1 : s.R!.i;
        if (move.k <= maxQ) goTo(s, move.k);
      }
      break;
    case 'pause':
      if (playing) openPause(s, host);
      break;
    case 'resume':
      if (s.paused) closePause(s, host);
      break;
    case 'quit':
      if (s.paused) {
        closePause(s, host);
        persist(s, host);
        s.R = null;
        s.VR = null;
        s.view = 'home';
      }
      break;
    case 'recap':
      if (s.view === 'winModal') reviewEnd(s, move.k);
      break;
  }
  return s;
}

/** The page reopened from its save: what boot() shows. */
export function reopen(P: ReckonData, stored: unknown, now: number): ReckonState {
  return init(P, stored, now);
}

/**
 * The active-time clock, on every animation frame at time `t` (the engine's loop):
 * the play screen's time counts unless paused, a quarter of a second at most per frame.
 * Mutates `s` (a frame changes nothing the screen draws).
 */
export function frame(s: ReckonState, t: number): void {
  const dt = Math.min(0.25, Math.max(0, (t - s.last) / 1000));
  s.last = t;
  if (s.R && s.view === 'play' && !s.paused) s.R.secs = (s.R.secs || 0) + dt;
}

/* ---------- the finish ---------- */

/** The result the engine's finish() saves. */
export function finishRecord(s: ReckonState): ReckonRecord {
  const R = s.R!;
  const p = score(R);
  const b = R.z.filter((z) => z === 0).length;
  return { p, b, z: R.z.slice(), g: R.g.slice(), secs: Math.round(R.secs || 0) };
}

/** The finish sheet's one line (noteFor), as text: the page's <strong> is only bold. */
export function noteFor(P: ReckonData, rec: ReckonRecord): string {
  const b = rec.b;
  const spot = rec.g.filter((g, i) => Math.abs(g / P.qs[i]!.a - 1) < 0.005).length;
  if (b === NQ) return 'Ten bullseyes. Perfect.';
  if (b > 0)
    return (
      cap(W[b]!) +
      ' bullseye' +
      (b > 1 ? 's' : '') +
      (spot
        ? ', ' +
          (spot === b
            ? b > 1
              ? 'all'
              : 'and it was'
            : spot === 1
              ? 'one of them'
              : W[spot] + ' of them') +
          ' spot on.'
        : '.')
    );
  let best = Infinity;
  rec.g.forEach((g, i) => {
    const a = P.qs[i]!.a;
    const k = Math.max(g / a, a / g);
    if (k < best) best = k;
  });
  return 'No bullseyes today. Your closest was ' + Math.ceil((best - 1) * 100 - 1e-6) + '% out.';
}

/** The finish sheet's "Today's ten": one row per question. */
export function recapRows(P: ReckonData, rec: ReckonRecord) {
  return P.qs.map((q, k) => {
    const z = rec.z[k]!;
    const g = rec.g[k]!;
    return {
      q: q.q,
      line: 'You ' + withU(fmt(g), q.u) + ' · answer ' + withU(fmtA(q.a), q.u),
      pts: PTS[z]!,
      z,
    };
  });
}

/* ---------- what the play screen shows ---------- */

export interface Feedback {
  verdict: string;
  pts: string;
  zone: number;
  line: string;
  answer: string;
  unit: string;
  note: string;
  /** The note is hidden when it only restates the number. */
  noteHidden: boolean;
}

export interface PlayView {
  qn: string;
  score: number;
  chip: { name: string; colour: string };
  question: string;
  unit: string;
  /** The guess as the reading shows it. */
  guess: string;
  /** The slider's aria-valuetext. */
  guessText: string;
  index: number;
  ladderSize: number;
  prevDisabled: boolean;
  fwdDisabled: boolean;
  /** "Reviewing" / "Reviewing your round", or null when it is the live question. */
  reviewing: string | null;
  pauseHidden: boolean;
  guessing: boolean;
  feedback: Feedback | null;
  action: string;
  nudgeDisabled: boolean;
  tipHidden: boolean;
  pips: { k: number; view: boolean; live: boolean; zone: number | null; disabled: boolean }[];
  lo: number;
  /** The answer's place and its zone bands, once revealed. */
  answerAt: number | null;
  bands: { l: number; w: number; zone: number }[];
  thumbAt: number;
}

export function playView(s: ReckonState): PlayView {
  const q = s.P.qs[s.Q]!;
  const V = vr(s)!;
  const LAD = ladder(q.lo, !!q.i);
  const guessing = live(s) && s.R!.ph === 'g';
  const maxQ = endRev(s) ? NQ - 1 : s.R!.i;
  const v = LAD[s.CI]!;
  let feedback: Feedback | null = null;
  let action = 'Lock in';
  if (!guessing) {
    const g = V.g[s.Q]!;
    const z = V.z[s.Q]!;
    feedback = {
      verdict: ZN[z]!,
      pts: '+' + PTS[z],
      zone: z,
      line: offText(g, q.a),
      answer: fmtA(q.a),
      unit: q.u,
      note: q.n,
      noteHidden: !q.n || /^(About |Around |Up to about )?[\d.,]+( [^ .]+)?\.$/.test(q.n),
    };
    if (endRev(s)) action = 'Back to results';
    else if (!live(s)) action = 'Back to question ' + (s.R!.i + 1);
    else action = s.R!.i < NQ - 1 ? 'Next' : 'See result';
  }
  const bands: PlayView['bands'] = [];
  if (feedback)
    for (let k = BAND.length - 1; k >= 0; k--) {
      const l = Math.max(0, posOf(q.lo, q.a / BAND[k]!));
      const r = Math.min(100, posOf(q.lo, q.a * BAND[k]!));
      bands.push({ l, w: r - l, zone: k });
    }
  const pk = PACKS[q.k] || { n: 'Quiz', c: '#57534E' };
  return {
    qn: s.Q + 1 + '/' + NQ,
    score: score(V),
    chip: { name: pk.n, colour: pk.c },
    question: q.q,
    unit: q.u,
    guess: fmt(v),
    guessText: withU(fmt(v), q.u),
    index: s.CI,
    ladderSize: LAD.length,
    prevDisabled: s.Q <= 0,
    fwdDisabled: s.Q >= maxQ,
    reviewing: live(s) ? null : endRev(s) ? 'Reviewing your round' : 'Reviewing',
    pauseHidden: endRev(s),
    guessing,
    feedback,
    action,
    nudgeDisabled: !guessing,
    tipHidden: s.tipHidden,
    pips: Array.from({ length: NQ }, (_, k) => {
      const z = V.z[k];
      return {
        k,
        view: k === s.Q,
        live: z == null && !endRev(s) && k === s.R!.i,
        zone: z == null ? null : z,
        disabled: !(k <= maxQ),
      };
    }),
    lo: q.lo,
    answerAt: feedback ? posOf(q.lo, q.a) : null,
    bands,
    thumbAt: posOf(q.lo, v),
  };
}

/** The start screen's words (renderHome). */
export function homeView(s: ReckonState, t: string, dayBefore: (d: string) => string) {
  const n = liveStreak(s.save, t, dayBefore);
  const c = s.save.cur && s.save.cur.id === s.P.id ? s.save.cur : null;
  return {
    streak: n >= 1 ? n + '-day streak' : '',
    stats: [String(n), String(bestScore(s.save)), String(Object.keys(s.save.done || {}).length)],
    status: c
      ? 'Question ' + (c.i + 1) + ' of ' + NQ + ', ' + score(c) + ' points so far.'
      : 'Ten numbers to guess, each from a different topic. The closer you get, the more you score.',
    button: c ? 'Resume' : 'Play',
  };
}
