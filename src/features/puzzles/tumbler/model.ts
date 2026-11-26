/**
 * Tumbler's rules, ported line by line from dailynoodle engines/tumbler.js (Lab, 6 Nov 2026):
 * a hidden word in four wheels of letters. Wheels turn down and wrap round, and a tapped letter
 * comes to the line (26 Nov 2026); the outlined line (the middle row) is read and submitted. A real word gets Wordle-style clues; the hidden word
 * solves it. Pure TypeScript with no React or storage; the screen and the differential
 * replay (scripts/replay.js) both play it.
 */
export const SAVE_KEY = 'digi-tumbler-v1';
export const STREAK_KEY = 'digi-tumbler-streak';
/** The page's message before anything is played (its markup). */
export const START_MSG = 'Make a word on the outlined line and submit it for clues.';
export const RESUME_MSG = 'Carrying on where you left off.';
/**
 * The row of each wheel that is drawn as the outlined line: the middle row (Alec, 26 Nov 2026;
 * row 1 before). Offsets keep their old meaning: the letter on the line is
 * wheels[k][(LINE + off[k]) mod size], so boards start on the same word, saved rounds
 * (`cur.o`) resume on the same line and the site's gate still holds.
 */
export const READ = 3;
/** The wheel position the offsets count from: the line as it was first drawn (row 1). */
export const LINE = 1;

export interface TumblerData {
  type: 'tumbler';
  id: string;
  band: string;
  n: number;
  wheels: string[];
  secret: string;
  words: string[];
  seed?: string;
}

export interface TumblerState {
  p: TumblerData;
  /** Letters per wheel. */
  size: number;
  words: ReadonlySet<string>;
  /** Each wheel's offset: the letter at row i is wheels[k][(i - READ + LINE + off[k]) mod size]. */
  off: number[];
  /** The words submitted, oldest first. */
  tries: string[];
  turns: number;
  solved: boolean;
  msg: string;
  /**
   * The last tap to pick, for the board to draw: wheel k glided d tiles (down if positive) and
   * its letter landed on the line; `seq` counts picks, so the board glides once per pick.
   */
  glide?: { k: number; d: number; seq: number } | null;
}

/** turn: a wheel a step down; pick: bring the letter at row i of wheel k to the line; submit. */
export type Move = { t: 'turn'; k: number } | { t: 'pick'; k: number; i: number } | { t: 'submit' };

/** g green (right wheel), a amber (another wheel), x grey: the engine's clue(). */
export type Clue = 'g' | 'a' | 'x';

/** The page's ship gate: a board that breaks these never renders. */
export function validate(data: unknown): { ok: boolean; checks: string[] } {
  const p = data as Partial<TumblerData> | null;
  if (!p || !Array.isArray(p.wheels) || !Array.isArray(p.words) || typeof p.n !== 'number')
    return { ok: false, checks: ['malformed wheels'] };
  const P = typeof p.wheels[0] === 'string' ? p.wheels[0].length : 0;
  if (
    p.wheels.length !== p.n ||
    p.wheels.some(
      (w) =>
        typeof w !== 'string' || w.length !== P || !/^[A-Z]+$/.test(w) || new Set(w).size !== P,
    )
  )
    return { ok: false, checks: ['malformed wheels'] };
  const words = new Set(p.words);
  const errs: string[] = [];
  if (typeof p.secret !== 'string' || p.secret.length !== p.n || !words.has(p.secret))
    errs.push('the hidden word is not in the word list');
  else
    for (let k = 0; k < p.n; k++)
      if (!p.wheels[k]!.includes(p.secret[k]!.toUpperCase()))
        errs.push(`wheel ${k + 1} can't make the hidden word`);
  return { ok: errs.length === 0, checks: errs };
}

export function init(p: TumblerData): TumblerState {
  return {
    p,
    size: p.wheels[0]!.length,
    words: new Set(p.words),
    off: new Array<number>(p.n).fill(0),
    tries: [],
    turns: 0,
    solved: false,
    msg: START_MSG,
  };
}

/** The letter on wheel k at row i. */
export function letter(s: TumblerState, k: number, i: number): string {
  const P = s.size;
  return s.p.wheels[k]![(((i - READ + LINE + s.off[k]!) % P) + P) % P]!;
}

/** The word on the outlined line, lower case. */
export function lineWord(s: TumblerState): string {
  let w = '';
  for (let k = 0; k < s.p.n; k++) w += letter(s, k, READ);
  return w.toLowerCase();
}

/** Wordle-style clues for a guess against the secret. */
export function clue(g: string, secret: string): Clue[] {
  const n = secret.length;
  const res = new Array<Clue>(n).fill('x');
  const left: Record<string, number> = {};
  for (let i = 0; i < n; i++)
    if (g[i] === secret[i]) res[i] = 'g';
    else left[secret[i]!] = (left[secret[i]!] || 0) + 1;
  for (let i = 0; i < n; i++)
    if (res[i] !== 'g' && left[g[i]!]) {
      res[i] = 'a';
      left[g[i]!]!--;
    }
  return res;
}

