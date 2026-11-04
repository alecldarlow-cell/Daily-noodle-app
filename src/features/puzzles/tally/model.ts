/**
 * Tally's rules, ported line by line from dailynoodle engines/tally.js: a 4×4 calcudoku.
 * Pure TypeScript with no React or storage; the screen and the differential replay
 * (scripts/replay.js) both play it. Moves are the controls a phone has: a tap on a square,
 * a keypad number, Notes, Erase and Undo.
 */
export const SAVE_KEY = 'digi-tally-v1';
export const STREAK_KEY = 'digi-tally-streak';
export const START_MSG = 'Tap a square, then a number.';
export const RESUME_MSG = 'Carrying on where you left off.';
export const NOTES_MSG = 'Notes on: numbers go in small.';
export const NO_SQUARE_MSG = 'Tap a square first.';
/** The engine keeps the last 200 moves for Undo. */
const UNDO_MAX = 200;

export type Op = '+' | '-' | '*' | '/' | '=';

export interface Cage {
  c: number[];
  op: Op;
  t: number;
}

export interface TallyData {
  type: 'tally';
  id: string;
  band: string;
  n: number;
  cages: Cage[];
  sol: string;
}

export interface TallyState {
  p: TallyData;
  /** Size of a side, and every square's cage. */
  n: number;
  cageOf: number[];
  g: number[];
  /** Bit d set: the note d is on in that square. */
  notes: number[];
  sel: number;
  notesMode: boolean;
  undo: { g: number[]; notes: number[] }[];
  solved: boolean;
  msg: string;
}

export type Move =
  | { t: 'cell'; i: number }
  | { t: 'digit'; d: number }
  | { t: 'notes' }
  | { t: 'erase' }
  | { t: 'undo' };

const OPS: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷', '=': '' };

/** The sign as the board draws it; empty for a lone number. */
export const opSign = (op: Op) => OPS[op];

/** "12×", or "3" for a lone number (the engine's label). */
export const label = (cg: Cage) => (cg.op === '=' ? String(cg.t) : `${cg.t}${OPS[cg.op]}`);

export function satisfies(op: Op, t: number, v: number[]): boolean {
  if (op === '=') return v.length === 1 && v[0] === t;
  if (op === '+') return v.reduce((a, b) => a + b, 0) === t;
  if (op === '*') return v.reduce((a, b) => a * b, 1) === t;
  if (op === '-') return v.length === 2 && Math.abs(v[0]! - v[1]!) === t;
  if (op === '/') {
    if (v.length !== 2) return false;
    const hi = Math.max(v[0]!, v[1]!);
    const lo = Math.min(v[0]!, v[1]!);
    return hi % lo === 0 && hi / lo === t;
  }
  return false;
}

/** The page's ship gate: a board that breaks these never renders. */
export function validate(data: unknown): { ok: boolean; checks: string[] } {
  const p = data as Partial<TallyData> | null;
  const n = (p && p.n) || 4;
  const cells = n * n;
  if (!p || !Array.isArray(p.cages) || typeof p.sol !== 'string' || p.sol.length !== cells)
    return { ok: false, checks: ['malformed puzzle'] };
  const errs: string[] = [];
  const seen = new Array<boolean>(cells).fill(false);
  for (const cg of p.cages) {
    if (!cg.c.length || cg.c.length > 4) errs.push('cage size');
    for (const i of cg.c) {
      if (seen[i]) errs.push('cell in two cages');
      seen[i] = true;
    }
    if ((cg.op === '-' || cg.op === '/') && cg.c.length !== 2)
      errs.push(`${cg.op} on ${cg.c.length} cells`);
    if (
      !satisfies(
        cg.op,
        cg.t,
        cg.c.map((i) => +p.sol![i]!),
      )
    )
      errs.push(`clue ${label(cg)} does not match`);
  }
  if (seen.some((s) => !s)) errs.push('a cell belongs to no cage');
  for (let r = 0; r < n; r++) {
    const a = new Set<string>();
    const b = new Set<string>();
    for (let c = 0; c < n; c++) {
      a.add(p.sol[r * n + c]!);
      b.add(p.sol[c * n + r]!);
    }
    if (a.size !== n || b.size !== n) errs.push('solution is not a Latin square');
  }
  return { ok: errs.length === 0, checks: errs };
}

export function init(p: TallyData): TallyState {
  const n = p.n || 4;
  const cageOf = new Array<number>(n * n).fill(0);
  p.cages.forEach((cg, k) => cg.c.forEach((i) => (cageOf[i] = k)));
  return {
    p,
    n,
    cageOf,
    g: new Array<number>(n * n).fill(0),
    notes: new Array<number>(n * n).fill(0),
    sel: -1,
    notesMode: false,
    undo: [],
    solved: false,
    msg: START_MSG,
  };
}

function solvedNow(s: TallyState): boolean {
  const { g, n } = s;
  if (g.some((v) => !v)) return false;
  for (let r = 0; r < n; r++) {
    const a = new Set<number>();
    const b = new Set<number>();
    for (let c = 0; c < n; c++) {
      a.add(g[r * n + c]!);
      b.add(g[c * n + r]!);
    }
    if (a.size !== n || b.size !== n) return false;
  }
  return s.p.cages.every((cg) =>
    satisfies(
      cg.op,
      cg.t,
      cg.c.map((i) => g[i]!),
    ),
  );
}

