/**
 * Tumbler's rules, ported line by line from dailynoodle engines/tumbler.js (Lab, 6 Nov 2026):
 * a hidden word in four wheels of letters. Wheels turn down only and wrap round; the yellow
 * line (row 1) is read and submitted. A real word gets Wordle-style clues; the hidden word
 * solves it. Pure TypeScript with no React or storage; the screen and the differential
 * replay (scripts/replay.js) both play it.
 */
export const SAVE_KEY = 'digi-tumbler-v1';
export const STREAK_KEY = 'digi-tumbler-streak';
/** The page's message before anything is played (its markup). */
export const START_MSG = 'Make a word on the yellow line and submit it for clues.';
export const RESUME_MSG = 'Carrying on where you left off.';
/** The row of each wheel that is read: the yellow line. */
export const READ = 1;

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
  /** Each wheel's offset: the letter at row i is wheels[k][(i + off[k]) mod size]. */
  off: number[];
  /** The words submitted, oldest first. */
  tries: string[];
  turns: number;
  solved: boolean;
  msg: string;
}

export type Move = { t: 'turn'; k: number } | { t: 'submit' };

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
  return s.p.wheels[k]![(((i + s.off[k]!) % P) + P) % P]!;
}

/** The word on the yellow line, lower case. */
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

/** One move. A solved board takes none, as every control's guard in the engine. */
export function apply(s: TumblerState, m: Move): TumblerState {
  if (s.solved) return s;
  if (m.t === 'turn') {
    if (m.k < 0 || m.k >= s.p.n) return s;
    const off = s.off.slice();
    off[m.k] = (off[m.k]! - 1 + s.size) % s.size;
    return { ...s, off, turns: s.turns + 1, msg: '' };
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
    return (((i - READ) % s.size) + s.size) % s.size;
  });
  return {
    ...s,
    off,
    tries: Array.isArray(tries) ? (tries as string[]) : [p.secret],
    solved: true,
  };
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

/** What a screen reader says for the yellow line's letter on wheel k. */
export function lineLabel(s: TumblerState, k: number): string {
  return `Line letter ${k + 1}: ${lineWord(s)[k]!.toUpperCase()}`;
}
