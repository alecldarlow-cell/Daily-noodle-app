/**
 * Cryptic's rules, ported line by line from dailynoodle engines/cryptic.js (Lab, from 21 Nov
 * 2026; brief: project doc claude/brief-cryptic.md). One hand-written cryptic clue a day: type
 * the answer and check it with Enter. A wrong answer shakes the squares and costs nothing;
 * squares never turn green letter by letter. Hint ladder: 1 underlines the definition, 2 names
 * the clue type, 3 and on reveal a letter each, left to right. The clock is the score, with the
 * hints used beside it. No fail state: revealing every letter finishes the clue.
 * Pure TypeScript with no React or storage.
 */
export const SAVE_KEY = 'digi-cryptic-v1';
export const STREAK_KEY = 'digi-cryptic-streak';
export const RESUME_MSG = 'Carrying on where you left off.';

/** The clue types and their names (engines/cryptic.js TYPE_NAME). */
export const TYPE_NAME: Record<string, string> = {
  anagram: 'Anagram',
  hidden: 'Hidden word',
  charade: 'Charade',
  sounds: 'Sounds like',
  reversal: 'Reversal',
  container: 'Container',
  double: 'Double definition',
  deletion: 'Deletion',
  acrostic: 'First letters',
  alternate: 'Alternate letters',
};

/** A page's data, as reports/<page>.json carries it (`sol` still wrapped). */
export interface CrypticData {
  type: 'cryptic';
  id: string;
  band: string;
  n: number;
  clue: string;
  enum: string;
  kind: string;
  /** The definition's word span [from, to). */
  def: [number, number];
  /** The signpost's word span, or null (charade, double definition). */
  ind: [number, number] | null;
  /** The answer and its working, wrapped (tools/cryptic.js wrap). */
  sol: string;
}

/** The unwrapped answer and its working. */
export interface Solution {
  a: string;
  parse?: string;
  explain: [string, string];
  /** Character ranges of the wordplay's letters, for the recap. */
  mark?: [number, number][];
  /** A double definition's second definition, as a character range. */
  sec?: [number, number] | null;
}

export interface CrypticState {
  p: CrypticData;
  sol: Solution;
  /** The answer's letters, typed or revealed; '' for an empty square. */
  letters: string[];
  /** The current square. */
  cur: number;
  hints: number;
  solved: boolean;
  /** Wrong full answers checked: each shakes the squares (the screen watches it). */
  wrong: number;
  /** A one-off message; '' brings back the help line for where the player is. */
  msg: string;
}

export type Move =
  | { t: 'type'; ch: string }
  | { t: 'del' }
  | { t: 'clear' }
  | { t: 'enter' }
  | { t: 'hint' }
  | { t: 'select'; i: number };

// ---- the wrapped answer: base64, then XOR with the id's UTF-8 bytes ----

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function fromBase64(s: string): number[] {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('bad base64');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return out;
}

function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function fromUtf8(b: number[]): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const x = b[i]!;
    let c: number;
    if (x < 0x80) {
      c = x;
      i += 1;
    } else if (x < 0xe0) {
      c = ((x & 31) << 6) | (b[i + 1]! & 63);
      i += 2;
    } else if (x < 0xf0) {
      c = ((x & 15) << 12) | ((b[i + 1]! & 63) << 6) | (b[i + 2]! & 63);
      i += 3;
    } else {
      c = ((x & 7) << 18) | ((b[i + 1]! & 63) << 12) | ((b[i + 2]! & 63) << 6) | (b[i + 3]! & 63);
      i += 4;
    }
    s += String.fromCodePoint(c);
  }
  return s;
}

/** The answer and its working, from the page's `sol`. Throws if it can't be read. */
export function unwrap(sol: string, id: string): Solution {
  const key = utf8(String(id));
  const data = fromBase64(String(sol)).map((x, i) => x ^ key[i % key.length]!);
  return JSON.parse(fromUtf8(data)) as Solution;
}

