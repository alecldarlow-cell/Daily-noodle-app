/**
 * Sweep, as a pure model: ported line for line from dailynoodle `engines/sweep.js`
 * (the gate: NB, counts, cascade, deduceStep with its `why` record, solveNoGuess,
 * countSolutions, validateSweep; the player: load, toggleFlag, nudge, dig, lose,
 * the Dig/Flag mode buttons, Hint with provable(), hintPick and hintWhy, checkWin,
 * initRanked/rankLabel, finishSheet's note and restoreDone) and from `dn-track.js`
 * (how the tracker counts Hint presses and names the outcome). No React, no storage,
 * no clock: the caller passes the clock's reading and whether today's result is
 * already in (the streak document), as the page reads them.
 *
 * Moves are the controls a phone has on the page: a tap on a square (dig, or flag in
 * Flag mode), a long press (flag), Dig and Flag, Hint, and the finish sheet's "Play
 * again (not recorded)" after a mine. Reveal all, Restart and the Flag check toggle
 * have been hidden on every device since 15 Oct 2026 (engines/sweep.css), and the F
 * key needs a keyboard, so they are not ported: the outcome is never "revealed" and
 * Flag check stays on (until a mine turns it off, as the engine does).
 *
 * Sets keep the engine's insertion order: Hint's choice (the first square found)
 * depends on the order the open squares were revealed in.
 *
 * Proven identical to the web engine by `scripts/replay.js` (every published Sweep,
 * move by move: squares, numbers, flags, crossed-out numbers, the marked square and
 * ringed numbers, the counter, mode, message, replay label and clock; then the save,
 * streak, `dn:puzzle_end` detail, share line and finish sheet).
 */

export const N = 6;
export const CELLS = 36;
export const ix = (r: number, c: number) => r * N + c;
export const rc = (i: number): [number, number] => [Math.floor(i / N), i % N];
export const NB: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, i) => {
  const [r, c] = rc(i);
  const o: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const y = r + dr;
      const x = c + dc;
      if (y >= 0 && y < N && x >= 0 && x < N) o.push(ix(y, x));
    }
  return o;
});

/** Seven mines in thirty-six squares, every day (the engine's BAND). */
export const MINES = 7;

/** The page's `window.DN_PUZZLE` for a Sweep (coordinates 1-indexed [row, col]). */
export interface SweepData {
  type: 'sweep';
  id: string;
  band: string;
  grid?: string[][];
  mines: [number, number][];
  start: [number, number];
}

export const SAVE_KEY = 'digi-sweep-v1';
export const STREAK_KEY = 'digi-sweep-streak';
/** The site's tracker names Sweep by its page slug. */
export const SITE_TYPE = 'logic-sweep';

// ---- the gate (engines/sweep.js counts, cascade, deduceStep, solveNoGuess, countSolutions, validateSweep) ----

export function counts(ms: ReadonlySet<number>): number[] {
  const n = Array<number>(CELLS).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (ms.has(i)) {
      n[i] = -1;
      continue;
    }
    n[i] = NB[i]!.filter((j) => ms.has(j)).length;
  }
  return n;
}

export function cascade(start: number, n: readonly number[]): Set<number> {
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const i = q.pop()!;
    if (n[i] !== 0) continue;
    for (const j of NB[i]!)
      if (!seen.has(j)) {
        seen.add(j);
        if (n[j] === 0) q.push(j);
      }
  }
  return seen;
}

/** One constraint: `cells` hold `n` mines. `src` is the number's square (-1: the mine count). */
export interface Constraint {
  cells: Set<number>;
  n: number;
  src: number;
  fl: number;
}
/** A two-constraint step: B's cells outside A hold B.n - A.n mines. */
export interface Derived {
  cells: Set<number>;
  n: number;
  A: Constraint;
  B: Constraint;
}
export type Why = Constraint | Derived;
const isDerived = (c: Why): c is Derived => 'A' in c;

