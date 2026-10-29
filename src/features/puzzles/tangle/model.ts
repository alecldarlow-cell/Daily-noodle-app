/**
 * Tangle, ported line for line from dailynoodle `engines/tangle.js`: the ship gate
 * (GATE), the save (load, persist, the day's round), tracing (hit, onDown, step,
 * onMove, onUp, tap), submitting and scoring, the round (setPaused, countIn, startPlay,
 * enterBoard, tick, endRound), the home card and the result. The engine is imperative,
 * so this port is too: one object per open puzzle, with the page's own variables.
 *
 * No React and no storage of its own: the save goes through core's saveProgress on the
 * store it is given, and the clock and timers are handed in, so the screen runs it on
 * the real clock and the differential replay on the page's fake one. The page ticks
 * every 100 ms (setInterval at load); the host calls `tick()` on the same beat.
 *
 * Ported: tracing by drag and by taps, the 3-2-1 count-in (the page adds a "Ready"
 * beat only just after entering full screen, which the app never does), pausing by
 * going back and by leaving the app, Resume, the 90 s round, scoring, the found list,
 * the toasts, the home card and the result. Not ported: typing on a hardware keyboard,
 * sound, the full-screen switch and the Sound / Reduced motion switches (the app keeps
 * their saved values untouched), the tile flashes, and Yesterday's answers.
 */
import { dayBefore, londonDay, type SaveStore } from '@noodle/core';

export const N = 4;
export const MINLEN = 3;
export const ROUND = 90;
export const KEY = 'digi-tangle-v1';
/** The site's tracker names Tangle by its page slug. */
export const SITE_TYPE = 'word-tangle';
/** Neighbours of every tile, row-major, as the engine's NB. */
export const NB: number[][] = (() => {
  const a: number[][] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const s: number[] = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r2 = r + dr;
          const c2 = c + dc;
          if ((dr || dc) && r2 >= 0 && r2 < N && c2 >= 0 && c2 < N) s.push(r2 * N + c2);
        }
      a.push(s);
    }
  return a;
})();

/** The page's `window.DN_PUZZLE` for a Tangle. */
export interface TangleData {
  id: string;
  date: string;
  n: number;
  band: string;
  grid: string[][];
  tiles: string[];
  star: string;
  starPath: number[];
  main: string[];
  bonus: string[];
}

// ---- the ship gate (engines/tangle.js GATE) ----

/** A trace of `w` over tiles `low` (lower-cased), or null. */
function traceOver(low: string[], w: string): number[] | null {
  const go = (i: number, pos: number, used: number): number[] | null => {
    const t = low[i]!;
    if (!w.startsWith(t, pos)) return null;
    const p2 = pos + t.length;
    if (p2 === w.length) return [i];
    for (const j of NB[i]!)
      if (!((used >> j) & 1)) {
        const r = go(j, p2, used | (1 << j));
        if (r) return [i].concat(r);
      }
    return null;
  };
  for (let i = 0; i < N * N; i++) {
    const r = go(i, 0, 1 << i);
    if (r) return r;
  }
  return null;
}

