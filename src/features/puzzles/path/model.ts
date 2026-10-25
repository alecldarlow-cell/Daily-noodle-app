/**
 * Path, as a pure model: ported line for line from dailynoodle `engines/path.js` (the
 * gate: neighbors, manhattan, pathFromSolution, turnCount, candidatesFor, solveNoGuess,
 * countSolutions, validatePath; the player: the two-end tap rules of onTap, reject,
 * Undo, Hint's forcedFor, checkWin, the lines, finishSheet's note and restoreDone)
 * and from `dn-track.js` (how the tracker counts Hint presses). No React, no storage,
 * no clock: the screen starts the clock on Play, as the page does (SITE.md › Players),
 * and passes its reading to `finish`.
 *
 * Moves are the controls a phone has on the page: a tap on a square (the 1 or the 36
 * to choose an end, any other square to grow the active end), Undo and Hint. Reset
 * has been hidden since 15 Oct 2026 (engines/path.css), so it is not ported.
 *
 * Proven identical to the web engine by `scripts/replay.js` (every published Path,
 * move by move: numbers, the active end, the other end's ring, the two threads, shaken
 * squares, message and clock; then the save, streak, `dn:puzzle_end` detail, share
 * line and finish sheet).
 */

export const N = 6;
export const TOTAL = 36;

export type Cell = [number, number];
export type Locked = [number, number, number];

/** The page's `window.DN_PUZZLE` for a Path (locked squares 1-indexed [row, col, value]). */
export interface PathData {
  type: 'path';
  id: string;
  band: string;
  size?: number;
  grid?: string[][];
  solution: number[][];
  locked: Locked[];
  turns?: number;
}

export const SAVE_KEY = 'digi-path-v1';
export const STREAK_KEY = 'digi-path-streak';
/** The site's tracker names Path by its page slug. */
export const SITE_TYPE = 'logic-path';

/** The page's first line under the board (every Path page has the same one). */
export const START_MSG =
  'Tap the marigold square, then tap an adjacent open square to place the next number. Tap the 1 or the 36 any time to switch which end you’re growing.';

// ---- the gate ----

export function neighbors(r: number, c: number): Cell[] {
  const out: Cell[] = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < N - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < N - 1) out.push([r, c + 1]);
  return out;
}
export const manhattan = (a: readonly number[], b: readonly number[]) =>
  Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!);

export function pathFromSolution(sol: number[][]): Cell[] {
  const cells = new Array<Cell>(TOTAL + 1);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells[sol[r]![c]!] = [r, c];
  return cells.slice(1);
}

export function turnCount(cells: Cell[]): number {
  let turns = 0;
  let prevDir: string | null = null;
  for (let i = 1; i < cells.length; i++) {
    const dr = cells[i]![0] - cells[i - 1]![0];
    const dc = cells[i]![1] - cells[i - 1]![1];
    const dir = dr + ',' + dc;
    if (prevDir !== null && dir !== prevDir) turns++;
    prevDir = dir;
  }
  return turns;
}

function candidatesFor(v: number, valCell: (Cell | null)[], cellUsed: boolean[][]): Cell[] {
  let prevA: number | null = null;
  let nextA: number | null = null;
  for (let a = v - 1; a >= 1; a--)
    if (valCell[a]) {
      prevA = a;
      break;
    }
  for (let a = v + 1; a <= TOTAL; a++)
    if (valCell[a]) {
      nextA = a;
      break;
    }
  let cands: Cell[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (cellUsed[r]![c]) continue;
      let okPrev = true;
      let okNext = true;
      if (prevA !== null) {
        const d = manhattan(valCell[prevA]!, [r, c]);
        const need = v - prevA;
        okPrev = d <= need && (need - d) % 2 === 0;
      }
      if (nextA !== null) {
        const d = manhattan(valCell[nextA]!, [r, c]);
        const need = nextA - v;
        okNext = d <= need && (need - d) % 2 === 0;
      }
      if (okPrev && okNext) cands.push([r, c]);
    }
  const near = (x: Cell) =>
    new Set(
      neighbors(x[0], x[1])
        .filter(([r, c]) => !cellUsed[r]![c])
        .map(([r, c]) => r + ',' + c),
    );
  if (valCell[v - 1]) {
    const set = near(valCell[v - 1]!);
    cands = cands.filter(([r, c]) => set.has(r + ',' + c));
  }
  if (valCell[v + 1]) {
    const set = near(valCell[v + 1]!);
    cands = cands.filter(([r, c]) => set.has(r + ',' + c));
  }
  return cands;
}