export function deduceStep(
  revealed: ReadonlySet<number>,
  flagged: ReadonlySet<number>,
  n: readonly number[],
  total: number,
  useSubset: boolean,
  known?: ReadonlySet<number>,
): { safe: number[]; mine: number[]; usedSubset: boolean; why: Map<number, Why> } {
  const out = (j: number) => revealed.has(j) || flagged.has(j) || (!!known && known.has(j));
  const cons: Constraint[] = [];
  for (const i of revealed) {
    const hid = NB[i]!.filter((j) => !out(j));
    const fl = NB[i]!.filter((j) => flagged.has(j)).length;
    if (hid.length) cons.push({ cells: new Set(hid), n: n[i]! - fl, src: i, fl });
  }
  const allHid: number[] = [];
  for (let i = 0; i < CELLS; i++) if (!out(i)) allHid.push(i);
  if (allHid.length)
    cons.push({ cells: new Set(allHid), n: total - flagged.size, src: -1, fl: flagged.size });
  const safe = new Set<number>();
  const mine = new Set<number>();
  const why = new Map<number, Why>();
  const note = (x: number, c: Why) => {
    if (!why.has(x)) why.set(x, c);
  };
  const trivial = (cs: readonly Why[]) => {
    for (const c of cs) {
      if (c.n === 0)
        c.cells.forEach((x) => {
          safe.add(x);
          note(x, c);
        });
      else if (c.n === c.cells.size)
        c.cells.forEach((x) => {
          mine.add(x);
          note(x, c);
        });
    }
  };
  trivial(cons);
  let usedSubset = false;
  if (useSubset && !safe.size && !mine.size) {
    const derived: Derived[] = [];
    for (const A of cons)
      for (const B of cons) {
        if (A === B || A.cells.size >= B.cells.size) continue;
        let sub = true;
        for (const x of A.cells)
          if (!B.cells.has(x)) {
            sub = false;
            break;
          }
        if (!sub) continue;
        const diff = new Set([...B.cells].filter((x) => !A.cells.has(x)));
        if (diff.size) derived.push({ cells: diff, n: B.n - A.n, A, B });
      }
    trivial(derived);
    if (safe.size || mine.size) usedSubset = true;
  }
  return { safe: [...safe], mine: [...mine], usedSubset, why };
}

/** Gate 1: deduction alone clears the board from the opening. */
export function solveNoGuess(
  ms: ReadonlySet<number>,
  opening: Iterable<number>,
  n: readonly number[],
  useSubset: boolean,
): { ok: boolean; usedSubset?: boolean } {
  const revealed = new Set(opening);
  const flagged = new Set<number>();
  const total = ms.size;
  const safeCount = CELLS - total;
  let usedSubset = false;
  let progress = true;
  while (progress) {
    progress = false;
    const d = deduceStep(revealed, flagged, n, total, useSubset);
    if (d.usedSubset) usedSubset = true;
    for (const x of d.mine)
      if (!flagged.has(x)) {
        flagged.add(x);
        progress = true;
      }
    for (const x of d.safe) {
      if (revealed.has(x) || flagged.has(x)) continue;
      if (ms.has(x)) return { ok: false };
      for (const y of cascade(x, n)) revealed.add(y);
      progress = true;
    }
    if (revealed.size === safeCount) return { ok: true, usedSubset };
  }
  return { ok: false, usedSubset };
}

/** Gate 2: every mine placement consistent with the opening; exactly one must survive. */
export function countSolutions(
  opening: ReadonlySet<number>,
  n: readonly number[],
  total: number,
  cap = 2,
): number {
  const hidden: number[] = [];
  for (let i = 0; i < CELLS; i++) if (!opening.has(i)) hidden.push(i);
  const rev = [...opening];
  const pick: number[] = [];
  let found = 0;
  (function rec(start: number, left: number) {
    if (found >= cap) return;
    if (left === 0) {
      const ms = new Set(pick);
      for (const i of rev) if (NB[i]!.filter((j) => ms.has(j)).length !== n[i]) return;
      found++;
      return;
    }
    for (let k = start; k <= hidden.length - left; k++) {
      pick.push(hidden[k]!);
      rec(k + 1, left - 1);
      pick.pop();
      if (found >= cap) return;
    }
  })(0, total);
  return found;
}

export interface GateResult {
  pass: boolean;
  checks: Record<string, boolean>;
  opening: Set<number>;
  n: number[];
}

