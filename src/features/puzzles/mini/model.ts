/**
 * The Mini, as a pure model: ported line for line from dailynoodle `engines/mini.js`
 * (findSlots, numberGrid, wordAt, clueList, load, the square and clue-bar taps, advance,
 * advanceEmpty (AF-031),
 * type, del, gotoClue, checkCells, revealCells, checkWin, the finish sheet's note,
 * restoreDone) and from `dn-track.js` (how the tracker counts Check and Reveal presses
 * and names the outcome). No React, no storage, no clock: the screen owns the clock
 * and passes its reading to `finish`.
 *
 * Moves are the controls a phone player has on the page: squares, the on-screen
 * keyboard, the clue bar, ‹ ›, Check word, Check all and Reveal word. Reveal all, Reset
 * and the keyboard toggle have been hidden on every device since 15 Oct 2026
 * (engines/mini.css), and the full clue list on phones, so they are not ported; the
 * outcome is therefore always "solved" (dn-track.js says "revealed" only after Reveal all).
 *
 * Proven identical to the web engine by `scripts/replay.js` (every published Mini,
 * move by move: letters, cursor, highlighted word, check marks, clue bar, clock, then
 * the saved record, streak, `dn:puzzle_end` detail and share line).
 */

export type Dir = 'A' | 'D';
export type Cell = readonly [number, number];
export type Mark = 'good' | 'bad' | null;

/** The page's `window.DN_PUZZLE` for a Mini. */
export interface MiniData {
  type: 'mini';
  id: string;
  band: string;
  grid: string[][];
  clues: Record<string, string>;
}

export interface Slot {
  t: Dir;
  r: number;
  c: number;
  L: number;
  cells: Cell[];
}

export interface MiniPuzzle {
  id: string;
  band: string;
  grid: string[][];
  clues: Record<string, string>;
  slots: Slot[];
  nums: number[][];
}

export interface MiniState {
  p: MiniPuzzle;
  /** The player's letters ('' empty, '#' a block), upper case. */
  entries: string[][];
  checked: Mark[][];
  sel: { r: number; c: number; dir: Dir };
  /** The word the clue bar shows: the page repaints it only when the cursor has a word. */
  last: Slot | undefined;
  /** The clock is running (the engine's `started`): set by the first letter, delete or reveal. */
  started: boolean;
  solved: boolean;
  /** The engine's own counts, for the finish sheet's one line. */
  used: { checks: number; reveals: number };
  /** What dn-track.js counts from button presses, for `dn:puzzle_end`. */
  track: { checks: number; reveals: number; hints: number };
}

export type Move =
  /** Tap a square. */
  | { t: 'cell'; r: number; c: number }
  /** A letter, from the on-screen keyboard or a typed key. */
  | { t: 'key'; ch: string }
  /** ⌫ or Backspace. */
  | { t: 'del' }
  /** Tap the clue bar: switch across/down where the square has both. */
  | { t: 'bar' }
  /** ‹ / › (Shift-Tab / Tab): previous or next clue. */
  | { t: 'step'; delta: 1 | -1 }
  | { t: 'checkWord' }
  | { t: 'checkAll' }
  | { t: 'revealWord' };

/** The record the web writes to `digi-mini-v1` › done[id] (before putDone adds `d`). */
export interface MiniRecord {
  s: number;
}
export type MiniOutcome = 'solved';
export interface MiniEnd {
  secs: number;
  checks: number;
  reveals: number;
  hints: number;
}

export const SAVE_KEY = 'digi-mini-v1';
export const STREAK_KEY = 'digi-mini-streak';
/** The site's tracker names the Mini by its page slug. */
export const SITE_TYPE = 'crossword-mini';

// ---- validate: refuse what the web player can't show or can't finish ----

export interface Validation {
  ok: boolean;
  checks: Record<string, boolean>;
}

const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Whether the web player could play this puzzle to a finish. The Mini's page has no
 * load-time ship gate of its own (the generator's `validate` runs before publishing,
 * not in the player), so these are the conditions the player's code depends on, each
 * one a place where `engines/mini.js` would throw or could never reach "Solved":
 * - a 5×5 grid of arrays (`P.grid.map(row => row.map(…))`, `grid[r][c]` for r, c < 5);
 * - every square '#' or one letter A-Z (typed letters are upper-cased and compared
 *   with `===`, so anything else can never be matched);
 * - no run of exactly two letters (`findSlots` returns null and `load` throws);
 * - at least one word (`load` reads `first.cells`);
 * - clues an object (`P.clues[ans]`), and an id the save and share line can use.
 */