/** The gate's failures; empty when the page would play the puzzle. `metaDate` is dn:date. */
export function gate(P: unknown, metaDate: string | null): string[] {
  const f: string[] = [];
  if (!P || typeof P !== 'object') return ['no puzzle object'];
  const p = P as Record<string, unknown>;
  if (!/^DP·TANG·\d{4}$/.test(String(p.id || ''))) f.push('id ' + String(p.id));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date || ''))) f.push('date ' + String(p.date));
  if (metaDate != null && metaDate !== p.date)
    f.push('dn:date ' + metaDate + ' != ' + String(p.date));
  const grid = p.grid;
  if (
    !Array.isArray(grid) ||
    grid.length !== N ||
    grid.some((r) => !Array.isArray(r) || r.length !== N || r.some((c) => c !== '.'))
  )
    f.push('grid literal must be a 4x4 of "."');
  const T = p.tiles;
  if (
    !Array.isArray(T) ||
    T.length !== N * N ||
    T.some((t) => typeof t !== 'string' || !/^([A-PR-Z]|QU)$/.test(t))
  )
    return f.concat('tiles');
  const tiles = T as string[];
  if (tiles.filter((t) => t === 'QU').length > 1) f.push('more than one Qu');
  if (tiles.filter((t) => /^[JXZ]$/.test(t)).length > 1) f.push('more than one of J/X/Z');
  const low = tiles.map((t) => t.toLowerCase());
  const M = p.main;
  const B = p.bonus;
  if (!Array.isArray(M) || !Array.isArray(B)) return f.concat('word lists');
  if (M.length < 40 || M.length > 75) f.push('main count ' + M.length);
  const seen = new Set<unknown>();
  for (const w of (M as unknown[]).concat(B)) {
    if (typeof w !== 'string' || !/^[a-z]{3,16}$/.test(w)) {
      f.push('bad word ' + String(w));
      continue;
    }
    if (seen.has(w)) f.push('repeat ' + w);
    seen.add(w);
    if (!traceOver(low, w)) f.push('not traceable ' + w);
  }
  const s = p.star;
  if (typeof s !== 'string' || !M.includes(s) || s.length < 8) f.push('star');
  else {
    if ((M as unknown[]).concat(B).some((w) => w !== s && String(w).length >= s.length))
      f.push('star is not the unique longest word on the board');
    const sp = p.starPath;
    if (
      !Array.isArray(sp) ||
      new Set(sp).size !== sp.length ||
      sp.some(
        (x, k) =>
          !Number.isInteger(x) || x < 0 || x > 15 || (k && !NB[sp[k - 1] as number]!.includes(x)),
      ) ||
      sp.map((i) => low[i as number]).join('') !== s
    )
      f.push('star path');
  }
  return f;
}

export interface Validation {
  ok: boolean;
  fails: string[];
}

/** The gate as the page runs it (its dn:date is the puzzle's own `date` in the data file). */
export function validate(data: unknown, metaDate: string | null = null): Validation {
  const fails = gate(data, metaDate);
  const n = (data as { n?: unknown } | null)?.n;
  if (!Number.isInteger(n)) fails.push('n'); // the share line and recap read P.n
  return { ok: fails.length === 0, fails };
}

// ---- helpers (engines/tangle.js) ----

/** "1:30", "0:05"; hours if ever needed. */
export function mmss(x: number): string {
  const s = Math.max(0, Math.round(x));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
const NUM = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
]; // prettier-ignore
export const num = (n: number) => NUM[n] || String(n);
export const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]; // prettier-ignore
/**
 * The engine's longDate: Intl en-GB weekday, day, month and year at UTC noon, written
 * out here as Chromium formats it ("Sunday, 25 October 2026"), so every phone reads the
 * same (Safari's Intl drops the comma; Hermes's data may differ again).
 */
export function longDate(s: string): string {
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return s;
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Groups of words by length. */
export function groups(words: readonly string[]): Record<number, string[]> {
  const g: Record<number, string[]> = {};
  for (const w of words) (g[w.length] || (g[w.length] = [])).push(w);
  return g;
}

// ---- the engine ----

export interface Day {
  state: 'ready' | 'playing' | 'done';
  found: string[];
  left: number;
  score: number;
  [k: string]: unknown;
}

export interface SaveDocument {
  v: 1;
  days: Record<string, Day>;
  done: Record<string, Record<string, unknown>>;
  streak: { last: string | null; n: number; best: number };
  best: number;
  snd: boolean;
  rm: boolean | null;
  fs: boolean;
  [k: string]: unknown;
}

/** A tile's rectangle in the coordinates the pointer reports. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Timer = unknown;

export interface Deps {
  saves: SaveStore;
  /** The raw saved document (`localStorage.getItem(KEY)`). */
  read: () => string | null;
  /** Milliseconds: the page's performance.now()/Date.now(); only differences and the day matter. */
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => Timer;
  clearTimeout: (t: Timer) => void;
  /** The tiles' rectangles as laid out now (the page's measure()). */
  rects: () => Rect[];
  /** (pointer: coarse): true on a phone. */
  coarse?: boolean;
  /** The system's reduced-motion setting. */
  sysRM?: boolean;
  /** Something the screen shows changed. */
  changed?: () => void;
  /** The round ended and its result is shown for the first time (the tracker's "on"). */
  ended?: () => void;
}

export type View = 'home' | 'play' | 'winModal';