export function solveNoGuess(lockedList: Locked[]): { solved: boolean } {
  const valCell = new Array<Cell | null>(TOTAL + 1).fill(null);
  const cellUsed = Array.from({ length: N }, () => Array<boolean>(N).fill(false));
  for (const [r, c, v] of lockedList) {
    valCell[v] = [r - 1, c - 1];
    cellUsed[r - 1]![c - 1] = true;
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let v = 1; v <= TOTAL; v++) {
      if (valCell[v]) continue;
      const cands = candidatesFor(v, valCell, cellUsed);
      if (cands.length === 1) {
        const [r, c] = cands[0]!;
        valCell[v] = [r, c];
        cellUsed[r]![c] = true;
        changed = true;
      }
    }
  }
  return { solved: valCell.slice(1).every((x) => x !== null) };
}

export function countSolutions(lockedList: Locked[], cap: number): number {
  const lockedByValue = new Map(lockedList.map(([r, c, v]) => [v, [r - 1, c - 1] as Cell]));
  const cellVal = Array.from({ length: N }, () => Array<number>(N).fill(0));
  let count = 0;
  function bt(v: number, r: number, c: number) {
    if (count >= cap) return;
    if (v > TOTAL) {
      count++;
      return;
    }
    const forced = lockedByValue.get(v);
    if (v === 1) {
      if (forced) {
        const [fr, fc] = forced;
        cellVal[fr]![fc] = 1;
        bt(2, fr, fc);
        cellVal[fr]![fc] = 0;
      } else {
        for (let rr = 0; rr < N; rr++)
          for (let cc = 0; cc < N; cc++) {
            if (cellVal[rr]![cc] === 0) {
              cellVal[rr]![cc] = 1;
              bt(2, rr, cc);
              cellVal[rr]![cc] = 0;
              if (count >= cap) return;
            }
          }
      }
      return;
    }
    if (forced) {
      const [fr, fc] = forced;
      if (Math.abs(fr - r) + Math.abs(fc - c) !== 1) return;
      if (cellVal[fr]![fc] !== 0) return;
      cellVal[fr]![fc] = v;
      bt(v + 1, fr, fc);
      cellVal[fr]![fc] = 0;
      return;
    }
    for (const [nr, nc] of neighbors(r, c)) {
      if (cellVal[nr]![nc] === 0) {
        cellVal[nr]![nc] = v;
        bt(v + 1, nr, nc);
        cellVal[nr]![nc] = 0;
        if (count >= cap) return;
      }
    }
  }
  bt(1, -1, -1);
  return count;
}

export function validatePath(p: Pick<PathData, 'solution' | 'locked'>): {
  pass: boolean;
  checks: Record<string, boolean>;
  turns: number;
} {
  const checks: Record<string, boolean> = {};
  checks.locks_match_solution = p.locked.every(([r, c, v]) => p.solution[r - 1]![c - 1] === v);
  const lockedVals = new Set(p.locked.map((l) => l[2]));
  checks.endpoints_locked = lockedVals.has(1) && lockedVals.has(TOTAL);
  const cells = pathFromSolution(p.solution);
  let connOk = true;
  for (let i = 1; i < cells.length; i++) {
    if (manhattan(cells[i - 1]!, cells[i]!) !== 1) {
      connOk = false;
      break;
    }
  }
  const seen = new Set(cells.map((c) => c[0] + ',' + c[1]));
  checks.valid_hamiltonian_path = connOk && seen.size === TOTAL;
  const turns = turnCount(cells);
  checks.sufficiently_varied = turns >= 14;
  checks.solve_no_guess = solveNoGuess(p.locked).solved;
  checks.unique_solution = countSolutions(p.locked, 2) === 1;
  return { pass: Object.values(checks).every(Boolean), checks, turns };
}

