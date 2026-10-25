/**
 * The Doku (LexiDoku), as a pure model: ported line for line from dailynoodle
 * `engines/doku.js` (findSlots, numberGrid, validate, countSolutions, validateLexi,
 * load, onCell, place, returnTile, advanceEmpty, the bank's tile taps, type, del, the
 * Hints switch, paint's green words, fullNote, checkWin, finishSheet's note and
 * restoreDone) and from `dn-track.js` (how the tracker names the outcome). No React,
 * no storage, no clock: the screen owns the clock and passes its reading to `finish`.
 *
 * Moves are the controls a phone player has on the page: bank tiles, squares, the
 * phone's own keyboard (a tapped empty square focuses the page's hidden input: letters,
 * delete and space) and the Hints switch. Reveal all and Reset have been hidden on
 * every device since 15 Oct 2026 (engines/doku.css), arrow keys need a hardware
 * keyboard, and drag and drop doesn't start from a touch, so they are not ported; the
 * outcome is therefore always "solved", and the tracker counts no checks, reveals or
 * hints (no Doku button id starts with check, reveal or hint).
 *
 * The page repaints the board only when the engine calls paint(); `view` is the cursor
 * as last painted, which is what the player sees (a typed letter the bank doesn't hold
 * can move the engine's cursor without a repaint).
 *
 * Proven identical to the web engine by `scripts/replay-doku.js` (every published Doku,
 * move by move: letters, cursor, highlighted word, green words, given and placed
 * squares, the bank, the message line, Hints, the clock and whether the keyboard is up;
 * then the saved record, streak, `dn:puzzle_end` detail, share line and finish sheet).
 */
import ENGINE from './engine-words.json';

export type Dir = 'A' | 'D';
export type Cell = readonly [number, number];

/** The page's `window.DN_PUZZLE` for a Doku. `locked` squares are 1-indexed [row, col]. */
export interface DokuData {
  type: 'lexi';
  id: string;
  band: string;
  grid: string[][];
  locked: number[][];
  bank: string[];
}

export interface Slot {
  t: Dir;
  r: number;
  c: number;
  L: number;
  cells: Cell[];
}

export interface DokuPuzzle {
  id: string;
  band: string;
  /** Upper case, '#' for a block. */
  grid: string[][];
  slots: Slot[];
  nums: number[][];
  /** Given squares, as "r,c" (0-indexed). */
  lock: ReadonlySet<string>;
}

export interface Tile {
  id: string;
  ch: string;
  at: Cell | null;
}

export interface Sel {
  r: number;
  c: number;
  dir: Dir;
}

export interface DokuState {
  p: DokuPuzzle;
  /** Per square: '' empty, a tile id, 'L' given, '#' block. */
  entries: string[][];
  tiles: Tile[];
  selTile: string | null;
  sel: Sel;
  /** The cursor as last painted. */
  view: Sel;
  started: boolean;
  solved: boolean;
  /** The Hints switch: green words. On at load. */
  hints: boolean;
  /** The message line (#msg) while unsolved: '' or the full-grid note. */
  msg: string;
  fullShown: boolean;
  /** Every square green: set by the solve (celebrate, restoreDone), cleared by the next paint. */
  allGood: boolean;
  /** The page's hidden input has focus, so the phone's keyboard is up. */
  kbd: boolean;
  /** Bumped when a typed letter isn't in the bank (the page shakes the square). */
  shakes: number;
}

export type Move =
  /** Tap a tile in the bank (by its id, "t3"): select it, or put it down again. */
  | { t: 'tile'; id: string }
  /** Tap a square. */
  | { t: 'cell'; r: number; c: number }
  /** A letter on the phone's keyboard. */
  | { t: 'key'; ch: string }
  /** The keyboard's delete. */
  | { t: 'del' }
  /** The keyboard's space bar: across ⇄ down. */
  | { t: 'space' }
  /** The Hints switch. */
  | { t: 'hints' };

/** The record the web writes to `digi-doku-v1` › done[id] (before putDone adds `d`). */
export interface DokuRecord {
  s: number;
}
export type DokuOutcome = 'solved';
export interface DokuEnd {
  secs: number;
  checks: number;
  reveals: number;
  hints: number;
}