/**
 * The traced tiles' flash after a word is entered (engines/tangle.js flashTiles, AF-027):
 * green for every accepted word (rarer words too), gold only for the star word, grey
 * "meh" for too short, already found or not in today's list; about 420 ms, 250 ms with
 * reduced motion. Colours only: it never changes a move, a score or a save.
 */
export interface Flash {
  tiles: number[];
  cls: 'good' | 'gold' | 'meh';
}

export interface Toast {
  text: string;
  /** '' (hidden), 'on', 'on good', 'on gold' */
  cls: string;
}

export interface TangleEngine {
  readonly P: TangleData;
  /** The page's variables, read by the screen. */
  readonly s: {
    save: SaveDocument;
    D: Day;
    R: Day | null;
    view: View;
    paused: boolean;
    counting: boolean;
    /** What the count-in shows ('' when hidden). */
    count: string;
    path: number[];
    toast: Toast;
    /** The tiles flashing after the last word entered (AF-027), or null. */
    flash: Flash | null;
    /** The word last refused as not in today's list (the screen names it, AF-027). */
    missed: string;
    /** The word just found (the list marks it), until the list is drawn again. */
    fresh: string | null;
    /** The result was shown at the end of the round, rather than reopened. */
    freshResult: boolean;
  };
  live(): boolean;
  /** The 100 ms beat. */
  tick(): void;
  /** Play / Resume / View on the home card. */
  playCard(): void;
  /** The back arrow on the board: pause and show home. */
  home(): void;
  /** The veil's Resume, after leaving the app mid-round. */
  resume(): void;
  /** The app went to the background / came back (visibilitychange). */
  hidden(): void;
  visible(): void;
  /** The page is going away (pagehide): save. */
  leave(): void;
  down(x: number, y: number, id?: number, button?: number): void;
  move(points: [number, number][], id?: number): void;
  up(id?: number): void;
  cancel(id?: number): void;
  /** Submit a traced path (the engine's submit). */
  submit(p: number[]): { r: string; w?: string; pts?: number };
}

const DAY_STATES = ['ready', 'playing', 'done'];