/**
 * A tile's clue mark from the submits (engines/tumbler.js wheelMarks; Alec, 16 Nov 2026): only
 * what the submits showed, nothing deduced. g: green on its wheel. x: ruled out (a grey letter
 * on every wheel, or a letter tried on this wheel and not green there). n: in the word, tried on
 * this wheel and not here. a: in the word, not yet found, not ruled out here. '' unmarked.
 */
export type Mark = 'g' | 'x' | 'n' | 'a' | '';

export function wheelMarks(s: TumblerState): (k: number, L: string) => Mark {
  const n = s.p.n;
  const green: (string | null)[] = new Array<string | null>(n).fill(null);
  const notAt = Array.from({ length: n }, () => new Set<string>());
  const out = new Set<string>();
  const amber = new Set<string>();
  const found = new Set<string>();
  for (const w of s.tries) {
    const W = w.toUpperCase();
    const c = clue(w, s.p.secret);
    const hit = new Set<string>();
    for (let i = 0; i < n; i++) {
      const L = W[i]!;
      if (c[i] === 'g') {
        green[i] = L;
        found.add(L);
        hit.add(L);
      } else {
        notAt[i]!.add(L);
        if (c[i] === 'a') {
          amber.add(L);
          hit.add(L);
        }
      }
    }
    for (let i = 0; i < n; i++) if (!hit.has(W[i]!)) out.add(W[i]!);
  }
  return (k, L) => {
    const live = amber.has(L) && !found.has(L);
    if (green[k] === L) return 'g';
    if (out.has(L)) return 'x';
    if (notAt[k]!.has(L)) return live ? 'n' : 'x';
    return live ? 'a' : '';
  };
}

/** One move. A solved board takes none, as every control's guard in the engine. */
export function apply(s: TumblerState, m: Move): TumblerState {
  if (s.solved) return s;
  if (m.t === 'turn') {
    if (m.k < 0 || m.k >= s.p.n) return s;
    const off = s.off.slice();
    off[m.k] = (off[m.k]! - 1 + s.size) % s.size;
    return { ...s, off, turns: s.turns + 1, msg: '' };
  }
  if (m.t === 'pick') {
    if (m.k < 0 || m.k >= s.p.n || m.i < 0 || m.i >= s.size || m.i === READ) return s;
    const d = pickSteps(s.size, m.i);
    const off = s.off.slice();
    off[m.k] = (((off[m.k]! - d) % s.size) + s.size) % s.size;
    const seq = (s.glide?.seq ?? 0) + 1;
    return { ...s, off, turns: s.turns + 1, msg: '', glide: { k: m.k, d, seq } };
  }
  const w = lineWord(s);
  if (!s.words.has(w))
    return { ...s, msg: `${w.toUpperCase()} isn’t a word we know, so it doesn’t count.` };
  if (s.tries.includes(w)) return { ...s, msg: `You’ve tried ${w.toUpperCase()} already.` };
  const tries = [...s.tries, w];
  if (w === s.p.secret) return { ...s, tries, solved: true };
  return { ...s, tries, msg: '' };
}

/** A finished board as it reopens: the hidden word on the line, the saved submits. */
export function restoreDone(p: TumblerData, tries: unknown): TumblerState {
  const s = init(p);
  const off = p.wheels.map((w, k) => {
    const i = w.indexOf(p.secret[k]!.toUpperCase());
    return (((i - LINE) % s.size) + s.size) % s.size;
  });
  return {
    ...s,
    off,
    tries: Array.isArray(tries) ? (tries as string[]) : [p.secret],
    solved: true,
  };
}

/**
 * Tap to pick (engines/tumbler.js pick): the tiles a wheel glides to bring row i to the line, the
 * shortest way round (positive: down). At most three on a seven-letter wheel; 4 goes down 3 up.
 */
export function pickSteps(size: number, i: number): number {
  const d = (((READ - i) % size) + size) % size;
  return d > size / 2 ? d - size : d;
}

/** "Tumbler 25" from "DP·TUMB·0025". */
export const tumblerNumber = (id: string) => parseInt(String(id).split('·').pop() ?? '', 10);

/** The engine's fmt: rounded seconds as m:ss. */
export function timerText(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "1 submit", "3 submits". */
export const submitsText = (n: number) => `${n} submit${n === 1 ? '' : 's'}`;

/** What a screen reader says for the outlined line's letter on wheel k. */
export function lineLabel(s: TumblerState, k: number): string {
  return `Line letter ${k + 1}: ${lineWord(s)[k]!.toUpperCase()}`;
}