export const SAVE_KEY = 'digi-doku-v1';
export const STREAK_KEY = 'digi-doku-streak';
/** The site's tracker names the Doku by its page slug. */
export const SITE_TYPE = 'logic-doku';

type Band = { pool: number[]; maxT3: number; maxMean: number };
const WORDS = ENGINE.WORDS as Record<string, Record<string, number>>;
const BLOCKED: readonly string[] = ENGINE.BLOCKED;
const BANDS = ENGINE.BANDS as Record<string, Band>;
const DENSITY = ENGINE.DENSITY as unknown as Record<string, [number, number]>;

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const word = (w: string) =>
  has(WORDS[String(w.length)] ?? {}, w) ? WORDS[String(w.length)]![w] : undefined;

// ---- the engine's grid helpers (findSlots, numberGrid, fillables, connected) ----

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
      const sA = (c === 0 || grid[r]![c - 1] === '#') && c < 4 && grid[r]![c + 1] !== '#';
      const sD = (r === 0 || grid[r - 1]![c] === '#') && r < 4 && grid[r + 1]![c] !== '#';
      if (sA || sD) nums[r]![c] = ++n;
    }
  return nums;
}

export function fillables(g: string[][]): Cell[] {
  const a: Cell[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (g[r]![c] !== '#') a.push([r, c]);
  return a;
}

function connected(sol: string[][]): boolean {
  const W = fillables(sol);
  if (!W.length) return false;
  const seen = new Set([W[0]!.join()]);
  const q: Cell[] = [W[0]!];
  while (q.length) {
    const [r, c] = q.pop()!;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (
        nr >= 0 &&
        nr < 5 &&
        nc >= 0 &&
        nc < 5 &&
        sol[nr]![nc] !== '#' &&
        !seen.has(nr + ',' + nc)
      ) {
        seen.add(nr + ',' + nc);
        q.push([nr, nc]);
      }
    }
  }
  return seen.size === W.length;
}

/** The generator's validate (engines/doku.js), as the ship gate calls it: lower-case grid. */
function validateFill(sol: string[][], slots: Slot[], band: string) {
  const ans = slots.map((s) => s.cells.map(([r, c]) => sol[r]![c]).join(''));
  const b = BANDS[band]!;
  const c: Record<string, boolean> = {};
  c.all_entries_are_words = ans.every((a) => word(a) !== undefined);
  c.grid_connected = connected(sol);
  c.no_duplicate_answers = new Set(ans).size === ans.length;
  c.one_clue_per_entry = true;
  c.common_vocab_only = c.all_entries_are_words;
  const tiers = ans.map((a) => word(a) as number);
  const mean = tiers.reduce((x, y) => x + y, 0) / tiers.length;
  const nt3 = tiers.filter((t) => t === 3).length;
  c.difficulty_in_band = nt3 <= b.maxT3 && mean <= b.maxMean;
  c.unique_solution = c.no_duplicate_answers && c.one_clue_per_entry;
  return { pass: Object.values(c).every(Boolean), answers: ans };
}

function bankOf(g: string[][], locked: number[][]): string[] {
  const lk = new Set(locked.map(([r, c]) => r + ',' + c));
  const o: string[] = [];
  for (const [r, c] of fillables(g)) if (!lk.has(r + ',' + c)) o.push(g[r]![c]!);
  return o;
}