/** Open a Tangle as its page does at load (boot). */
export function createTangle(P: TangleData, deps: Deps): TangleEngine {
  const coarse = deps.coarse ?? true;
  const low = P.tiles.map((t) => t.toLowerCase());
  const MAIN = new Set(P.main);
  const ALLW = new Set(P.main.concat(P.bonus));
  const changed = () => deps.changed?.();
  const today = () => londonDay(deps.now());

  const defaults = (): SaveDocument => ({
    v: 1,
    days: {},
    done: {},
    streak: { last: null, n: 0, best: 0 },
    best: 0,
    snd: true,
    rm: null,
    fs: coarse,
  });
  let save = defaults();
  try {
    const raw = deps.read();
    if (raw) {
      const s = JSON.parse(raw) as { v?: unknown } | null;
      if (s && s.v === 1) save = Object.assign(defaults(), s) as SaveDocument;
    }
  } catch {
    /* as the page: a broken save starts afresh */
  }
  const reduced = () => (save.rm === null ? !!deps.sysRM : !!save.rm);
  const pts = (w: string) => (w.length - 2) * (w === P.star ? 2 : 1);

  function persist(progress = true) {
    const d = save.days && save.days[P.id];
    const playing = !!(save.done[P.id] || (d && d.state !== 'ready'));
    deps.saves.saveProgress(
      KEY,
      save as unknown as Record<string, unknown>,
      P.id,
      progress && playing,
    );
  }
  function day(): Day {
    let d = save.days[P.id];
    if (!d || !Array.isArray(d.found) || !DAY_STATES.includes(d.state)) {
      d = { state: 'ready', found: [], left: ROUND, score: 0 };
      save.days[P.id] = d;
    }
    return d;
  }

  const st: TangleEngine['s'] = {
    save,
    D: day(),
    R: null,
    view: 'home',
    paused: false,
    counting: false,
    count: '',
    path: [],
    toast: { text: '', cls: '' },
    flash: null,
    missed: '',
    fresh: null,
    freshResult: false,
  };
  let last = deps.now();
  let drag: { id: number; start: number; moved: boolean; lx: number; ly: number } | null = null;
  let cdT: Timer = null;
  let toastT: Timer = null;
  let flashT: Timer = null;
  let rects: Rect[] = [];

  const live = () =>
    st.view === 'play' && !!st.R && st.R.state === 'playing' && !st.paused && !st.counting;
  const show = (v: View) => {
    st.view = v;
  };

  // ---- toasts ----
  function toast(msg: string, kind?: string) {
    st.toast = { text: msg, cls: 'on' + (kind ? ' ' + kind : '') };
    deps.clearTimeout(toastT);
    toastT = deps.setTimeout(() => {
      st.toast = { ...st.toast, cls: '' };
      changed();
    }, 1100);
  }

  // ---- tracing ----
  const measure = () => {
    rects = deps.rects();
  };
  function hit(x: number, y: number, inner: boolean) {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]!;
      const m = inner ? 0.15 : 0;
      const right = r.left + r.width;
      const bottom = r.top + r.height;
      if (
        x >= r.left + r.width * m &&
        x <= right - r.width * m &&
        y >= r.top + r.height * m &&
        y <= bottom - r.height * m
      )
        return i;
    }
    return -1;
  }
  const canAdd = (i: number) =>
    i >= 0 &&
    !st.path.includes(i) &&
    (st.path.length === 0 || NB[st.path[st.path.length - 1]!]!.includes(i));
  function flashTiles(p: number[], cls: Flash['cls']) {
    st.flash = { tiles: p.slice(), cls };
    deps.clearTimeout(flashT);
    flashT = deps.setTimeout(
      () => {
        st.flash = null;
        deps.changed?.();
      },
      reduced() ? 250 : 420,
    );
  }
  function add(i: number) {
    if (!st.path.length) {
      st.toast = { ...st.toast, cls: '' };
      st.flash = null;
    }
    st.path = [...st.path, i];
  }
  const wordOf = (p: number[]) => p.map((i) => low[i]).join('');

  function step(x: number, y: number) {
    if (!drag) return;
    const i = hit(x, y, true);
    if (!drag.moved) {
      if (i < 0 || i === drag.start) return;
      if (!(st.path.length && st.path[st.path.length - 1] === drag.start)) {
        st.path = [];
        add(drag.start);
      }
      drag.moved = true;
    }
    if (i >= 0) {
      if (st.path.length >= 2 && st.path[st.path.length - 2] === i) st.path = st.path.slice(0, -1);
      else if (canAdd(i)) add(i);
    }
  }
  function tap(i: number) {
    if (st.path.length && st.path[st.path.length - 1] === i) {
      const p = st.path.slice();
      st.path = [];
      submit(p);
      return;
    }
    const k = st.path.indexOf(i);
    if (k >= 0) {
      st.path = st.path.slice(0, k + 1);
      return;
    }
    if (canAdd(i)) {
      add(i);
      return;
    }
    st.path = [];
    add(i);
  }

  // ---- submitting ----
  function submit(p: number[]): { r: string; w?: string; pts?: number } {
    const R = st.R;
    if (!R || R.state !== 'playing') return { r: 'locked' };
    const w = wordOf(p);
    if (w.length < MINLEN) {
      toast('Too short');
      flashTiles(p, 'meh');
      return { r: 'short', w };
    }
    if (R.found.includes(w)) {
      toast('Already found');
      flashTiles(p, 'meh');
      return { r: 'dup', w };
    }
    if (!ALLW.has(w)) {
      toast("Not in today's list");
      st.missed = w;
      flashTiles(p, 'meh');
      return { r: 'none', w };
    }
    const g = pts(w);
    R.found.push(w);
    R.score += g;
    persist();
    st.fresh = w;
    // AF-027 (site S2): every accepted word flashes green, rarer words included; gold is
    // only for the star word, and a rarer word says so in its message.
    flashTiles(p, w === P.star ? 'gold' : 'good');
    if (w === P.star) toast('★ Longest word! +' + g, 'gold');
    else toast('+' + g + ' ' + w.toUpperCase() + (MAIN.has(w) ? '' : ' · rarer word'), 'good');
    return { r: MAIN.has(w) ? 'main' : 'bonus', w, pts: g };
  }

  // ---- the round ----
  function stopCount() {
    deps.clearTimeout(cdT);
    if (!st.counting) return;
    st.counting = false;
    st.count = '';
  }
  function countIn() {
    stopCount();
    st.counting = true;
    st.count = '';
    drag = null;
    st.path = [];
    const beats = ['3', '2', '1'];
    const stepBeat = () => {
      if (!st.counting) return;
      if (!beats.length) {
        st.counting = false;
        st.count = '';
        last = deps.now();
        changed();
        return;
      }
      st.count = beats.shift()!;
      cdT = deps.setTimeout(stepBeat, 1000);
      changed();
    };
    stepBeat();
  }
  function setPaused(on: boolean) {
    st.paused = on;
    if (on) stopCount();
    if (on) {
      drag = null;
      st.path = [];
      persist();
    } else {
      last = deps.now();
      if (st.R && st.R.state === 'playing') countIn();
    }
  }
  function enterBoard() {
    st.path = [];
    show('play');
    st.fresh = null;
    setPaused(false);
    last = deps.now();
  }
  function startPlay() {
    if (st.D.state === 'done') {
      showResult(false);
      return;
    }
    st.R = st.D;
    if (st.D.state === 'ready') {
      st.D.state = 'playing';
      st.D.left = ROUND;
      persist();
    }
    enterBoard();
  }
  function endRound() {
    const R = st.R;
    if (!R || R.state !== 'playing') return;
    R.state = 'done';
    R.left = 0;
    drag = null;
    st.path = [];
    const D = st.D;
    save.done[P.id] = {
      o: 'played',
      s: D.score,
      w: D.found.length,
      st: D.found.includes(P.star),
      d: today(),
    };
    save.best = Math.max(save.best || 0, D.score);
    const t = today();
    if (P.date === t) {
      const s = save.streak || { last: null, n: 0, best: 0 };
      if (s.last !== t) {
        s.n = s.last === dayBefore(t) ? s.n + 1 : 1;
        s.last = t;
      }
      s.best = Math.max(s.best || 0, s.n);
      save.streak = s;
    }
    persist();
    deps.setTimeout(
      () => {
        showResult(true);
        changed();
      },
      reduced() ? 100 : 600,
    );
  }
  function showResult(fresh: boolean) {
    show('winModal');
    st.freshResult = fresh;
    if (fresh) deps.ended?.();
  }

  // boot
  if (st.D.state === 'done' && save.done[P.id]) showResult(false);
  else show('home');

  const engine: TangleEngine = {
    P,
    get s() {
      st.save = save;
      return st;
    },
    live,
    tick() {
      const now = deps.now();
      const dt = Math.min(1, Math.max(0, (now - last) / 1000));
      last = now;
      const R = st.R;
      if (st.view !== 'play' || !R || R.state !== 'playing' || st.paused || st.counting) return;
      const before = Math.ceil(R.left);
      R.left = Math.max(0, R.left - dt);
      const after = Math.ceil(R.left);
      if (after !== before) {
        if (after % 5 === 0) persist();
        changed();
      }
      if (R.left <= 0) {
        endRound();
        changed();
      }
    },
    playCard() {
      startPlay();
      changed();
    },
    home() {
      if (st.R && st.R.state === 'playing') setPaused(true);
      show('home');
      changed();
    },
    resume() {
      setPaused(false);
      changed();
    },
    hidden() {
      if (st.view === 'play' && st.R && st.R.state === 'playing') setPaused(true);
      persist();
      changed();
    },
    visible() {
      last = deps.now();
    },
    leave() {
      persist();
    },
    down(x, y, id = 1, button = 0) {
      if (!live()) return;
      if (button > 0) return;
      if (drag) return;
      measure();
      const i = hit(x, y, false);
      if (i < 0) return;
      drag = { id, start: i, moved: false, lx: x, ly: y };
    },
    move(points, id = 1) {
      if (!drag || id !== drag.id) return;
      const unit = rects.length ? rects[0]!.width / 6 : 10;
      for (const [qx, qy] of points) {
        const d = drag;
        if (!d) break;
        const dx = qx - d.lx;
        const dy = qy - d.ly;
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / unit));
        for (let k = 1; k <= n; k++) step(d.lx + (dx * k) / n, d.ly + (dy * k) / n);
        d.lx = qx;
        d.ly = qy;
      }
      changed();
    },
    up(id = 1) {
      if (!drag || id !== drag.id) return;
      const d = drag;
      drag = null;
      if (!live()) {
        st.path = [];
        changed();
        return;
      }
      if (d.moved) {
        const p = st.path.slice();
        st.path = [];
        if (p.length > 1) submit(p);
        changed();
        return;
      }
      tap(d.start);
      changed();
    },
    cancel(id = 1) {
      if (drag && id === drag.id) {
        drag = null;
        st.path = [];
        changed();
      }
    },
    submit(p) {
      const r = submit(p);
      changed();
      return r;
    },
  };
  return engine;
}