/** The clue's words, punctuation ignored, as character ranges (tools/cryptic.js words()). */
function words(clue: string): { at: number; end: number }[] {
  const out: { at: number; end: number }[] = [];
  const re = /[A-Za-z’']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clue))) out.push({ at: m.index, end: m.index + m[0].length });
  return out;
}

/** A word span as a character range. */
export function spanChars(clue: string, sp: [number, number] | null): [number, number] | null {
  if (!sp) return null;
  const W = words(clue);
  const a = W[sp[0]];
  const b = W[sp[1] - 1];
  return a && b ? [a.at, b.end] : null;
}

/** The squares' word breaks: "3,4" → [3, 4]. */
export const groups = (en: string) =>
  String(en)
    .split(/[,-]/)
    .map((x) => +x || 0);

/** The page's ship gate: a clue that breaks these never renders. */
export function validate(data: unknown): { ok: boolean; checks: string[] } {
  const p = data as Partial<CrypticData> | null;
  if (!p || p.type !== 'cryptic' || typeof p.clue !== 'string' || !p.clue)
    return { ok: false, checks: ['malformed clue'] };
  let s: Solution;
  try {
    s = unwrap(String(p.sol), String(p.id));
  } catch {
    return { ok: false, checks: ["the answer data can't be read"] };
  }
  const errs: string[] = [];
  const A = String(s.a || '');
  const n = words(p.clue).length;
  if (!/^[A-Z]{4,8}$/.test(A) || A.length !== p.n) errs.push("the answer doesn't fit its squares");
  if (groups(String(p.enum)).reduce((t, x) => t + x, 0) !== A.length)
    errs.push("the enumeration doesn't match the answer");
  const d = p.def;
  if (!Array.isArray(d) || !(d[1] > d[0]) || d[1] > n || (d[0] !== 0 && d[1] !== n))
    errs.push("the definition isn't at one end");
  if (!TYPE_NAME[String(p.kind)]) errs.push('unknown clue type');
  if (!Array.isArray(s.explain) || s.explain.length !== 2) errs.push('no explanation');
  return { ok: errs.length === 0, checks: errs };
}

/** Letters revealed by hints: hint 3 and on reveal one each, left to right. */
export const revealed = (s: Pick<CrypticState, 'hints' | 'p'>) =>
  Math.max(0, Math.min(s.p.n, s.hints - 2));
export const locked = (s: Pick<CrypticState, 'hints' | 'p'>, i: number) => i < revealed(s);

export function firstOpen(s: Pick<CrypticState, 'hints' | 'p'>, from: number): number {
  const N = s.p.n;
  for (let i = from; i < N; i++) if (!locked(s, i)) return i;
  for (let i = 0; i < N; i++) if (!locked(s, i)) return i;
  return N - 1;
}

export function init(data: CrypticData): CrypticState {
  return {
    p: data,
    sol: unwrap(data.sol, data.id),
    letters: new Array<string>(data.n).fill(''),
    cur: 0,
    hints: 0,
    solved: false,
    wrong: 0,
    msg: '',
  };
}

export const hintsText = (h: number) => (h === 0 ? 'no hints' : `${h} hint${h === 1 ? '' : 's'}`);

/** The help line under the buttons: never blank (engines/cryptic.js idleLine). */
export function idleLine(s: CrypticState): string {
  if (s.hints === 0)
    return 'Type your answer, then press Enter. A hint underlines the definition first.';
  if (s.hints === 1)
    return 'The underlined words are the definition. The rest of the clue is wordplay.';
  return revealed(s)
    ? 'Reveal another letter if you need one: each counts as a hint.'
    : 'Still stuck? Reveal a letter: it counts as a hint.';
}

/** What the help line shows now. */
export const message = (s: CrypticState) => s.msg || idleLine(s);

/** The hint tip once the clue type is named (engines/cryptic.js tip()). */
export function tip(p: CrypticData): string {
  const r = spanChars(p.clue, p.ind);
  const ind = r ? `“${p.clue.slice(r[0], r[1])}”` : '';
  const T: Record<string, string> = {
    anagram: `${ind} signals an anagram: the letters of a word beside it are jumbled to make the answer.`,
    hidden: `The answer is written inside the clue, running straight through the words after ${ind}.`,
    charade:
      'A charade: the answer is built from short pieces, each clued by a word or two, put side by side.',
    sounds: `${ind} signals a sound-alike: the answer sounds like a word for the part beside it.`,
    reversal: `${ind} signals a reversal: a word in the clue, read backwards.`,
    container: `${ind} signals a container: one piece goes around another.`,
    double: 'A double definition: the clue gives two meanings of the same word, side by side.',
    deletion: `${ind} signals a deletion: a word loses a letter from its start, its end or its middle.`,
    acrostic: `${ind} signals first letters: take the first letter of each word beside it.`,
    alternate: `${ind} signals alternate letters: take every other letter of the words beside it.`,
  };
  return T[p.kind] ?? '';
}

/** Apply one move: the engine's type, del, clearAll, enter, hint and a square's tap. */
export function apply(s: CrypticState, m: Move): CrypticState {
  if (s.solved) return s;
  const N = s.p.n;
  const A = s.sol.a;
  switch (m.t) {
    case 'select':
      if (m.i < 0 || m.i >= N || locked(s, m.i)) return s;
      return { ...s, cur: m.i };
    case 'type': {
      if (!/^[A-Z]$/.test(m.ch)) return s;
      const letters = s.letters.slice();
      let cur = locked(s, s.cur) ? firstOpen(s, s.cur) : s.cur;
      letters[cur] = m.ch;
      let j = cur + 1;
      while (j < N && locked(s, j)) j++;
      if (j < N) cur = j;
      return { ...s, letters, cur, msg: '' };
    }
    case 'del': {
      const letters = s.letters.slice();
      let cur = s.cur;
      if (letters[cur] && !locked(s, cur)) letters[cur] = '';
      else {
        let j = cur - 1;
        while (j >= 0 && locked(s, j)) j--;
        if (j >= 0) {
          cur = j;
          letters[j] = '';
        }
      }
      return { ...s, letters, cur, msg: '' };
    }
    case 'clear': {
      const letters = s.letters.map((x, i) => (locked(s, i) ? x : ''));
      return { ...s, letters, cur: firstOpen(s, 0), msg: '' };
    }
    case 'enter': {
      if (s.letters.some((x) => !x)) return { ...s, msg: 'Fill every square, then press Enter.' };
      if (s.letters.join('') === A) return { ...s, solved: true, letters: A.split(''), msg: '' };
      return { ...s, wrong: s.wrong + 1, msg: 'Not quite. Nothing lost: try again.' };
    }
    case 'hint': {
      if (revealed(s) >= N) return s;
      const hints = s.hints + 1;
      const next: CrypticState = { ...s, hints, msg: '' };
      if (hints === 1) next.msg = 'The definition is highlighted. The rest is the wordplay.';
      else if (hints > 2) {
        const i = revealed(next) - 1;
        const letters = s.letters.slice();
        letters[i] = A[i]!;
        next.letters = letters;
        if (s.cur <= i) next.cur = firstOpen(next, i + 1);
      }
      // every letter shown: no fail state, the clue is done
      if (revealed(next) >= N) return { ...next, solved: true, letters: A.split(''), msg: '' };
      return next;
    }
  }
}

/** A finished clue reopened: the answer in the squares, the hints it took. */
export function restoreDone(data: CrypticData, hints: number): CrypticState {
  const s = init(data);
  return { ...s, solved: true, hints, letters: s.sol.a.split('') };
}

/** The clock's text: "1:07". */
export const timerText = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The player's number for an id: "DP·CRYP·0003" → 3. */
export const crypticNumber = (id: string) => parseInt(String(id).split('·').pop() ?? '', 10) || 0;

/** A run of the clue's text and how it is marked: d definition, i signpost, m wordplay letters. */
export interface ClueRun {
  text: string;
  d: boolean;
  i: boolean;
  m: boolean;
}

/** The clue cut into runs by their marks (engines/cryptic.js clueHtml). */
export function clueRuns(
  text: string,
  opts: {
    def?: [number, number] | null;
    sec?: [number, number] | null;
    ind?: [number, number] | null;
    mark?: [number, number][];
  },
): ClueRun[] {
  const cls = Array.from({ length: text.length }, () => ({ d: false, i: false, m: false }));
  const add = (r: [number, number] | null | undefined, k: 'd' | 'i' | 'm') => {
    if (r) for (let x = r[0]; x < r[1] && x < text.length; x++) cls[x]![k] = true;
  };
  add(opts.def, 'd');
  add(opts.sec, 'd');
  add(opts.ind, 'i');
  for (const r of opts.mark ?? []) add(r, 'm');
  const out: ClueRun[] = [];
  for (let x = 0; x < text.length; x++) {
    const c = cls[x]!;
    const last = out[out.length - 1];
    if (last && last.d === c.d && last.i === c.i && last.m === c.m) last.text += text[x];
    else out.push({ text: text[x]!, ...c });
  }
  return out;
}