/** The engine's mechanical uniqueness proof: solutions found, up to `cap`. */
export function countSolutions(g: string[][], locked: number[][], bank: string[], cap = 2): number {
  const slots = findSlots(g);
  if (!slots) return 0;
  const lk = new Set(locked.map(([r, c]) => r + ',' + c));
  const cur = g.map((r) => r.slice());
  const empties: Cell[] = [];
  for (const [r, c] of fillables(g))
    if (!lk.has(r + ',' + c)) {
      cur[r]![c] = '';
      empties.push([r, c]);
    }
  const pool: Record<string, number> = {};
  for (const ch of bank) pool[ch] = (pool[ch] || 0) + 1;
  const at: Record<string, Slot[]> = {};
  for (const s of slots) for (const [r, c] of s.cells) (at[r + ',' + c] ||= []).push(s);
  const dict: Record<number, string[]> = {
    3: Object.keys(WORDS['3']!),
    4: Object.keys(WORDS['4']!),
    5: Object.keys(WORDS['5']!),
  };
  const ok = (s: Slot) => {
    const p = s.cells.map(([r, c]) => cur[r]![c] || '.');
    if (!p.includes('.')) return word(p.join('')) !== undefined;
    return dict[s.L]!.some((w) => {
      for (let i = 0; i < s.L; i++) if (p[i] !== '.' && p[i] !== w[i]) return false;
      return true;
    });
  };
  let n = 0;
  (function rec() {
    if (n >= cap) return;
    let best = -1;
    let bc: string[] | null = null;
    for (let i = 0; i < empties.length; i++) {
      const [r, c] = empties[i]!;
      if (cur[r]![c]) continue;
      const cs: string[] = [];
      for (const ch of Object.keys(pool)) {
        if (!pool[ch]) continue;
        cur[r]![c] = ch;
        if (at[r + ',' + c]!.every(ok)) cs.push(ch);
        cur[r]![c] = '';
      }
      if (!cs.length) return;
      if (bc === null || cs.length < bc.length) {
        best = i;
        bc = cs;
        if (cs.length === 1) break;
      }
    }
    if (best < 0) {
      if (slots.every(ok)) n++;
      return;
    }
    const [r, c] = empties[best]!;
    for (const ch of bc!) {
      cur[r]![c] = ch;
      pool[ch]!--;
      rec();
      pool[ch]!++;
      cur[r]![c] = '';
      if (n >= cap) return;
    }
  })();
  return n;
}

// ---- validate: the page's ship gate, and what its code needs not to throw ----

export interface Validation {
  ok: boolean;
  checks: Record<string, boolean>;
}

const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

/** The ship gate exactly as engines/doku.js validateLexi runs it at load. */
export function validateLexi(pz: DokuData): Validation {
  const g = pz.grid.map((r) => r.map((x) => (x === '#' ? '#' : String(x).toLowerCase())));
  const slots = findSlots(g);
  const c: Record<string, boolean> = {};
  const vm = slots ? validateFill(g, slots, pz.band) : { pass: false, answers: [] as string[] };
  c.grid_is_valid_mini = !!(slots && vm.pass);
  let sym = true;
  for (let r = 0; r < 5; r++)
    for (let x = 0; x < 5; x++) if ((g[r]![x] === '#') !== (g[4 - r]![4 - x] === '#')) sym = false;
  c.blocks_wellformed = !!(slots && sym);
  const fill = fillables(g).length;
  const lk = pz.locked.map(([r, x]) => [r! - 1, x! - 1]);
  const dens = lk.length / fill;
  const [lo, hi] = DENSITY[pz.band]!;
  c.locks_wellformed =
    lk.every(([r, x]) => r! >= 0 && r! < 5 && x! >= 0 && x! < 5 && g[r!]![x!] !== '#') &&
    lk.length >= 1 &&
    lk.length < fill &&
    dens >= lo - 0.001 &&
    dens <= hi + 0.06;
  c.bank_conserves_letters =
    bankOf(pz.grid, lk).slice().sort().join('') === pz.bank.slice().sort().join('');
  c.family_friendly = vm.answers.every((a) => !BLOCKED.includes(a));
  c.unique_solution =
    c.bank_conserves_letters &&
    countSolutions(
      g,
      lk,
      pz.bank.map((x) => x.toLowerCase()),
    ) === 1;
  return { ok: Object.values(c).every(Boolean), checks: c };
}

/**
 * Whether the web player would render this puzzle and could finish it: first what its
 * code needs in order not to throw (a 5×5 grid of strings, `locked` integer pairs,
 * `bank` strings, a band the engine knows, an id the save and share line can use),
 * then the page's own ship gate (`validateLexi`), which refuses to render a failing
 * puzzle ("Ship gate — not rendered").
 */
