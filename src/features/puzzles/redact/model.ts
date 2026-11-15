/**
 * Redact's rules, ported line by line from dailynoodle engines/redact.js (Lab, 6 Nov 2026):
 * an n×n grid full of letters, some of them decoys where the black squares belong. Tap a
 * letter to black it out; when the black set is right every across and down run is a word.
 * Pure TypeScript with no React or storage; the screen and the differential replay
 * (scripts/replay.js) both play it. Moves are the page's controls: a tap on a letter, Undo
 * and Clear.
 */
export const SAVE_KEY = 'digi-redact-v1';
export const STREAK_KEY = 'digi-redact-streak';
/** The page's message before anything is tapped (its #msg markup). */
export const START_MSG = 'Tap a letter to black it out. Every row and column must read as words.';
export const RESUME_MSG = 'Carrying on where you left off.';
/** The engine keeps the last 300 taps for Undo (Clear's snapshot isn't capped). */
const UNDO_MAX = 300;

export interface RedactData {
  type: 'redact';
  id: string;
  band: string;
  n: number;
  /** n² capitals, row by row. */
  letters: string;
  /** The answer: the squares to black out. */
  black: number[];
  /** Every run across then down, as the gate reads them. */
  words: string[];
  seed?: string;
}

export interface RedactState {
  p: RedactData;
  n: number;
  /** How many squares the answer blacks out. */
  k: number;
  /** The blacked-out squares, in the order they were tapped (the page's Set). */
  black: number[];
  /** Undo's snapshots of `black`. */
  hist: number[][];
  taps: number;
  /** Wrong tries at the full count. */
  misses: number;
  solved: boolean;
  msg: string;
  /** Bumped on each wrong try at the full count: the board shakes. */
  shake: number;
}

export type Move = { t: 'cell'; i: number } | { t: 'undo' } | { t: 'clear' };

/** Every row, then every column, as lists of squares. */
export function lines(n: number): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < n; r++) out.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) out.push(Array.from({ length: n }, (_, r) => r * n + c));
  return out;
}