const withUndo = (s: TallyState) => [...s.undo, { g: s.g, notes: s.notes }].slice(-UNDO_MAX);

function enter(s: TallyState, d: number): TallyState {
  if (s.sel < 0) return { ...s, msg: NO_SQUARE_MSG };
  const i = s.sel;
  const { n } = s;
  const g = s.g.slice();
  const notes = s.notes.slice();
  const undo = withUndo(s);
  if (s.notesMode) {
    if (g[i]) g[i] = 0;
    notes[i]! ^= 1 << d;
  } else {
    g[i] = g[i] === d ? 0 : d;
    notes[i] = 0;
    if (g[i]) {
      const r = Math.floor(i / n);
      const c = i % n;
      for (let j = 0; j < n * n; j++)
        if (j !== i && (Math.floor(j / n) === r || j % n === c)) notes[j]! &= ~(1 << d);
    }
  }
  const next: TallyState = { ...s, g, notes, undo, msg: '' };
  return solvedNow(next) ? { ...next, solved: true, sel: -1 } : next;
}

/** One move. A finished board takes none, as every control's guard in the engine. */
export function apply(s: TallyState, m: Move): TallyState {
  if (s.solved) return s;
  switch (m.t) {
    case 'cell':
      return { ...s, sel: m.i };
    case 'digit':
      return enter(s, m.d);
    case 'notes': {
      const notesMode = !s.notesMode;
      return { ...s, notesMode, msg: notesMode ? NOTES_MSG : '' };
    }
    case 'erase': {
      if (s.sel < 0) return s;
      const undo = withUndo(s);
      const g = s.g.slice();
      const notes = s.notes.slice();
      g[s.sel] = 0;
      notes[s.sel] = 0;
      return { ...s, g, notes, undo };
    }
    case 'undo': {
      if (!s.undo.length) return s;
      const u = s.undo[s.undo.length - 1]!;
      return { ...s, g: u.g, notes: u.notes, undo: s.undo.slice(0, -1) };
    }
  }
}

export interface CellView {
  v: number;
  bad: boolean;
  sel: boolean;
  cage: boolean;
  peer: boolean;
  same: boolean;
  /** The clue this square carries, if it is its cage's first. */
  clue: Cage | null;
  /** The carried clue's state once its cage is full. */
  clueState: '' | 'ok' | 'bad';
  /** The cage's edges on this square's sides. */
  bt: boolean;
  bb: boolean;
  bl: boolean;
  br: boolean;
}

/** Every square as the engine's paint() marks it. */
export function view(s: TallyState): CellView[] {
  const { g, n, cageOf, sel, p } = s;
  const dup = new Set<number>();
  for (let r = 0; r < n; r++) {
    const seen: Record<number, number> = {};
    const seenC: Record<number, number> = {};
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const v = g[i]!;
      if (v) {
        if (seen[v] !== undefined) dup.add(i).add(seen[v]);
        seen[v] = i;
      }
      const j = c * n + r;
      const w = g[j]!;
      if (w) {
        if (seenC[w] !== undefined) dup.add(j).add(seenC[w]);
        seenC[w] = j;
      }
    }
  }
  const selCage = sel >= 0 ? cageOf[sel]! : null;
  const selVal = sel >= 0 ? g[sel]! : 0;
  const row = (i: number) => Math.floor(i / n);
  return g.map((v, i) => {
    const k = cageOf[i]!;
    const cg = p.cages[k]!;
    const first = cg.c[0] === i;
    const vals = cg.c.map((x) => g[x]!);
    const full = vals.every(Boolean);
    return {
      v,
      bad: dup.has(i),
      sel: i === sel,
      cage: i !== sel && selCage !== null && k === selCage,
      peer:
        i !== sel &&
        selCage !== null &&
        k !== selCage &&
        (row(i) === row(sel) || i % n === sel % n),
      same: i !== sel && !!selVal && v === selVal,
      clue: first ? cg : null,
      clueState: !first || !full ? '' : satisfies(cg.op, cg.t, vals) ? 'ok' : 'bad',
      bt: row(i) === 0 || cageOf[i - n] !== k,
      bb: row(i) === n - 1 || cageOf[i + n] !== k,
      bl: i % n === 0 || cageOf[i - 1] !== k,
      br: i % n === n - 1 || cageOf[i + 1] !== k,
    };
  });
}

/** The engine's fmt: rounded seconds as m:ss. */
export function timerText(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The screen reader's words for a square (the engine's aria-label). */
export function cellLabel(s: TallyState, i: number, cell: CellView): string {
  const r = Math.floor(i / s.n) + 1;
  const c = (i % s.n) + 1;
  return `Row ${r}, column ${c}${cell.v ? `, ${cell.v}` : ', empty'}${
    cell.clue ? `, cage ${label(cell.clue)}` : ''
  }`;
}

/** A finished board as it reopens: the solution, nothing selected. */
export function restoreDone(p: TallyData): TallyState {
  const s = init(p);
  return { ...s, g: p.sol.split('').map(Number), solved: true };
}

/** "Tally 12" from "DP·TALLY·0012". */
export const tallyNumber = (id: string) => parseInt(String(id).split('·').pop() ?? '', 10);