export function validate(data: unknown): Validation {
  const d = object(data) ? data : {};
  const grid = d.grid;
  const checks: Record<string, boolean> = {
    is_lexi: d.type === 'lexi',
    has_id: typeof d.id === 'string' && /^DP·LEXI·\d+$/.test(d.id),
    grid_5x5:
      Array.isArray(grid) &&
      grid.length === 5 &&
      grid.every(
        (row) =>
          Array.isArray(row) &&
          row.length === 5 &&
          row.every((ch) => typeof ch === 'string' && ch.length === 1),
      ),
    locked_pairs:
      Array.isArray(d.locked) &&
      d.locked.every(
        (x) => Array.isArray(x) && x.length >= 2 && x.every((n) => Number.isInteger(n)),
      ),
    bank_letters: Array.isArray(d.bank) && d.bank.every((x) => typeof x === 'string'),
    band_known: typeof d.band === 'string' && has(BANDS, d.band) && has(DENSITY, d.band),
  };
  if (!Object.values(checks).every(Boolean)) return { ok: false, checks };
  const gate = validateLexi(d as unknown as DokuData);
  return { ok: gate.ok, checks: { ...checks, ...gate.checks } };
}

// ---- state ----

export function puzzleOf(data: DokuData): DokuPuzzle {
  return {
    id: data.id,
    band: data.band,
    grid: data.grid.map((r) => r.map((x) => (x === '#' ? '#' : String(x).toUpperCase()))),
    slots: findSlots(data.grid) ?? [],
    nums: numberGrid(data.grid),
    lock: new Set(data.locked.map(([r, c]) => r! - 1 + ',' + (c! - 1))),
  };
}

export const isLock = (p: DokuPuzzle, r: number, c: number) => p.lock.has(r + ',' + c);

export function wordAt(p: DokuPuzzle, r: number, c: number, dir: Dir): Slot | undefined {
  return p.slots.find((s) => s.t === dir && s.cells.some(([y, x]) => y === r && x === c));
}

/** The letter a square shows: its given letter, its tile's, or ''. */
export function letterAt(
  s: Pick<DokuState, 'p' | 'entries' | 'tiles'>,
  r: number,
  c: number,
): string {
  const v = s.entries[r]![c];
  if (!v || v === '#') return '';
  if (v.charAt(0) === 'L') return s.p.grid[r]![c]!;
  const t = s.tiles.find((t) => t.id === v);
  return t ? t.ch : '';
}

/** A new game (the engine's `load`). `data` must have passed `validate`. */
export function init(data: DokuData): DokuState {
  const p = puzzleOf(data);
  const first = fillables(p.grid).find(([r, c]) => !isLock(p, r, c)) || ([0, 0] as const);
  const sel: Sel = { r: first[0], c: first[1], dir: 'A' };
  return {
    p,
    entries: p.grid.map((row, r) =>
      row.map((ch, c) => (ch === '#' ? '#' : isLock(p, r, c) ? 'L' : '')),
    ),
    tiles: data.bank.map((ch, i) => ({ id: 't' + i, ch: String(ch).toUpperCase(), at: null })),
    selTile: null,
    sel,
    view: { ...sel },
    started: false,
    solved: false,
    hints: true,
    msg: '',
    fullShown: false,
    allGood: false,
    kbd: false,
    shakes: 0,
  };
}

/** A finished puzzle reopened from its save (the engine's `restoreDone`). */
export function restore(data: DokuData): DokuState {
  const s = init(data);
  for (const [r, c] of fillables(s.p.grid)) {
    if (isLock(s.p, r, c)) continue;
    const t = s.tiles.find((t) => !t.at && t.ch === s.p.grid[r]![c]);
    // The bank can't rebuild it: the page leaves a fresh board (never after validate).
    if (!t) return init(data);
    t.at = [r, c];
    s.entries[r]![c] = t.id;
  }
  s.solved = true;
  s.allGood = true;
  return s;
}

const flip = (d: Dir): Dir => (d === 'A' ? 'D' : 'A');

/** The full-grid note's words (dn-doku-full-note, 19 Oct 2026). */
export function fullNoteText(off: number, hints: boolean): string {
  return hints
    ? `The grid's full, but ${off === 1 ? "1 square isn't" : off + " squares aren't"} today's answer. Tap a letter to send it back.`
    : "The grid's full, but it isn't today's answer. Tap a letter to send it back.";
}