/** A line's runs of white squares. */
export function runsOf(cells: readonly number[], black: ReadonlySet<number>): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  for (const c of cells) {
    if (black.has(c)) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(c);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** The page's ship gate: the answer must be a proper crossword. */
export function validate(data: unknown): { ok: boolean; checks: string[] } {
  const p = data as Partial<RedactData> | null;
  if (
    !p ||
    !Number.isInteger(p.n) ||
    typeof p.letters !== 'string' ||
    p.letters.length !== p.n! * p.n! ||
    !/^[A-Z]+$/.test(p.letters) ||
    !Array.isArray(p.black)
  )
    return { ok: false, checks: ['malformed board'] };
  const errs: string[] = [];
  const black = new Set(p.black);
  const words: string[] = [];
  for (const line of lines(p.n!))
    for (const run of runsOf(line, black)) {
      if (run.length < 3) errs.push(`a run of ${run.length}`);
      words.push(
        run
          .map((c) => p.letters![c])
          .join('')
          .toLowerCase(),
      );
    }
  if (Array.isArray(p.words) && words.join() !== p.words.join())
    errs.push("the words don't match the grid");
  return { ok: errs.length === 0, checks: errs };
}

const key = (b: readonly number[]) =>
  b
    .slice()
    .sort((x, y) => x - y)
    .join();

export function init(p: RedactData): RedactState {
  return {
    p,
    n: p.n,
    k: p.black.length,
    black: [],
    hist: [],
    taps: 0,
    misses: 0,
    solved: false,
    msg: START_MSG,
    shake: 0,
  };
}

/** Are the white squares all joined up? */
export function connectedNow(n: number, black: readonly number[]): boolean {
  const off = new Set(black);
  const whites: number[] = [];
  for (let i = 0; i < n * n; i++) if (!off.has(i)) whites.push(i);
  const seen = new Set([whites[0]]);
  const stack = [whites[0]!];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const r2 = r + dr;
      const c2 = c + dc;
      const j = r2 * n + c2;
      if (r2 >= 0 && r2 < n && c2 >= 0 && c2 < n && !off.has(j) && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === whites.length;
}

/** At the full count: the first rule broken, in words a player can act on (engine's whyNot). */
export function whyNot(s: Pick<RedactState, 'n' | 'black' | 'p'>): string {
  const { n } = s;
  const off = new Set(s.black);
  const L = lines(n);
  for (let li = 0; li < L.length; li++) {
    const across = li < n;
    const num = (across ? li : li - n) + 1;
    for (const run of runsOf(L[li]!, off))
      if (run.length < 3) {
        const letters = run.map((c) => s.p.letters[c]).join('');
        return `${
          run.length === 1 ? `${letters} is on its own` : `${letters} is only two letters`
        } in ${across ? 'row ' : 'column '}${num}: every run needs three letters or more.`;
      }
  }
  if (!connectedNow(n, s.black)) return 'Not yet: the white squares must all join up.';
  return 'Not yet: a row or column doesn’t read as words.';
}

function tap(s: RedactState, i: number): RedactState {
  const hist = [...s.hist, s.black];
  if (hist.length > UNDO_MAX) hist.shift();
  const black = s.black.includes(i) ? s.black.filter((x) => x !== i) : [...s.black, i];
  const next: RedactState = { ...s, hist, black, taps: s.taps + 1, msg: '' };
  if (key(black) === key(s.p.black)) return { ...next, solved: true };
  if (black.length === s.k)
    return { ...next, misses: s.misses + 1, msg: whyNot(next), shake: s.shake + 1 };
  if (black.length > s.k) return { ...next, msg: `That’s more than ${s.k}.` };
  return next;
}

/** One move. A finished board takes none, as every control's guard in the engine. */
export function apply(s: RedactState, m: Move): RedactState {
  if (s.solved) return s;
  switch (m.t) {
    case 'cell':
      return tap(s, m.i);
    case 'undo': {
      if (!s.hist.length) return s;
      return { ...s, black: s.hist[s.hist.length - 1]!, hist: s.hist.slice(0, -1), msg: '' };
    }
    case 'clear': {
      if (!s.black.length) return s;
      return { ...s, hist: [...s.hist, s.black], black: [], msg: '' };
    }
  }
}

/** Undo and Clear as the page enables them. */
export const undoOff = (s: RedactState) => !s.hist.length || s.solved;
export const clearOff = (s: RedactState) => !s.black.length || s.solved;

/** The screen reader's words for a square (the engine's aria-label). */
export function cellLabel(s: RedactState, i: number): string {
  const on = s.black.includes(i);
  return `Row ${Math.floor(i / s.n) + 1}, column ${(i % s.n) + 1}, ${s.p.letters[i]}${
    on ? ', blacked out' : ''
  }`;
}

/** A finished board as it reopens: the answer blacked out, nothing to undo. */
export function restoreDone(p: RedactData): RedactState {
  return { ...init(p), black: p.black.slice(), solved: true, msg: '' };
}

/** The engine's fmt: rounded seconds as m:ss. */
export function timerText(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "Redact 25" from "DP·REDA·0025". */
export const redactNumber = (id: string) => parseInt(String(id).split('·').pop() ?? '', 10);

/** Spelled-out counts for the rule sentence (engines/house.js W). */
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
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The house line (tools/standfirst.js) and How to play (engines/house.js), word for word. */
export const HOUSE_LINE =
  "There's a crossword hiding in here. Black out the letters that don't belong to find it.";
export function ruleSentence(p: RedactData): string {
  const k = p.black.length;
  return `${cap(W[k] ?? String(k))} of these letters don’t belong. Black them out and the grid becomes a crossword.`;
}
export const HOW = [
  'Tap a letter to black it out; tap it again to bring it back. The rules are a crossword’s: every run of white squares across and down must be at least three letters long and a real word, and the white squares must all join up. A letter left on its own, or two together, breaks the rule even if the words the other way are right.',
  'The count shows how many to find. Undo takes back a tap and Clear starts again. Every board can be worked out from the rows and columns alone, so there is nothing to guess. The clock starts when you tap Play.',
];