// ---- validate ----

export interface Validation {
  ok: boolean;
  checks: Record<string, boolean>;
}

const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const int = (x: unknown, lo: number, hi: number) =>
  Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;

/**
 * Whether the web player would render this Path: the data its gate reads (a 6×6
 * solution holding 1 to 36 once each, since pathFromSolution throws on anything else;
 * locked squares as [row, col, value] on the board; an id the save and share line can
 * use), then the gate itself, which the page runs at load and refuses to render on.
 */
export function validate(data: unknown): Validation {
  const d = object(data) ? data : {};
  const sol = d.solution;
  const solShape =
    Array.isArray(sol) &&
    sol.length === N &&
    sol.every((row) => Array.isArray(row) && row.length === N && row.every((v) => int(v, 1, 36)));
  const perm = solShape && new Set((sol as number[][]).flat()).size === TOTAL;
  const lockedShape =
    Array.isArray(d.locked) &&
    d.locked.every(
      (l) =>
        Array.isArray(l) &&
        l.length === 3 &&
        int(l[0], 1, N) &&
        int(l[1], 1, N) &&
        int(l[2], 1, TOTAL),
    );
  const gate =
    perm && lockedShape
      ? validatePath({ solution: sol as number[][], locked: d.locked as Locked[] }).checks
      : { ship_gate: false };
  const checks: Record<string, boolean> = {
    is_path: d.type === 'path',
    has_id: typeof d.id === 'string' && /^DP·PATH·\d+$/.test(d.id),
    solution_1_to_36: !!perm,
    locked_on_board: lockedShape,
    ...gate,
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

// ---- the player ----

export interface PathPuzzle {
  id: string;
  band: string;
  solution: number[][];
  locked: Locked[];
  lockedByValue: Map<number, Cell>;
  lockedSet: Set<string>;
  oneKey: string;
  endKeys: Set<string>;
  turns: number;
}

interface Hist {
  end: 'low' | 'high';
  prevHead: number;
  prevCell: Cell;
  newCell: Cell;
  wasEmpty: boolean;
}

export interface PathState {
  p: PathPuzzle;
  cellValue: (number | null)[][];
  lowHead: number;
  highHead: number;
  lowCell: Cell;
  highCell: Cell;
  activeEnd: 'low' | 'high';
  /**
   * The ends as last painted. The page repaints after every accepted tap, end choice
   * and Undo, but not after a refused tap, so when Hint switches the active end and its
   * square is then refused, the old end stays lit (engines/path.js reject has no paint).
   */
  lit: { end: 'low' | 'high'; low: Cell; high: Cell };
  history: Hist[];
  solved: boolean;
  /** Set by any tap (the page's fallback if the start card never showed). */
  started: boolean;
  msg: string;
  /** The last rejected square and a count, so the screen can shake it each time. */
  shake: { r: number; c: number; n: number } | null;
  /** The engine's `usedHints`, for the finish sheet. */
  usedHints: number;
  /** Hint presses dn-track.js counts (every press on #hintBtn). */
  hints: number;
}

export type Move = { t: 'cell'; r: number; c: number } | { t: 'undo' } | { t: 'hint' };

export function puzzleOf(data: PathData): PathPuzzle {
  const lockedByValue = new Map(data.locked.map(([r, c, v]) => [v, [r - 1, c - 1] as Cell]));
  const one = lockedByValue.get(1)!;
  const end = lockedByValue.get(TOTAL)!;
  const oneKey = one[0] + ',' + one[1];
  return {
    id: data.id,
    band: data.band,
    solution: data.solution,
    locked: data.locked,
    lockedByValue,
    lockedSet: new Set(data.locked.map(([r, c]) => `${r - 1},${c - 1}`)),
    oneKey,
    endKeys: new Set([oneKey, end[0] + ',' + end[1]]),
    turns: turnCount(pathFromSolution(data.solution)),
  };
}

/** A new game, as the page loads it. `data` must have passed `validate`. */
export function init(data: PathData): PathState {
  const p = puzzleOf(data);
  const cellValue = Array.from({ length: N }, () => Array<number | null>(N).fill(null));
  for (const [r, c, v] of p.locked) cellValue[r - 1]![c - 1] = v;
  const one = p.lockedByValue.get(1)!;
  const end = p.lockedByValue.get(TOTAL)!;
  return {
    p,
    lit: { end: 'low', low: one.slice() as Cell, high: end.slice() as Cell },
    cellValue,
    lowHead: 1,
    highHead: TOTAL,
    lowCell: p.lockedByValue.get(1)!.slice() as Cell,
    highCell: p.lockedByValue.get(TOTAL)!.slice() as Cell,
    activeEnd: 'low',
    history: [],
    solved: false,
    started: false,
    msg: START_MSG,
    shake: null,
    usedHints: 0,
    hints: 0,
  };
}

/** A saved time the engine accepts ("m:ss"), else "0:00" (restoreDone). */
export function recordTime(rec: unknown): string {
  const t = object(rec) ? String(rec.t) : '';
  return /^\d{1,4}:\d{2}$/.test(t) ? t : '0:00';
}

/** A finished Path reopened from its save (the engine's restoreDone). */
export function restore(data: PathData, rec: unknown): PathState {
  const s = init(data);
  s.cellValue = data.solution.map((row) => row.slice());
  s.solved = true;
  s.history = [];
  s.msg = 'Thread complete in ' + recordTime(rec) + '.';
  return s;
}

export function valueCellMap(s: PathState): (Cell | null)[] {
  const m = new Array<Cell | null>(TOTAL + 1).fill(null);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = s.cellValue[r]![c];
      if (v !== null && v !== undefined) m[v] = [r, c];
    }
  return m;
}

/** The engine's paint(), as far as the ends go: light what is active now. */
function paint(s: PathState): void {
  s.lit = { end: s.activeEnd, low: s.lowCell.slice() as Cell, high: s.highCell.slice() as Cell };
}

function copy(prev: PathState): PathState {
  return {
    ...prev,
    cellValue: prev.cellValue.map((row) => row.slice()),
    lowCell: prev.lowCell.slice() as Cell,
    highCell: prev.highCell.slice() as Cell,
    history: prev.history.slice(),
  };
}

/** One tap on a square (the engine's onTap), on a state already copied. */
function onTap(s: PathState, r: number, c: number): void {
  if (s.solved) return;
  s.started = true;
  const P = s.p;
  const key = r + ',' + c;
  const reject = (text: string) => {
    s.shake = { r, c, n: (s.shake?.n ?? 0) + 1 };
    s.msg = text;
  };
  if (P.endKeys.has(key)) {
    s.activeEnd = key === P.oneKey ? 'low' : 'high';
    s.msg =
      s.activeEnd === 'low'
        ? 'Counting up from 1 — tap an adjacent square to place ' + (s.lowHead + 1) + '.'
        : 'Counting down from 36 — tap an adjacent square to place ' + (s.highHead - 1) + '.';
    paint(s);
    return;
  }
  const low = s.activeEnd === 'low';
  const headCell = low ? s.lowCell : s.highCell;
  const target = low ? s.lowHead + 1 : s.highHead - 1;
  if (manhattan([r, c], headCell) !== 1) {
    reject('Not next to the active end — the thread grows one square at a time.');
    return;
  }
  const existing = s.cellValue[r]![c];
  if (existing !== null && existing !== undefined) {
    if (P.lockedSet.has(key) && existing === target) {
      s.history.push({
        end: s.activeEnd,
        prevHead: low ? s.lowHead : s.highHead,
        prevCell: headCell.slice() as Cell,
        newCell: [r, c],
        wasEmpty: false,
      });
      if (low) {
        s.lowHead = target;
        s.lowCell = [r, c];
      } else {
        s.highHead = target;
        s.highCell = [r, c];
      }
      s.msg = 'Through the ' + target + ' checkpoint — keep going.';
      paint(s);
      checkWin(s);
      return;
    }
    reject(
      P.lockedSet.has(key)
        ? 'That given is ' + existing + ', but the thread needs ' + target + ' next.'
        : 'That square is already part of the thread.',
    );
    return;
  }
  if (P.lockedByValue.has(target)) {
    reject(target + ' is already given elsewhere — the thread has to pass through it.');
    return;
  }
  const vmap = valueCellMap(s);
  const other = low ? vmap[target + 1] : vmap[target - 1];
  if (other && manhattan([r, c], other) !== 1) {
    reject(
      'Placing ' +
        target +
        ' there would leave it stranded from ' +
        (low ? target + 1 : target - 1) +
        '.',
    );
    return;
  }
  s.cellValue[r]![c] = target;
  s.history.push({
    end: s.activeEnd,
    prevHead: low ? s.lowHead : s.highHead,
    prevCell: headCell.slice() as Cell,
    newCell: [r, c],
    wasEmpty: true,
  });
  if (low) {
    s.lowHead = target;
    s.lowCell = [r, c];
  } else {
    s.highHead = target;
    s.highCell = [r, c];
  }
  s.msg = '';
  paint(s);
  checkWin(s);
}

function checkWin(s: PathState): void {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (s.cellValue[r]![c] === null) return;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) if (s.cellValue[r]![c] !== s.p.solution[r]![c]) return;
  s.solved = true;
}