/** Apply one move; returns a new state (the old one is never changed). */
export function apply(prev: DokuState, move: Move): DokuState {
  const s: DokuState = {
    ...prev,
    entries: prev.entries.map((row) => row.slice()),
    tiles: prev.tiles.map((t) => ({ ...t })),
    sel: { ...prev.sel },
  };
  const P = s.p;
  const lockAt = (r: number, c: number) => isLock(P, r, c);
  const startTimer = () => {
    if (s.started || s.solved) return;
    s.started = true;
  };
  const fullNote = () => {
    if (s.solved) return;
    const cells = fillables(P.grid);
    if (cells.every(([r, c]) => letterAt(s, r, c))) {
      const off = cells.filter(([r, c]) => letterAt(s, r, c) !== P.grid[r]![c]).length;
      if (off) {
        s.msg = fullNoteText(off, s.hints);
        s.fullShown = true;
        return;
      }
    }
    if (s.fullShown) {
      s.msg = '';
      s.fullShown = false;
    }
  };
  const paint = () => {
    fullNote();
    s.view = { ...s.sel };
    s.allGood = false;
  };
  const checkWin = () => {
    if (s.solved) return;
    const done = fillables(P.grid).every(([r, c]) => letterAt(s, r, c) === P.grid[r]![c]);
    if (!done) return;
    s.solved = true;
    s.allGood = true; // celebrate(): every square turns good
  };
  const advanceEmpty = () => {
    const w = wordAt(P, s.sel.r, s.sel.c, s.sel.dir);
    if (w) {
      const i = w.cells.findIndex(([y, x]) => y === s.sel.r && x === s.sel.c);
      for (let j = i + 1; j < w.cells.length; j++) {
        const [y, x] = w.cells[j]!;
        if (!s.entries[y]![x]) {
          s.sel.r = y;
          s.sel.c = x;
          return;
        }
      }
    }
    const all = fillables(P.grid);
    const k = all.findIndex(([y, x]) => y === s.sel.r && x === s.sel.c);
    for (let n = 1; n <= all.length; n++) {
      const [y, x] = all[(k + n) % all.length]!;
      if (!s.entries[y]![x]) {
        s.sel.r = y;
        s.sel.c = x;
        return;
      }
    }
  };
  const returnTile = (r: number, c: number) => {
    const id = s.entries[r]![c];
    if (!id || id === 'L') return;
    const t = s.tiles.find((t) => t.id === id);
    if (t) t.at = null;
    s.entries[r]![c] = '';
  };
  const place = (r: number, c: number) => {
    if (s.solved || lockAt(r, c) || s.entries[r]![c] || !s.selTile) return;
    startTimer();
    const t = s.tiles.find((t) => t.id === s.selTile);
    if (!t) return;
    t.at = [r, c];
    s.entries[r]![c] = t.id;
    s.selTile = null;
    s.sel = { r, c, dir: s.sel.dir };
    advanceEmpty();
    paint();
    checkWin();
  };
  switch (move.t) {
    case 'tile': {
      const t = s.tiles.find((t) => t.id === move.id && !t.at);
      if (!t) return prev; // only free tiles are in the bank
      s.kbd = false; // the tile button takes the focus, then the bank is rebuilt
      if (s.solved) return s;
      s.selTile = s.selTile === t.id ? null : t.id;
      paint();
      break;
    }
    case 'cell': {
      const { r, c } = move;
      if (P.grid[r]?.[c] === undefined) return prev;
      s.kbd = false; // a tap on the board blurs the hidden input
      if (s.solved || P.grid[r]![c] === '#') return s; // blocks have no tap handler
      if (lockAt(r, c)) {
        s.sel = { r, c, dir: s.sel.dir };
        paint();
        break;
      }
      if (s.entries[r]![c]) {
        // tap a placed letter: back to the bank
        returnTile(r, c);
        s.sel = { r, c, dir: s.sel.dir };
        paint();
        break;
      }
      if (s.selTile) {
        place(r, c);
        break;
      }
      if (s.sel.r === r && s.sel.c === c) s.sel.dir = flip(s.sel.dir);
      else s.sel = { r, c, dir: s.sel.dir };
      if (!wordAt(P, r, c, s.sel.dir)) s.sel.dir = flip(s.sel.dir);
      paint();
      s.kbd = true; // focusHidden(): the phone's keyboard comes up
      break;
    }
    case 'key': {
      if (!/^[a-z]$/i.test(move.ch)) return prev;
      if (s.solved) return prev;
      const ch = move.ch.toUpperCase();
      const filled = () => lockAt(s.sel.r, s.sel.c) || !!s.entries[s.sel.r]![s.sel.c];
      if (filled()) advanceEmpty();
      if (filled()) return s;
      const t = s.tiles.find((t) => !t.at && t.ch === ch);
      if (!t) {
        s.shakes++;
        return s;
      }
      s.selTile = t.id;
      place(s.sel.r, s.sel.c);
      break;
    }
    case 'del': {
      if (s.solved) return prev;
      startTimer();
      if (s.entries[s.sel.r]![s.sel.c] && !lockAt(s.sel.r, s.sel.c)) {
        returnTile(s.sel.r, s.sel.c);
        paint();
        break;
      }
      const w = wordAt(P, s.sel.r, s.sel.c, s.sel.dir);
      if (w) {
        const i = w.cells.findIndex(([y, x]) => y === s.sel.r && x === s.sel.c);
        for (let j = i - 1; j >= 0; j--) {
          const [y, x] = w.cells[j]!;
          if (s.entries[y]![x] && !lockAt(y, x)) {
            s.sel.r = y;
            s.sel.c = x;
            returnTile(y, x);
            paint();
            return s;
          }
        }
      }
      paint();
      break;
    }
    case 'space':
      s.sel.dir = flip(s.sel.dir);
      paint();
      break;
    case 'hints':
      s.kbd = false; // the switch takes the focus
      s.hints = !s.hints;
      paint();
      break;
  }
  return s;
}