/** The engine's ship gate, run at load: a Sweep that fails it refuses to render. 0-indexed. */
export function validateSweep(
  mines: readonly (readonly [number, number])[],
  start: readonly [number, number],
): GateResult {
  const ms = new Set(mines.map(([r, c]) => ix(r, c)));
  const st = ix(start[0], start[1]);
  const n = counts(ms);
  const c: Record<string, boolean> = {};
  c.mine_count = ms.size === MINES;
  c.no_mine_on_opening = !ms.has(st);
  c.opening_is_zero = n[st] === 0;
  const opening = c.opening_is_zero ? cascade(st, n) : new Set([st]);
  c.opening_leaves_work = CELLS - ms.size - opening.size >= Math.ceil((CELLS - ms.size) * 0.4);
  c.unique_solution = countSolutions(opening, n, ms.size) === 1;
  c.solvable_without_guessing = solveNoGuess(ms, opening, n, true).ok;
  return { pass: Object.values(c).every(Boolean), checks: c, opening, n };
}

// ---- validate: refuse what the web player can't show ----

export interface Validation {
  ok: boolean;
  checks: Record<string, boolean>;
}

const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const square = (x: unknown): x is [number, number] =>
  Array.isArray(x) &&
  x.length === 2 &&
  x.every((v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= N);

/**
 * Whether the web player would render this Sweep and could finish it: the data the
 * engine reads (`mines` and `start` as 1-indexed squares on the 6×6 board, an id for
 * the save and share line), then the engine's own ship gate, which it runs at load
 * and which makes the page refuse to render on any failure.
 */
export function validate(data: unknown): Validation {
  const d = object(data) ? data : {};
  const shape = Array.isArray(d.mines) && d.mines.every(square) && square(d.start);
  const gate = shape
    ? validateSweep(
        (d.mines as [number, number][]).map(([r, c]) => [r - 1, c - 1] as const),
        [(d.start as [number, number])[0] - 1, (d.start as [number, number])[1] - 1],
      )
    : null;
  const checks: Record<string, boolean> = {
    is_sweep: d.type === 'sweep',
    has_id: typeof d.id === 'string' && /^DP·SWEEP·/.test(d.id),
    squares_on_board: shape,
    ...(gate ? gate.checks : { ship_gate: false }),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

// ---- the player ----

export interface SweepPuzzle {
  id: string;
  band: string;
  /** Mine squares, as the page orders them. */
  mines: number[];
  MS: ReadonlySet<number>;
  NUM: readonly number[];
  start: number;
  opening: ReadonlySet<number>;
}

/** The marked square (`.hint`): which Hint press marked it, so its 2.4 s timer clears only its own. */
export interface Mark {
  i: number;
  n: number;
}

export interface SweepState {
  p: SweepPuzzle;
  revealed: Set<number>;
  flagged: Set<number>;
  boomed: Set<number>;
  startDug: boolean;
  /** The clock is running or has run (the engine's `started`). */
  started: boolean;
  over: boolean;
  won: boolean;
  flagMode: boolean;
  /** Numbers touching more flags than they say are crossed out; off after a mine. */
  flagCheck: boolean;
  /** Today's result is not yet on the books (the engine's `ranked`). */
  ranked: boolean;
  /** `ranked` as it was when this round ended (the engine's `endRanked`). */
  endRanked: boolean;
  replayStarted: boolean;
  /** The clock's seconds when the round ended. */
  endSecs: number;
  /** The engine's `#msg`, as it sets it (innerHTML: may hold `<b>`). */
  msg: string;
  hintShown: boolean;
  /** `#rank`: "· replay" or nothing. */
  rank: string;
  mark: Mark | null;
  /** The ringed numbers (`.why`). */
  why: number[];
  /** The engine's `usedHints`, for the finish sheet (never reset by Play again). */
  usedHints: number;
  /** Hint presses dn-track.js counts (every press on #hint). */
  hints: number;
  /** Rounds played on this page: 1, then 2 after Play again, and so on. */
  round: number;
}

export type Move =
  /** Tap a square: dig it, or flag it in Flag mode. */
  | { t: 'tap'; i: number }
  /** Long-press a square: flag it (or take its flag off). */
  | { t: 'press'; i: number }
  /** The Dig / Flag buttons. */
  | { t: 'mode'; flag: boolean }
  | { t: 'hint' }
  /** The finish sheet's "Play again (not recorded)", after a mine. */
  | { t: 'again' };

/** What the caller knows when a move is made, as the page reads it at that moment. */
export interface Env {
  /** The clock's seconds as shown. */
  secs?: number;
  /** For Play again: whether today's result is still to come (no date today in the streak). */
  ranked?: boolean;
}

/** How long a press must last to flag (the engine's 350 ms long-press timer). */
export const LONG_PRESS_MS = 350;
/** How long Hint's marked square pulses before its mark goes. */
export const MARK_MS = 2400;

export const START_MSG = "Tap the highlighted cell to begin — it's proven safe.";
export const REPLAY_MSG =
  "Today's result is already in — this is a replay, and nothing is recorded.";
export const NOTHING_MSG =
  'Nothing new is deducible from the board as it stands — check your flags.';
export const WRONG_FLAG = "This flag can't be right: this square is provably safe.";
export const LOSS_MSG = 'That was a mine. The grid never needed a guess — the step was there.';
export const LOSS_REPLAY_MSG = 'That was a mine. Replay — nothing recorded.';

export function puzzleOf(data: SweepData): SweepPuzzle {
  const mines = data.mines.map(([r, c]) => [r - 1, c - 1] as const);
  const start = [data.start[0] - 1, data.start[1] - 1] as const;
  const v = validateSweep(mines, start);
  const MS = new Set(mines.map(([r, c]) => ix(r, c)));
  return {
    id: data.id,
    band: data.band,
    mines: [...MS],
    MS,
    NUM: v.n,
    start: ix(start[0], start[1]),
    opening: v.opening,
  };
}

/** Load the board (the engine's load, then initRanked's rankLabel). */
function load(p: SweepPuzzle, prev: Partial<SweepState>, ranked: boolean, done: boolean) {
  const replayStarted = !!prev.replayStarted;
  const show = !ranked && (replayStarted || !done);
  const s: SweepState = {
    p,
    revealed: new Set(),
    flagged: new Set(),
    boomed: new Set(),
    startDug: false,
    started: false,
    over: false,
    won: false,
    flagMode: prev.flagMode ?? false,
    flagCheck: prev.flagCheck ?? true,
    ranked,
    endRanked: prev.endRanked ?? true,
    replayStarted,
    endSecs: 0,
    msg: show ? REPLAY_MSG : START_MSG,
    hintShown: false,
    rank: show ? '· replay' : '',
    mark: null,
    why: [],
    usedHints: prev.usedHints ?? 0,
    hints: prev.hints ?? 0,
    round: (prev.round ?? 0) + 1,
  };
  return s;
}

/**
 * A new game. `ranked`: today's result isn't in yet (the streak's dates lack today);
 * `done`: this puzzle already has a saved result (then rankLabel stays quiet).
 */
export function init(data: SweepData, ctx: { ranked: boolean; done?: boolean }): SweepState {
  return load(puzzleOf(data), {}, ctx.ranked, !!ctx.done);
}

export type SavedOutcome = 'win' | 'loss' | 'gave';
export interface SweepRecord {
  o: SavedOutcome;
  s: number;
  b?: number;
}

/** A saved result the engine would reopen (restoreDone's checks), or null. */
export function savedRecord(rec: unknown, p: SweepPuzzle): SweepRecord | null {
  if (!object(rec) || typeof rec.o !== 'string' || !/^(win|loss|gave)$/.test(rec.o)) return null;
  if (rec.o === 'loss' && !p.MS.has(rec.b as number)) return null;
  return rec as unknown as SweepRecord;
}

/**
 * A finished Sweep reopened from its save (the engine's restoreDone), or null when the
 * record is one the engine won't reopen (then the board plays, with no start card).
 */
export function restore(data: SweepData, rec: unknown, ranked: boolean): SweepState | null {
  const s = init(data, { ranked, done: true });
  const r = savedRecord(rec, s.p);
  if (!r) return null;
  const won = r.o === 'win';
  s.startDug = true;
  s.over = true;
  s.won = won;
  s.endSecs = recordSeconds(r);
  for (let k = 0; k < CELLS; k++) {
    if (!s.p.MS.has(k)) s.revealed.add(k);
    else if (r.o === 'loss' && k === r.b) s.boomed.add(k);
    else s.flagged.add(k);
  }
  if (!won) s.flagCheck = false;
  s.msg = won
    ? `Swept in <b>${timerText(s.endSecs)}</b>.`
    : r.o === 'loss'
      ? LOSS_MSG
      : 'Revealed.';
  return s;
}

const HW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const hintSq = (k: number) => (k === 1 ? 'other hidden square is' : 'other hidden squares are');
const hintAll = (k: number) => (k === 1 ? 'it' : k === 2 ? 'both' : 'all ' + HW[k]);

/** Hint's one line: the deduction that found the square (the engine's hintWhy). */
export function hintWhy(c: Why, NUM: readonly number[], mines: number): string {
  const num = (s: number) => NUM[s]!;
  if (!isDerived(c)) {
    const H = c.cells.size;
    if (c.src < 0) {
      if (c.n === 0) return `All ${HW[mines]} mines are flagged, so every other square is safe.`;
      return `Only ${HW[c.n]} mine${c.n > 1 ? 's are' : ' is'} left and only ${HW[H]} square${H > 1 ? 's are' : ' is'} still hidden, so ${H === 1 ? "it's a mine" : H === 2 ? 'both are mines' : "they're all mines"}.`;
    }
    const Nn = num(c.src);
    const F = c.fl;
    if (c.n === 0)
      return `This ${Nn} already touches ${Nn === 1 ? 'its flagged mine' : 'its ' + HW[Nn] + ' flagged mines'}, so its ${hintSq(H)} safe.`;
    const end =
      H === 1
        ? 'that square is a mine'
        : H === 2
          ? 'both are mines'
          : 'all ' + HW[H] + ' are mines';
    if (!F)
      return H === 1
        ? `This ${Nn} has only one hidden square next to it, so that square is a mine.`
        : `This ${Nn} has exactly ${HW[H]} hidden squares left, so ${end}.`;
    return `This ${Nn} already has ${HW[F]} flagged mine${F > 1 ? 's' : ''} and only ${HW[H]} hidden square${H > 1 ? 's' : ''} left, so ${end}.`;
  }
  const A = c.A;
  const B = c.B;
  const s = A.cells.size;
  const d = c.cells.size;
  const k = c.n;
  const Ra = A.n;
  const Na = num(A.src);
  if (B.src < 0) {
    const T = B.n;
    const st = A.fl ? 'still ' : '';
    if (k === 0)
      return `Only ${HW[T]} mine${T > 1 ? 's are' : ' is'} left, and this ${Na} ${st}needs ${hintAll(T)}, so every hidden square not touching it is safe.`;
    const Tw = HW[T]![0]!.toUpperCase() + HW[T]!.slice(1);
    return `${Tw} mine${T > 1 ? 's are' : ' is'} left and this ${Na} ${st}needs ${HW[Ra]}, so ${d === 1 ? 'the one hidden square not touching it is a mine' : `the ${HW[d]} hidden squares not touching it are ${d === 2 ? 'both' : 'all'} mines`}.`;
  }
  const Nb = num(B.src);
  const same = Na === Nb;
  const st = A.fl || B.fl ? 'still ' : '';
  const open = same
    ? `These two ${Na}s share ${HW[s]} hidden squares`
    : `This ${Nb} and this ${Na} share ${HW[s]} hidden squares`;
  if (k === 0) {
    const its = `its ${A.fl ? 'last ' : ''}${Ra === 1 ? 'mine is' : HW[Ra] + ' mines are'} there`;
    return same
      ? `${open}, and one of them touches no others, so ${its}. That's all the other ${Nb} ${st}needs, so its ${hintSq(d)} safe.`
      : `${open}, and the ${Na} touches no others, so ${its}. That's all the ${Nb} ${B.fl ? 'still ' : ''}needs, so its ${hintSq(d)} safe.`;
  }
  const more = k === 1 ? 'one more mine' : HW[k] + ' more mines';
  const tail =
    d === 1
      ? 'it can only be in its other square'
      : `they can only be in its other ${HW[d]} squares`;
  return same
    ? `${open}. One of them ${st}needs ${more} than the other, and ${tail}.`
    : `${open}. The ${Nb} ${st}needs ${more} than the ${Na}, and ${tail}.`;
}

/** Everything the open numbers and the mine count prove, ignoring the player's flags. */
export function provable(s: SweepState): { K: Set<number>; S: Set<number> } {
  const K = new Set<number>();
  const S = new Set<number>();
  for (;;) {
    const d = deduceStep(s.revealed, K, s.p.NUM, s.p.MS.size, true, S);
    if (!d.safe.length && !d.mine.length) return { K, S };
    for (const x of d.mine) K.add(x);
    for (const x of d.safe) S.add(x);
  }
}

export type HintPick = { pick: number; wrong: true } | { pick: number; c: Why; safe: boolean };

/** What Hint marks: a flag on a provably safe square, the next deduction, or null. */
export function hintPick(s: SweepState): HintPick | null {
  const { K, S } = provable(s);
  for (const x of S) if (s.flagged.has(x)) return { pick: x, wrong: true };
  const F = new Set([...s.flagged].filter((x) => K.has(x)));
  const d = deduceStep(s.revealed, F, s.p.NUM, s.p.MS.size, true);
  const safe = d.safe.filter((x) => !s.revealed.has(x) && !s.flagged.has(x));
  const mine = d.mine.filter((x) => !s.flagged.has(x) && !s.boomed.has(x));
  const pick = safe.length ? safe[0]! : mine.length ? mine[0]! : null;
  return pick === null ? null : { pick, c: d.why.get(pick)!, safe: safe.length > 0 };
}

export const minesLeft = (s: SweepState) => s.p.MS.size - s.flagged.size - s.boomed.size;

/** A number touching more flags (or the mine hit) than it says: crossed out. */
export function overCount(s: SweepState, i: number): boolean {
  const n = s.p.NUM[i]!;
  return (
    s.flagCheck && n > 0 && NB[i]!.filter((j) => s.flagged.has(j) || s.boomed.has(j)).length > n
  );
}

function copy(prev: SweepState): SweepState {
  return {
    ...prev,
    revealed: new Set(prev.revealed),
    flagged: new Set(prev.flagged),
    boomed: new Set(prev.boomed),
    why: prev.why.slice(),
  };
}

/** Apply one move; returns a new state (the old one is never changed). */
export function apply(prev: SweepState, move: Move, env: Env = {}): SweepState {
  if (move.t === 'again') {
    if (!prev.over || prev.won) return prev;
    return load(prev.p, { ...prev, replayStarted: true }, env.ranked ?? prev.ranked, true);
  }
  const s = copy(prev);
  const P = s.p;
  const secs = Math.max(0, Math.floor(env.secs ?? 0));
  const startTimer = () => {
    if (s.started || s.over) return;
    s.started = true;
  };
  const clearWhy = () => {
    s.why = [];
    if (s.hintShown) {
      s.hintShown = false;
      s.msg = '';
    }
  };
  const nudge = () => {
    if (s.over) return;
    const called = s.revealed.size + s.flagged.size + s.boomed.size;
    if (called === CELLS && s.revealed.size !== CELLS - P.MS.size)
      s.msg = `All ${CELLS} squares called, but the sweep isn't done — a flag is sitting on a safe square. The counter reads <b>${minesLeft(s)}</b>.`;
  };
  const checkWin = () => {
    if (s.over) return;
    if (s.revealed.size !== CELLS - P.MS.size) return;
    s.over = true;
    s.won = true;
    s.endSecs = secs;
    for (const i of P.MS) s.flagged.add(i);
    s.msg = `Swept in <b>${timerText(secs)}</b>.${s.ranked ? ' Nice.' : ' Replay — nothing recorded.'}`;
    s.endRanked = s.ranked;
  };
  const toggleFlag = (i: number): SweepState => {
    if (!s.startDug) return prev;
    if (s.over || s.revealed.has(i) || s.boomed.has(i)) return prev;
    clearWhy();
    startTimer();
    if (s.flagged.has(i)) s.flagged.delete(i);
    else s.flagged.add(i);
    nudge();
    return s;
  };
  const lose = (i: number) => {
    s.over = true;
    s.won = false;
    s.boomed.add(i);
    s.endSecs = secs;
    for (const m of P.MS) if (m !== i) s.flagged.add(m);
    for (let k = 0; k < CELLS; k++) if (!P.MS.has(k)) s.revealed.add(k);
    s.flagCheck = false;
    s.endRanked = s.ranked;
    s.msg = s.ranked ? LOSS_MSG : LOSS_REPLAY_MSG;
  };
  const dig = (i: number): SweepState => {
    if (s.over || s.revealed.has(i) || s.flagged.has(i) || s.boomed.has(i)) return prev;
    if (!s.startDug) {
      if (i !== P.start) return prev;
      s.startDug = true;
      startTimer();
      for (const y of P.opening) s.revealed.add(y);
      s.msg = '';
      checkWin();
      nudge();
      return s;
    }
    clearWhy();
    startTimer();
    if (P.MS.has(i)) {
      lose(i);
      return s;
    }
    for (const y of cascade(i, P.NUM)) s.revealed.add(y);
    checkWin();
    nudge();
    return s;
  };
  switch (move.t) {
    case 'tap':
      if (!(move.i >= 0 && move.i < CELLS)) return prev;
      return s.flagMode ? toggleFlag(move.i) : dig(move.i);
    case 'press':
      if (!(move.i >= 0 && move.i < CELLS)) return prev;
      return toggleFlag(move.i);
    case 'mode':
      s.flagMode = move.flag;
      return s;
    case 'hint': {
      s.hints++;
      if (!s.over) s.usedHints++;
      if (s.over) return s;
      clearWhy();
      const h = hintPick(s);
      if (!h) {
        s.msg = NOTHING_MSG;
        return s;
      }
      s.mark = { i: h.pick, n: s.hints };
      if ('wrong' in h) s.msg = WRONG_FLAG;
      else {
        const c = h.c;
        for (const x of isDerived(c) ? [c.A.src, c.B.src] : [c.src]) if (x >= 0) s.why.push(x);
        s.msg = hintWhy(c, P.NUM, P.MS.size);
      }
      s.hintShown = true;
      return s;
    }
  }
}

/** Hint's mark fades 2.4 s after the press that set it (a later press keeps its own). */
export function unmark(s: SweepState, n: number): SweepState {
  return s.mark && s.mark.n === n ? { ...s, mark: null } : s;
}

// ---- the finish ----

export type SweepOutcome = 'solved' | 'failed';
export interface SweepEnd {
  secs: number;
  checks: number;
  reveals: number;
  hints: number;
}

/**
 * The finish: the record the web saves (`{o, s, b?}`, before putDone adds `d`), the
 * outcome dn-track.js reports ("Boom." is its loss title), and the detail. The tracker
 * reads the time back from the sheet (`#winTime`), the clock's own seconds.
 */
export function finish(s: SweepState): {
  rec: SweepRecord;
  outcome: SweepOutcome;
  end: SweepEnd;
} {
  const b = [...s.boomed][0];
  const rec: SweepRecord = s.won ? { o: 'win', s: s.endSecs } : { o: 'loss', s: s.endSecs, b: b! };
  return {
    rec,
    outcome: s.won ? 'solved' : 'failed',
    end: { secs: s.endSecs, checks: 0, reveals: 0, hints: s.hints },
  };
}

/** The `dn:puzzle_end` detail the site's tracker would send for this finish. */
export function endDetail(s: SweepState): Record<string, unknown> {
  const { outcome, end } = finish(s);
  return { type: SITE_TYPE, tv: 3, outcome, ...end };
}

const W = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The finish sheet's one line (finishSheet's note); `fresh` is false on a reopened puzzle. */
export function finishNote(s: SweepState, fresh: boolean): string {
  const m = W[s.p.MS.size] || s.p.MS.size;
  const h = s.usedHints;
  if (!s.won) return 'That was a mine. The grid never needed a guess; the step was there to find.';
  if (!fresh) return `All ${m} mines found.`;
  return `All ${m} mines found, ${h ? (h === 1 ? 'with one hint' : `with ${W[h] || h} hints`) : 'no hints'}.`;
}

/** The page's clock text, "MM:SS". */
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

/** One square of the finish sheet's board: a flag, the mine hit, or its number. */
export function recapCell(s: SweepState, k: number): 'flag' | 'boom' | number {
  if (s.p.MS.has(k)) return s.boomed.has(k) ? 'boom' : 'flag';
  return s.p.NUM[k]!;
}

/** The message as plain text, the way a screen reader (and textContent) reads it. */
export const msgText = (msg: string) => msg.replace(/<\/?b>/g, '');