// ---- what the screens show ----

export const liveStreakOf = (save: SaveDocument, t: string) => {
  const s = save.streak || { n: 0, last: null };
  return s.last === t || s.last === dayBefore(t) ? s.n : 0;
};

/** The home card: head, status line, the button's word, and the three stats. */
export function homeCard(e: TangleEngine, t: string) {
  const { P } = e;
  const { D, save } = e.s;
  let head: string;
  let status: string;
  let go: string;
  if (D.state === 'done') {
    head = plural(D.score, 'point', 'points');
    status = `${plural(D.found.length, 'word', 'words')} today. See the answers; a new board arrives at midnight.`;
    go = 'View';
  } else if (D.state === 'playing') {
    head = 'Round paused';
    status = `${mmss(D.left)} left, ${plural(D.score, 'point', 'points')} so far.`;
    go = 'Resume';
  } else {
    head = 'Today’s Tangle';
    status = `90 seconds. Longer words score more; the ${num(P.star.length)}-letter word scores double.`;
    go = 'Play';
  }
  return {
    num: `No. ${parseInt(P.id.slice(-4), 10)}`,
    date: `No. ${parseInt(P.id.slice(-4), 10)}, ${longDate(P.date).replace(/ \d{4}$/, '')}`,
    head,
    status,
    go,
    streak: liveStreakOf(save, t),
    best: save.best || 0,
    played: Object.keys(save.done || {}).length,
  };
}