export function validate(data: unknown): Validation {
  const d = object(data) ? data : {};
  const grid = d.grid;
  const shape =
    Array.isArray(grid) &&
    grid.length === 5 &&
    grid.every((row) => Array.isArray(row) && row.length === 5);
  const letters =
    shape &&
    (grid as unknown[][]).every((row) =>
      row.every((ch) => ch === '#' || (typeof ch === 'string' && /^[A-Z]$/.test(ch))),
    );
  const slots = shape ? findSlots(grid as string[][]) : null;
  const checks: Record<string, boolean> = {
    is_mini: d.type === 'mini',
    has_id: typeof d.id === 'string' && /^DP·MINI·\d+$/.test(d.id),
    grid_5x5: shape,
    letters_a_to_z: !!letters,
    no_two_letter_runs: slots !== null,
    has_words: !!slots && slots.length > 0,
    clues_object: object(d.clues),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

// ---- numbering and slots (engines/mini.js findSlots, numberGrid) ----

export function findSlots(grid: string[][]): Slot[] | null {
  const slots: Slot[] = [];
  for (let r = 0; r < 5; r++) {
    let c = 0;
    while (c < 5) {
      if (grid[r]![c] === '#') {
        c++;
        continue;
      }
      const s = c;
      while (c < 5 && grid[r]![c] !== '#') c++;
      const L = c - s;
      if (L === 2) return null;
      if (L >= 3) {
        const cells: Cell[] = [];
        for (let x = s; x < c; x++) cells.push([r, x]);
        slots.push({ t: 'A', r, c: s, L, cells });
      }
    }
  }
  for (let c = 0; c < 5; c++) {
    let r = 0;
    while (r < 5) {
      if (grid[r]![c] === '#') {
        r++;
        continue;
      }
      const s = r;
      while (r < 5 && grid[r]![c] !== '#') r++;
      const L = r - s;
      if (L === 2) return null;
      if (L >= 3) {
        const cells: Cell[] = [];
        for (let y = s; y < r; y++) cells.push([y, c]);
        slots.push({ t: 'D', r: s, c, L, cells });
      }
    }
  }
  return slots;
}

export function numberGrid(grid: string[][]): number[][] {
  const nums = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  let n = 0;
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      if (grid[r]![c] === '#') continue;
      const startA = (c === 0 || grid[r]![c - 1] === '#') && c < 4 && grid[r]![c + 1] !== '#';
      const startD = (r === 0 || grid[r - 1]![c] === '#') && r < 4 && grid[r + 1]![c] !== '#';
      if (startA || startD) nums[r]![c] = ++n;
    }
  return nums;
}

export function wordAt(p: MiniPuzzle, r: number, c: number, dir: Dir): Slot | undefined {
  return p.slots.find((s) => s.t === dir && s.cells.some(([y, x]) => y === r && x === c));
}

const answerOf = (p: MiniPuzzle, s: Slot) =>
  s.cells
    .map(([y, x]) => p.grid[y]![x])
    .join('')
    .toLowerCase();

/** A word's clue, or "(5)" when the puzzle has none for it, as the engine shows. */
export function clueFor(p: MiniPuzzle, s: Slot): string {
  return p.clues[answerOf(p, s)] || `(${s.L})`;
}

export interface ClueLine {
  num: number;
  clue: string;
  r: number;
  c: number;
  dir: Dir;
  ans: string;
}

export function clueList(p: MiniPuzzle, dir: Dir): ClueLine[] {
  return p.slots
    .filter((s) => s.t === dir)
    .map((s) => {
      const [r, c] = s.cells[0]!;
      return { num: p.nums[r]![c]!, clue: clueFor(p, s), r, c, dir, ans: answerOf(p, s) };
    })
    .sort((a, b) => a.num - b.num);
}

// ---- state ----

export function puzzleOf(data: MiniData): MiniPuzzle {
  return {
    id: data.id,
    band: data.band,
    grid: data.grid,
    clues: data.clues,
    slots: findSlots(data.grid) ?? [],
    nums: numberGrid(data.grid),
  };
}

function fresh(p: MiniPuzzle) {
  const first = p.slots.find((s) => s.t === 'A') || p.slots[0]!;
  return {
    entries: p.grid.map((row) => row.map((ch) => (ch === '#' ? '#' : ''))),
    checked: p.grid.map((row) => row.map((): Mark => null)),
    sel: { r: first.cells[0]![0], c: first.cells[0]![1], dir: first.t },
    last: first as Slot | undefined,
    started: false,
    solved: false,
  };
}

/** A new game (the engine's `load`). `data` must have passed `validate`. */
export function init(data: MiniData): MiniState {
  const p = puzzleOf(data);
  return {
    p,
    ...fresh(p),
    used: { checks: 0, reveals: 0 },
    track: { checks: 0, reveals: 0, hints: 0 },
  };
}

/** A finished puzzle reopened from its save (the engine's `restoreDone`). */
export function restore(data: MiniData): MiniState {
  const s = init(data);
  s.entries = s.p.grid.map((row) => row.slice());
  s.checked = s.p.grid.map((row) => row.map((ch): Mark => (ch === '#' ? null : 'good')));
  s.solved = true;
  return s;
}

export function allCells(p: MiniPuzzle): Cell[] {
  const a: Cell[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (p.grid[r]![c] !== '#') a.push([r, c]);
  return a;
}

/** The engine's orderedSlots: across by number, then down by number. */
export function orderedSlots(p: MiniPuzzle): Slot[] {
  const num = (s: Slot) => p.nums[s.cells[0]![0]]![s.cells[0]![1]]!;
  const A = p.slots.filter((s) => s.t === 'A').sort((a, b) => num(a) - num(b));
  const D = p.slots.filter((s) => s.t === 'D').sort((a, b) => num(a) - num(b));
  return A.concat(D);
}

const flip = (d: Dir): Dir => (d === 'A' ? 'D' : 'A');

/** Apply one move; returns a new state (the old one is never changed). */
export function apply(prev: MiniState, move: Move): MiniState {
  const s: MiniState = {
    ...prev,
    entries: prev.entries.map((row) => row.slice()),
    checked: prev.checked.map((row) => row.slice()),
    sel: { ...prev.sel },
    used: { ...prev.used },
    track: { ...prev.track },
  };
  const P = s.p;
  const startTimer = () => {
    if (s.started || s.solved) return;
    s.started = true;
  };
  const advance = (back = false) => {
    const w = wordAt(P, s.sel.r, s.sel.c, s.sel.dir);
    if (!w) return;
    const i = w.cells.findIndex(([y, x]) => y === s.sel.r && x === s.sel.c);
    const j = back ? i - 1 : i + 1;
    if (j >= 0 && j < w.cells.length) {
      s.sel.r = w.cells[j]![0];
      s.sel.c = w.cells[j]![1];
    }
  };
  /*
   * After a letter (engines/mini.js advanceEmpty, AF-031, 29 Oct 2026, agreed with Alec):
   * the next EMPTY square in the word (forward, then back round to the word's start), so
   * letters already in from crossing answers aren't typed over. If the word is now full,
   * the next clue in the clue bar's order (across, then down, round again) that has an
   * empty square, at its first one. A full grid stays where it is.
   */
  const advanceEmpty = () => {
    const w = wordAt(P, s.sel.r, s.sel.c, s.sel.dir);
    if (!w) return;
    const empty = ([y, x]: Cell) => !s.entries[y]![x];
    const i = w.cells.findIndex(([y, x]) => y === s.sel.r && x === s.sel.c);
    const n = w.cells.length;
    for (let k = 1; k < n; k++) {
      const cell = w.cells[(i + k) % n]!;
      if (empty(cell)) {
        s.sel.r = cell[0];
        s.sel.c = cell[1];
        return;
      }
    }
    const list = orderedSlots(P);
    const at = list.indexOf(w);
    for (let k = 1; k <= list.length; k++) {
      const sl = list[(at + k) % list.length]!;
      const cell = sl.cells.find(empty);
      if (cell) {
        s.sel = { r: cell[0], c: cell[1], dir: sl.t };
        return;
      }
    }
  };
  const checkWin = () => {
    if (s.solved) return;
    const done = allCells(P).every(([r, c]) => s.entries[r]![c] === P.grid[r]![c]);
    if (!done) return;
    s.solved = true;
    // celebrate(): every square turns good
    for (const [r, c] of allCells(P)) s.checked[r]![c] = 'good';
  };
  const checkCells = (cells: readonly Cell[]) => {
    for (const [r, c] of cells) {
      if (P.grid[r]![c] === '#') continue;
      const e = s.entries[r]![c]!;
      s.checked[r]![c] = e === P.grid[r]![c] ? (e ? 'good' : null) : e ? 'bad' : null;
    }
  };
  const revealCells = (cells: readonly Cell[]) => {
    startTimer();
    for (const [r, c] of cells) {
      if (P.grid[r]![c] === '#') continue;
      s.entries[r]![c] = P.grid[r]![c]!;
      s.checked[r]![c] = 'good';
    }
    checkWin();
  };
  switch (move.t) {
    case 'cell': {
      const { r, c } = move;
      if (P.grid[r]?.[c] === undefined || P.grid[r]![c] === '#') return prev;
      if (s.sel.r === r && s.sel.c === c) s.sel.dir = flip(s.sel.dir);
      else s.sel = { r, c, dir: s.sel.dir };
      if (!wordAt(P, r, c, s.sel.dir)) s.sel.dir = flip(s.sel.dir);
      break;
    }
    case 'key': {
      if (!/^[a-z]$/i.test(move.ch)) return prev;
      if (P.grid[s.sel.r]![s.sel.c] === '#' || s.solved) return prev;
      startTimer();
      s.entries[s.sel.r]![s.sel.c] = move.ch.toUpperCase();
      s.checked[s.sel.r]![s.sel.c] = null;
      advanceEmpty();
      checkWin();
      break;
    }
    case 'del': {
      if (s.solved) return prev;
      startTimer();
      if (s.entries[s.sel.r]![s.sel.c]) {
        s.entries[s.sel.r]![s.sel.c] = '';
        s.checked[s.sel.r]![s.sel.c] = null;
      } else {
        advance(true);
        s.entries[s.sel.r]![s.sel.c] = '';
      }
      break;
    }
    case 'bar':
      s.sel.dir = flip(s.sel.dir);
      if (!wordAt(P, s.sel.r, s.sel.c, s.sel.dir)) s.sel.dir = flip(s.sel.dir);
      break;
    case 'step': {
      const list = orderedSlots(P);
      const cur = wordAt(P, s.sel.r, s.sel.c, s.sel.dir);
      let i = cur ? list.indexOf(cur) : 0;
      if (i < 0) i = 0;
      i = (i + move.delta + list.length) % list.length;
      const w = list[i]!;
      const cell = w.cells.find(([r, c]) => !s.entries[r]![c]) || w.cells[0]!;
      s.sel = { r: cell[0], c: cell[1], dir: w.t };
      break;
    }
    case 'checkWord': {
      s.track.checks++;
      const w = wordAt(P, s.sel.r, s.sel.c, s.sel.dir);
      if (w) {
        s.used.checks++;
        checkCells(w.cells);
      }
      break;
    }
    case 'checkAll':
      s.track.checks++;
      s.used.checks++;
      checkCells(allCells(P));
      break;
    case 'revealWord': {
      s.track.reveals++;
      const w = wordAt(P, s.sel.r, s.sel.c, s.sel.dir);
      if (w) {
        s.used.reveals++;
        revealCells(w.cells);
      }
      break;
    }
  }
  s.last = wordAt(P, s.sel.r, s.sel.c, s.sel.dir) ?? s.last;
  return s;
}

export interface MiniStatus {
  solved: boolean;
  started: boolean;
  /** The highlighted word, if the cursor's square has one in the current direction. */
  active: Slot | undefined;
}

export function status(s: MiniState): MiniStatus {
  return { solved: s.solved, started: s.started, active: wordAt(s.p, s.sel.r, s.sel.c, s.sel.dir) };
}

/** The clue bar: "1A" and the clue, as the engine paints it (the last word's while none is active). */
export function clueBar(s: MiniState): { label: string; clue: string } | null {
  const w = wordAt(s.p, s.sel.r, s.sel.c, s.sel.dir) ?? s.last;
  if (!w) return null;
  const [r, c] = w.cells[0]!;
  return { label: `${s.p.nums[r]![c]}${w.t}`, clue: clueFor(s.p, w) };
}

/**
 * The finish: the record the web saves, the outcome dn-track.js reports, and the
 * rest of the `dn:puzzle_end` detail. `clockSecs` is the clock as shown (whole
 * seconds since the first letter). The tracker reads the time back from the result
 * box, so `secs` is the same number.
 */
export function finish(
  s: MiniState,
  clockSecs: number,
): { rec: MiniRecord; outcome: MiniOutcome; end: MiniEnd } {
  const secs = Math.max(0, Math.floor(clockSecs));
  return {
    rec: { s: secs },
    outcome: 'solved',
    end: { secs, checks: s.track.checks, reveals: s.track.reveals, hints: s.track.hints },
  };
}

/** The `dn:puzzle_end` detail the site's tracker would send for this finish. */
export function endDetail(s: MiniState, clockSecs: number): Record<string, unknown> {
  const { outcome, end } = finish(s, clockSecs);
  return { type: SITE_TYPE, tv: 3, outcome, ...end };
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (k: number) => WORDS[k] || String(k);

/** The finish sheet's one line ("No checks, no reveals.", "Two checks, one word revealed."). */
export function finishNote(s: MiniState): string {
  const c = s.used.checks;
  const v = s.used.reveals;
  if (!c && !v) return 'No checks, no reveals.';
  const n = word(c);
  return (
    [
      c ? `${n[0]!.toUpperCase() + n.slice(1)} ${c === 1 ? 'check' : 'checks'}` : 'No checks',
      v ? `${word(v)} ${v === 1 ? 'word' : 'words'} revealed` : 'no reveals',
    ].join(', ') + '.'
  );
}

/** The page's clock text, "MM:SS" ("00:14", "12:05", "100:00"). */
export function timerText(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const sec = String(seconds % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

/** A saved record's seconds, clamped as the engine does on reopening. */
export function recordSeconds(rec: unknown): number {
  const s = object(rec) ? Number(rec.s) : NaN;
  return Math.max(0, Math.min(359999, Math.floor(s) || 0));
}