/** Hint's forced square for `target` from the nearest known values either side, or null. */
function forcedFor(s: PathState, target: number): Cell | null {
  const vmap = valueCellMap(s);
  const known: number[] = [];
  for (let v = 1; v <= TOTAL; v++) if (vmap[v]) known.push(v);
  let below: number | null = null;
  let above: number | null = null;
  for (let i = known.length - 1; i >= 0; i--) {
    if (known[i]! < target) {
      below = known[i]!;
      break;
    }
  }
  for (let i = 0; i < known.length; i++) {
    if (known[i]! > target) {
      above = known[i]!;
      break;
    }
  }
  if (below === null || above === null) return null;
  const aCell = vmap[below]!;
  const bCell = vmap[above]!;
  const da = target - below;
  const db = above - target;
  const cands: Cell[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (s.cellValue[r]![c] !== null) continue;
      const dA = Math.abs(r - aCell[0]) + Math.abs(c - aCell[1]);
      const dB = Math.abs(r - bCell[0]) + Math.abs(c - bCell[1]);
      if (dA <= da && (da - dA) % 2 === 0 && dB <= db && (db - dB) % 2 === 0) cands.push([r, c]);
    }
  return cands.length === 1 ? cands[0]! : null;
}

export const NOT_FORCED_MSG =
  'Neither end’s next square is forced yet — trace what has to pass where.';