/** The board's top: score, word count, the star pill, the clock and its low mark. */
export function boardTop(e: TangleEngine) {
  const { P } = e;
  const R = e.s.R;
  const found = R ? R.found : [];
  const got = found.includes(P.star);
  const pts = (P.star.length - 2) * 2;
  const left = Math.max(0, R ? R.left : ROUND);
  return {
    score: R ? R.score : 0,
    words: plural(found.length, 'word', 'words'),
    star: got
      ? `★ ${P.star.toUpperCase()} +${pts}`
      : `★ Longest word: ${num(P.star.length)} letters, double points`,
    starGot: got,
    clock: mmss(Math.ceil(left - 1e-9)),
    low: left <= 10 && !!R && R.state === 'playing',
    fill: left / ROUND,
  };
}

export interface ListGroup {
  len: number;
  label: string;
  count: string;
  words: { w: string; star: boolean; bonus: boolean; fresh: boolean }[];
}

/** The found list (renderList): by length, longest first, with each length's tally. */
export function foundList(e: TangleEngine): ListGroup[] {
  const { P } = e;
  const R = e.s.R;
  const found = R ? R.found : [];
  const MAIN = new Set(P.main);
  const gm = groups(P.main);
  const gf = groups(found);
  const lens = [...new Set(Object.keys(gm).concat(Object.keys(gf)).map(Number))].sort(
    (a, b) => b - a,
  );
  const out: ListGroup[] = [];
  for (const L of lens) {
    const f = (gf[L] || []).slice().sort();
    const common = (gm[L] || []).length;
    const got = (gm[L] || []).filter((w) => found.includes(w)).length;
    if (!f.length && !common) continue;
    out.push({
      len: L,
      label: `${L} letters · ${plural(L - 2, 'pt', 'pts')} each`,
      count: common ? `${got} of ${common}` : '',
      words: f.map((w) => ({ w, star: w === P.star, bonus: !MAIN.has(w), fresh: w === e.s.fresh })),
    });
  }
  return out;
}

/** The line over the board: the traced word, or the hint while the round is live. */
export function current(e: TangleEngine, coarse = true) {
  const low = e.P.tiles.map((t) => t.toLowerCase());
  const w = e.s.path.map((i) => low[i]).join('');
  if (w) return { text: w, idle: false };
  return {
    text: e.live()
      ? coarse
        ? 'Drag across letters, or tap them'
        : 'Drag, tap, or type a word'
      : '',
    idle: true,
  };
}

// ---- the result ----