/** The squares paint() marks green: every word that matches the answer, with Hints on. */
export function goodSquares(s: DokuState): Set<string> {
  const good = new Set<string>();
  if (s.allGood) {
    for (const [r, c] of fillables(s.p.grid)) good.add(r + ',' + c);
    return good;
  }
  if (!s.hints) return good;
  for (const sl of s.p.slots) {
    const w = sl.cells.map(([r, c]) => letterAt(s, r, c)).join('');
    if (w.length === sl.L && w === sl.cells.map(([r, c]) => s.p.grid[r]![c]).join(''))
      for (const [r, c] of sl.cells) good.add(r + ',' + c);
  }
  return good;
}

/** The highlighted word: the painted cursor's word in its direction, if it has one. */
export const activeWord = (s: DokuState) => wordAt(s.p, s.view.r, s.view.c, s.view.dir);

/** The bank as painted: the free tiles in their order. */
export const bankTiles = (s: DokuState) => s.tiles.filter((t) => !t.at);

/** The message line; `clock` is the clock as shown ("00:42"). */
export function message(s: DokuState, clock: string): string {
  return s.solved ? `Solved in ${clock}. Nice.` : s.msg;
}

export interface DokuStatus {
  solved: boolean;
  started: boolean;
  /** Every square holds a letter (the full-grid note may be showing). */
  full: boolean;
}

export function status(s: DokuState): DokuStatus {
  return {
    solved: s.solved,
    started: s.started,
    full: fillables(s.p.grid).every(([r, c]) => !!letterAt(s, r, c)),
  };
}

/**
 * The finish: the record the web saves, the outcome dn-track.js reports, and the rest
 * of the `dn:puzzle_end` detail. `clockSecs` is the clock as shown (whole seconds since
 * the first tile went down); the tracker reads the time back from the result box, so
 * `secs` is the same number.
 */
export function finish(
  _s: DokuState,
  clockSecs: number,
): { rec: DokuRecord; outcome: DokuOutcome; end: DokuEnd } {
  const secs = Math.max(0, Math.floor(clockSecs));
  return { rec: { s: secs }, outcome: 'solved', end: { secs, checks: 0, reveals: 0, hints: 0 } };
}

/** The `dn:puzzle_end` detail the site's tracker would send for this finish. */
export function endDetail(s: DokuState, clockSecs: number): Record<string, unknown> {
  const { outcome, end } = finish(s, clockSecs);
  return { type: SITE_TYPE, tv: 3, outcome, ...end };
}

const W = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
];

/** The finish sheet's one line: "All twelve tiles placed." (finishSheet). */
export function finishNote(s: Pick<DokuState, 'tiles'>): string {
  const n = s.tiles.length;
  return `All ${W[n] || String(n)} tiles placed.`;
}

/** The recap's line: "The five given letters are shaded." */
export function recapSub(p: DokuPuzzle): string {
  return `The ${W[p.lock.size] || p.lock.size} given letters are shaded.`;
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