/** Apply one move; returns a new state (the old one is never changed). */
export function apply(prev: PathState, move: Move): PathState {
  const s = copy(prev);
  switch (move.t) {
    case 'cell':
      if (!(move.r >= 0 && move.r < N && move.c >= 0 && move.c < N)) return prev;
      if (s.solved) return prev;
      onTap(s, move.r, move.c);
      return s;
    case 'undo': {
      if (s.solved || s.history.length === 0) return prev;
      const m = s.history.pop()!;
      if (m.wasEmpty) s.cellValue[m.newCell[0]]![m.newCell[1]] = null;
      if (m.end === 'low') {
        s.lowHead = m.prevHead;
        s.lowCell = m.prevCell;
      } else {
        s.highHead = m.prevHead;
        s.highCell = m.prevCell;
      }
      s.activeEnd = m.end;
      s.msg = 'Undone.';
      paint(s);
      return s;
    }
    case 'hint': {
      s.hints++;
      if (!s.solved) s.usedHints++;
      if (s.solved) return s;
      const lowTarget = s.lowHead + 1;
      const highTarget = s.highHead - 1;
      let cell: Cell | null = null;
      let end: 'low' | 'high' | null = null;
      if (lowTarget <= highTarget) {
        cell = forcedFor(s, lowTarget);
        if (cell) end = 'low';
        else {
          cell = forcedFor(s, highTarget);
          if (cell) end = 'high';
        }
      }
      if (!cell || !end) {
        s.msg = NOT_FORCED_MSG;
        return s;
      }
      s.activeEnd = end;
      onTap(s, cell[0], cell[1]);
      return s;
    }
  }
}