export interface ResultInfo {
  kick: string;
  score: number;
  title: string;
  /** mmss(ROUND − left): the round's length, read by the tracker. */
  time: string;
  words: number;
  best: number;
  streak: number;
  star: string;
  share: string;
  /** The sheet's line, with the star word to set in bold. */
  note: { before: string; bold: string; after: string };
}

export function shareLine(P: TangleData, D: Day): string {
  const star = D.found.includes(P.star) ? ' ★' : '';
  return `🧶 Tangle #${P.n} — ${plural(D.score, 'point', 'points')}, ${plural(D.found.length, 'word', 'words')}${star}`;
}

/** showResult's fields and the sheet's note. */
export function result(e: TangleEngine, t: string): ResultInfo {
  const { P } = e;
  const r = e.s.D;
  const save = e.s.save;
  const sw = P.star.toUpperCase();
  const sp = (P.star.length - 2) * 2;
  const words = plural(r.found.length, 'word', 'words');
  const got = r.found.includes(P.star);
  return {
    kick: `Tangle ${parseInt(P.id.slice(-4), 10)}, ${longDate(P.date)}`,
    score: r.score,
    title: e.s.freshResult ? 'Time’s up' : 'Your score',
    time: mmss(ROUND - Math.max(0, r.left)),
    words: r.found.length,
    best: save.best || 0,
    streak: liveStreakOf(save, t),
    star: got
      ? `You found the longest word, ${sw}, for ${sp} points.`
      : `The longest word was ${sw}, worth ${sp} points.`,
    share: shareLine(P, r),
    note: got
      ? { before: `${words}, including the longest, `, bold: sw, after: `, for ${sp} points.` }
      : { before: `${words}. The longest was `, bold: sw, after: `, worth ${sp}.` },
  };
}

/** dn-track.js's mmss: "1:30" → 90. */
function shownSeconds(t: string): number | null {
  const m = /(\d+):(\d{2})(?::(\d{2}))?/.exec(String(t || ''));
  if (!m) return null;
  return m[3] ? +m[1]! * 3600 + +m[2]! * 60 + +m[3] : +m[1]! * 60 + +m[2]!;
}

/** The `dn:puzzle_end` detail the tracker sends when the round's result first shows. */
export function endDetail(info: ResultInfo): Record<string, unknown> {
  return {
    type: SITE_TYPE,
    tv: 3,
    outcome: 'scored',
    secs: shownSeconds(info.time),
    checks: 0,
    reveals: 0,
    hints: 0,
    score: info.score,
    words: info.words,
  };
}

export interface RecapGroup {
  len: number;
  label: string;
  count: string;
  words: { w: string; got: boolean; star: boolean; pts: number }[];
}

/** The sheet's recap (recapNode): the meter and every common word, found ones first. */
export function recap(P: TangleData, found: string[]) {
  const MAIN = new Set(P.main);
  const BONUS = new Set(P.bonus);
  const pts = (w: string) => (w.length - 2) * (w === P.star ? 2 : 1);
  const g = groups(P.main);
  const all = P.main.reduce((n, w) => n + pts(w), 0);
  const got = found.filter((w) => MAIN.has(w));
  const score = got.reduce((n, w) => n + pts(w), 0);
  const lists: RecapGroup[] = Object.keys(g)
    .map(Number)
    .sort((a, b) => b - a)
    .map((L) => {
      const ws = g[L]!.slice().sort(
        (a, b) => Number(found.includes(b)) - Number(found.includes(a)) || a.localeCompare(b),
      );
      return {
        len: L,
        label: `${L} letters, ${plural(L - 2, 'point', 'points')} each`,
        count: `${ws.filter((w) => found.includes(w)).length} of ${ws.length}`,
        words: ws.map((w) => ({ w, got: found.includes(w), star: w === P.star, pts: pts(w) })),
      };
    });
  const bf = found.filter((w) => BONUS.has(w));
  return {
    meter: `You found ${got.length} of ${P.main.length}`,
    points: `${score} of ${all} points`,
    pct: Math.round((100 * got.length) / P.main.length),
    lists,
    rare: `Rarer words: ${bf.length} of ${P.bonus.length} found`,
    rareList: P.bonus.map((w) => (found.includes(w) ? w + ' ✓' : w)).join(' · '),
  };
}