export interface Lines {
  /** The thread from 1 (cobalt), or the whole thread once solved (green). */
  low: Cell[];
  /** The thread down from 36 (deep blue); empty once solved. */
  high: Cell[];
  solved: boolean;
}

/** The two threads as the page draws them (renderLines). */
export function lines(s: PathState): Lines {
  const vmap = valueCellMap(s);
  if (s.solved) {
    const full: Cell[] = [];
    for (let v = 1; v <= TOTAL; v++) full.push(vmap[v]!);
    return { low: full, high: [], solved: true };
  }
  const low: Cell[] = [];
  for (let v = 1; v <= s.lowHead; v++) if (vmap[v]) low.push(vmap[v]!);
  const high: Cell[] = [];
  for (let v = s.highHead; v <= TOTAL; v++) if (vmap[v]) high.push(vmap[v]!);
  return { low, high, solved: false };
}

/** Where a square is lit (as last painted): the active end, or the other end, ringed. Nothing once solved. */
export function endMark(s: PathState, r: number, c: number): 'active' | 'endsel' | null {
  if (s.solved) return null;
  const { end, low, high } = s.lit;
  const act =
    (end === 'low' && low[0] === r && low[1] === c) ||
    (end === 'high' && high[0] === r && high[1] === c);
  if (act) return 'active';
  return s.p.endKeys.has(r + ',' + c) ? 'endsel' : null;
}

// ---- the finish ----

export interface PathRecord {
  t: string;
}
export interface PathEnd {
  secs: number;
  checks: number;
  reveals: number;
  hints: number;
}

/** The page's clock text, "m:ss" ("0:00", "1:05", "12:05"). */
export function timerText(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return m + ':' + ss;
}

/** "1:05" as seconds (dn-track.js mmss). */
export function mmssSecs(t: string): number {
  const m = /(\d+):(\d{2})/.exec(t);
  return m ? +m[1]! * 60 + +m[2]! : 0;
}

/**
 * The finish: the record the web saves (`{t: 'm:ss'}`, the clock's text) and the
 * `dn:puzzle_end` detail (the tracker reads the time back from the sheet).
 */
export function finish(s: PathState, clockSecs: number): { rec: PathRecord; end: PathEnd } {
  const t = timerText(Math.max(0, Math.floor(clockSecs)));
  return { rec: { t }, end: { secs: mmssSecs(t), checks: 0, reveals: 0, hints: s.hints } };
}

export function endDetail(s: PathState, clockSecs: number): Record<string, unknown> {
  return { type: SITE_TYPE, tv: 3, outcome: 'solved', ...finish(s, clockSecs).end };
}

const W = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The finish sheet's one line; none on a reopened puzzle. */
export function finishNote(s: PathState, fresh: boolean): string {
  const h = s.usedHints;
  if (!fresh) return '';
  return h
    ? `One to 36 with ${h === 1 ? 'one hint' : (W[h] || h) + ' hints'}.`
    : 'One to 36 without a hint.';
}
