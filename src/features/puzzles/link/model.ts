/**
 * Link, as a pure model: ported line for line from dailynoodle `engines/link.js`
 * (validateLink, toggle, submit and its settle, revealRest, the timer, recordResult,
 * the replay label, start, restoreDone, doneSync, finishSheet's note and dnLink) and
 * from `dn-track.js` (Link's outcome from the result title, mistakes from the spent
 * pips). No React, no storage, no clock: the screen owns the clock and the shuffles.
 *
 * Moves are the controls a phone has: the sixteen tiles, Shuffle, Deselect, Submit,
 * Play on the start card, and "Play again (not recorded)" on a lost result. Enter and
 * Escape (keyboard only) are not ported.
 *
 * The board is dealt by Math.random on the page. The model never shuffles by itself:
 * a deal (and every Shuffle) is passed in as the new order, so the screen deals with
 * `shuffle` below and the differential replay hands the model the page's own orders.
 *
 * A right four "settles" on the page before it becomes a band (THE SETTLE: 80 ms per
 * tile + 300 ms, then a 540 ms flight), during which the board takes no taps and the
 * clock runs on; with reduced motion it lands at once. `submit` leaves the state
 * settling and `land` commits it, so the screen (and the replay) decide when.
 */

export interface LinkGroup {
  rank: number;
  name: string;
  members: string[];
}

/** The page's `window.DN_PUZZLE` for a Link. */
export interface LinkData {
  type: 'link';
  id: string;
  band: string;
  groups: LinkGroup[];
  traps?: { tile: string; not: string }[];
}

export interface LinkPuzzle {
  id: string;
  band: string;
  groups: LinkGroup[];
  /** Upper-cased tile → index of its group in `groups`. */
  byName: Record<string, number>;
}

/** The message's class: plain, a wrong guess, or the waiting hint (link.css .msg.wait). */
export type Tone = '' | 'bad' | 'wait';
export type Timer = 'idle' | 'running' | 'stopped';

export interface LinkState {
  p: LinkPuzzle;
  /** The tiles still on the board, in board order (upper case). */
  live: string[];
  /** The held tiles (a set; the board shows them in board order). */
  sel: string[];
  /** Solved groups by index into p.groups, in the order found. */
  solved: number[];
  mistakes: number;
  over: boolean;
  won: boolean;
  /** One entry per counted guess: the four tiles' ranks in board order. */
  guesses: number[][];
  /** Guesses already made (sorted tiles joined by "|"): a repeat costs nothing. */
  tried: string[];
  msg: { text: string; tone: Tone };
  /** A right four is settling (the page's `busy`), with the tiles it turned. */
  settling: { group: number; tiles: string[] } | null;
  /** Four mistakes: the remaining groups are revealed, then the finish. */
  revealing: boolean;
  timer: Timer;
  /** Today's result is still to come (no streak entry for today yet). */
  ranked: boolean;
  /** The finish was ranked (read by the sheet's "· replay"). */
  endRanked: boolean;
  replayStarted: boolean;
  /** The puzzle has a saved result (doneGet), so "Share result" replaces the controls. */
  hasRecord: boolean;
  /** Opened finished from its save. */
  restored: boolean;
  /** "· replay" shows by the band (set when the page loads and on Play again). */
  label: boolean;
}

export type Move =
  | { t: 'play' }
  | { t: 'tile'; w: string }
  | { t: 'submit' }
  | { t: 'deselect' }
  /** `order` is the board after the shuffle (the screen draws it with `shuffle`). */
  | { t: 'shuffle'; order: string[] }
  /** "Play again (not recorded)" after a loss; `order` is the new deal. */
  | { t: 'again'; order: string[] }
  /** The settle has landed (or reduced motion: at once). */
  | { t: 'land' }
  /** The remaining groups have been laid out after a loss. */
  | { t: 'revealed' };

/** The record the web writes to `digi-link-v1` › done[id] (before putDone adds `d`). */
export interface LinkRecord {
  o: 'win' | 'loss';
  t: string;
  m: number;
  r: number[];
  g: number[][];
}

export const SAVE_KEY = 'digi-link-v1';
export const STREAK_KEY = 'digi-link-streak';
/** The site's tracker names Link by its page slug. */
export const SITE_TYPE = 'word-link';
export const MAX_MISTAKES = 4;
/** THE SETTLE: 80 ms × 3 + 300 ms to colour the four, then the 540 ms flight. */
export const SETTLE_MS = 80 * 3 + 300 + 540;
/** After the fourth mistake the rest are laid out one group every 420 ms. */
export const REVEAL_STEP_MS = 420;
export const REPLAY_NOTE =
  "Today's result is already in — this is a replay, and nothing is recorded.";
export const OUT_NOTE = "Out of mistakes — here's the rest";
/** The board's note, in place of REPLAY_NOTE, for a past Link's first go when it won't count. */
export const PAST_NOTE = "A past puzzle — this one won't change your streak.";
/** Under the board until the clock starts (engines/link.js WAIT_HINT, AF-028). */
export const WAIT_HINT = 'Starts when you tap a word';

// ---- the ship gate (engines/link.js validateLink, verbatim lists) ----

const BLOCKED = [
  'anal', 'anus', 'arse', 'bastard', 'bitch', 'boob', 'bugger', 'bollock', 'clit', 'cock', 'crap',
  'cunt', 'dick', 'dyke', 'fag', 'fuck', 'hooker', 'incest', 'jizz', 'kike', 'nazi', 'nigg', 'paki',
  'penis', 'piss', 'poop', 'porn', 'prick', 'pube', 'pussy', 'queer', 'rape', 'retard', 'screw',
  'shit', 'slag', 'slut', 'spunk', 'turd', 'twat', 'vagina', 'wank', 'whore',
]; // prettier-ignore
const SENSITIVE = [
  'ass', 'bra', 'coke', 'crack', 'damn', 'hell', 'kill', 'nude', 'sex', 'shag', 'tit', 'wee', 'willy',
]; // prettier-ignore

export interface Validation {
  ok: boolean;
  checks: Record<string, boolean>;
}

const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

type RawGroup = { rank?: unknown; name?: unknown; members?: unknown };

/** The engine's own load-time gate, plus an id the save and share line can use. */
export function validate(data: unknown): Validation {
  const P = object(data) ? data : {};
  const c: Record<string, boolean> = {};
  const gs: RawGroup[] = Array.isArray(P.groups) ? (P.groups as RawGroup[]) : [];
  const mem = (g: RawGroup): unknown[] => (Array.isArray(g.members) ? g.members : []);
  c.is_link = P.type === 'link';
  c.has_id = typeof P.id === 'string' && /^DP·LINK·\d+$/.test(P.id);
  c.four_groups = gs.length === 4;
  c.four_per_group = gs.every((g) => Array.isArray(g.members) && g.members.length === 4);
  const tiles = gs.flatMap(mem).map((t) => String(t).trim().toUpperCase());
  c.sixteen_tiles = tiles.length === 16;
  c.no_duplicate_tiles = new Set(tiles).size === 16;
  c.tiles_render = tiles.every(
    (t) => t.length >= 1 && t.length <= 10 && /^[A-Z][A-Z '-]*$/.test(t),
  );
  c.ranks_are_1_to_4 = JSON.stringify(gs.map((g) => g.rank).sort()) === '[1,2,3,4]';
  c.names_distinct = new Set(gs.map((g) => String(g.name || '').toLowerCase())).size === 4;
  c.no_giveaway = gs.every((g) =>
    mem(g).every(
      (m) =>
        !String(g.name || '')
          .toLowerCase()
          .includes(String(m).toLowerCase()),
    ),
  );
  const clean = (s: unknown) => {
    const x = String(s).toLowerCase();
    if (BLOCKED.includes(x) || SENSITIVE.includes(x)) return false;
    return !BLOCKED.some((b) => x.includes(b));
  };
  c.family_friendly = tiles.every(clean) && gs.every((g) => clean(g.name));
  const byGroupOf = (tile: string) =>
    gs.find((g) => mem(g).some((m) => String(m).toUpperCase() === tile));
  const traps = Array.isArray(P.traps) ? (P.traps as { tile?: unknown; not?: unknown }[]) : [];
  c.traps_resolve = traps.every((t) => {
    const tile = String(t.tile).toUpperCase();
    const home = byGroupOf(tile);
    return (
      tiles.includes(tile) && !!home && home.name !== t.not && gs.some((g) => g.name === t.not)
    );
  });
  // The page reads members with m.toUpperCase(), so they must be strings.
  c.members_are_text = gs.every((g) => mem(g).every((m) => typeof m === 'string'));
  return { ok: Object.values(c).every(Boolean), checks: c };
}

// ---- state ----

export function puzzleOf(data: LinkData): LinkPuzzle {
  const byName: Record<string, number> = {};
  data.groups.forEach((g, i) => g.members.forEach((m) => (byName[m.toUpperCase()] = i)));
  return { id: data.id, band: data.band, groups: data.groups, byName };
}

/** Every tile in source order, upper case: what `start` shuffles. */
export const allTiles = (data: LinkData) =>
  data.groups.flatMap((g) => g.members.map((m) => m.toUpperCase()));

/** The engine's shuffle (Fisher–Yates, in place). */
export function shuffle<T>(a: T[], random: () => number = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const comboKey = (ws: readonly string[]) =>
  [...ws]
    .map((w) => w.toUpperCase())
    .sort()
    .join('|');

const rankOf = (p: LinkPuzzle, w: string) => p.groups[p.byName[w]!]!.rank;

/** A fresh board (the engine's `start`), dealt in `order`. */
function started(s: LinkState, order: string[]): LinkState {
  return {
    ...s,
    live: order.slice(),
    sel: [],
    solved: [],
    mistakes: 0,
    over: false,
    won: false,
    guesses: [],
    tried: [],
    settling: null,
    revealing: false,
    // The clock waits at 0:00 with a hint until play starts (AF-028); a replay starts at once.
    msg: s.replayStarted ? { text: '', tone: '' } : { text: WAIT_HINT, tone: 'wait' },
    timer: s.replayStarted ? 'running' : 'idle',
  };
}

export interface Opening {
  /** Whether today's streak entry is still to come (`initRanked`). */
  ranked: boolean;
  /** The saved result, if the puzzle was finished before. */
  rec: Record<string, unknown> | null;
}

/** The page as it loads: dealt, ranked or not, and restored if finished (`initRanked`). */
export function init(data: LinkData, deal: string[], opening: Opening): LinkState {
  const p = puzzleOf(data);
  let s: LinkState = started(
    {
      p,
      live: [],
      sel: [],
      solved: [],
      mistakes: 0,
      over: false,
      won: false,
      guesses: [],
      tried: [],
      msg: { text: '', tone: '' },
      settling: null,
      revealing: false,
      timer: 'idle',
      ranked: opening.ranked,
      endRanked: true,
      replayStarted: false,
      hasRecord: !!opening.rec,
      restored: false,
      label: false,
    },
    deal,
  );
  s.label = rankLabel(s);
  if (s.label) s.msg = { text: REPLAY_NOTE, tone: '' };
  if (opening.rec) s = restore(s, opening.rec) ?? s;
  return s;
}

const GLYPH_OK = (v: unknown) => v === 1 || v === 2 || v === 3 || v === 4;

/** A saved record's time, as the page accepts it ("00:00" otherwise). */
export function recordTime(rec: Record<string, unknown>): string {
  return /^\d{1,4}:\d{2}$/.test(String(rec.t)) ? String(rec.t) : '00:00';
}

/** A finished Link reopened from its save (`restoreDone`); null when the page wouldn't. */
function restore(s: LinkState, rec: Record<string, unknown>): LinkState | null {
  if (!/^(win|loss)$/.test(String(rec.o)) || !Array.isArray(rec.r)) return null;
  const order = (rec.r as unknown[]).map((k) => s.p.groups.findIndex((g) => g.rank === k));
  if (
    order.length !== s.p.groups.length ||
    order.some((i) => i < 0) ||
    new Set(order).size !== order.length
  )
    return null;
  const t = recordTime(rec);
  const mistakes = Math.max(0, Math.min(MAX_MISTAKES, Math.floor(+(rec.m as number)) || 0));
  const won = rec.o === 'win';
  const guesses = Array.isArray(rec.g)
    ? (rec.g as unknown[]).filter(
        (x): x is number[] => Array.isArray(x) && x.every((v) => GLYPH_OK(v)),
      )
    : [];
  return {
    ...s,
    solved: order,
    live: [],
    sel: [],
    settling: null,
    mistakes,
    guesses,
    over: true,
    won,
    timer: 'stopped',
    restored: true,
    msg: {
      text: won
        ? `Linked in ${t}${mistakes ? ` · ${mistakes} mistake${mistakes > 1 ? 's' : ''}` : ' · perfect'}`
        : OUT_NOTE,
      tone: '',
    },
  };
}

/** "· replay" by the band: a second go at today's Link (never the first result or a reopen). */
export function rankLabel(s: LinkState): boolean {
  return !s.ranked && (s.replayStarted || !s.hasRecord);
}

// ---- what the board shows (display only) ----
//
// The page says "Today's result is already in — this is a replay" on any Link opened once
// today's streak entry is in, and marks it "· replay". For a past puzzle never finished
// before, that is wrong on both counts: it is a first go, and today's result is not what
// stops it counting. These two only reword the board; the state (`msg`, `label`) stays as
// the page has it, so the differential replay still proves it, and nothing recorded changes.

/** "· replay" by the band, as shown: not on a past puzzle's first go. */
export function shownLabel(s: LinkState, past: boolean): boolean {
  return s.label && !(past && !s.replayStarted);
}

/** The message line, as shown: a past puzzle that won't count says so instead of REPLAY_NOTE. */
export function shownMsg(s: LinkState, past: boolean): { text: string; tone: Tone } {
  return past && s.msg.text === REPLAY_NOTE ? { text: PAST_NOTE, tone: '' } : s.msg;
}

/** Apply one move; returns a new state (the old one is never changed). */
export function apply(prev: LinkState, move: Move): LinkState {
  const s: LinkState = { ...prev, sel: prev.sel.slice(), msg: { ...prev.msg } };
  const busy = !!s.settling;
  const startTimer = () => {
    if (s.over || s.timer === 'running') return;
    s.timer = 'running';
    if (s.msg.tone === 'wait') s.msg = { text: '', tone: '' };
  };
  switch (move.t) {
    case 'play':
      startTimer();
      return s;
    case 'tile': {
      if (s.over || busy || !s.live.includes(move.w)) return prev;
      startTimer();
      if (s.sel.includes(move.w)) s.sel = s.sel.filter((w) => w !== move.w);
      else {
        if (s.sel.length >= 4) {
          s.msg = { text: 'Four at a time', tone: '' };
          return s;
        }
        s.sel.push(move.w);
      }
      s.msg = { text: '', tone: '' };
      return s;
    }
    case 'deselect':
      if (s.over || busy || !s.sel.length) return prev;
      s.sel = [];
      s.msg = { text: '', tone: '' };
      return s;
    case 'shuffle':
      if (s.over || busy) return prev;
      s.live = move.order.slice();
      return s;
    case 'submit': {
      if (s.over || busy || s.sel.length !== 4) return prev;
      // Board order, not tap order.
      const picked = s.live.filter((w) => s.sel.includes(w));
      const key = comboKey(picked);
      if (s.tried.includes(key)) {
        s.msg = { text: 'Already tried that one', tone: '' };
        return s;
      }
      s.tried = [...s.tried, key];
      s.guesses = [...s.guesses, picked.map((w) => rankOf(s.p, w))];
      const counts = new Map<number, number>();
      for (const w of picked) counts.set(s.p.byName[w]!, (counts.get(s.p.byName[w]!) || 0) + 1);
      const best = Math.max(...counts.values());
      if (best === 4) {
        s.settling = { group: [...counts.keys()][0]!, tiles: picked };
        return s;
      }
      s.msg = { text: best === 3 ? 'One away' : 'Not a group', tone: 'bad' };
      s.mistakes++;
      if (s.mistakes >= MAX_MISTAKES) {
        s.over = true;
        s.timer = 'stopped';
        s.revealing = true;
      }
      return s;
    }
    case 'land': {
      if (!s.settling) return prev;
      const g = s.settling.group;
      s.solved = [...s.solved, g];
      s.live = s.live.filter((w) => !s.sel.includes(w));
      s.sel = [];
      s.settling = null;
      s.msg = { text: '', tone: '' };
      if (s.solved.length === 4) {
        s.won = true;
        s.over = true;
        s.timer = 'stopped';
      }
      return s;
    }
    case 'revealed': {
      if (!s.revealing) return prev;
      s.sel = [];
      const rest = s.p.groups
        .map((g, i) => ({ g, i }))
        .filter(({ i }) => !s.solved.includes(i))
        .sort((a, b) => a.g.rank - b.g.rank);
      s.solved = [...s.solved, ...rest.map(({ i }) => i)];
      s.live = [];
      s.revealing = false;
      s.msg = { text: OUT_NOTE, tone: '' };
      return s;
    }
    case 'again': {
      if (!s.over || s.won || s.revealing) return prev;
      const r = started({ ...s, replayStarted: true }, move.order);
      r.label = rankLabel(r);
      return r;
    }
  }
}

/** The state once a finish is saved: a result exists, and ranked as `commitFinish` left it. */
export function afterFinish(s: LinkState, f: { ranked: boolean; stillRanked: boolean }): LinkState {
  return { ...s, hasRecord: true, endRanked: f.ranked, ranked: f.stillRanked };
}

/** Whether a move is a submit that will settle (a right four), from the state before it. */
export function settles(s: LinkState, move: Move): boolean {
  return apply(s, move).settling !== null && !s.settling;
}

/** The finish happens once the board is over and nothing is still moving. */
export const finishing = (s: LinkState) => s.over && !s.settling && !s.revealing;

/** The controls' disabled states, as `render` sets them. */
export function disabled(s: LinkState) {
  const busy = !!s.settling;
  return {
    submit: s.over || busy || s.sel.length !== 4,
    clear: s.over || busy || s.sel.length === 0,
    shuffle: s.over || busy,
  };
}

/** doneSync: while the board is over and a result is saved, "Share result" replaces the three. */
export const showsShare = (s: LinkState) => s.over && s.hasRecord;

// ---- the finish ----

/** The page's clock text, "MM:SS". */
export function timerText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** The record `finish` saves; `timer` is the clock as shown. */
export function record(s: LinkState, timer: string): LinkRecord {
  return {
    o: s.won ? 'win' : 'loss',
    t: timer,
    m: s.mistakes,
    r: s.solved.map((i) => s.p.groups[i]!.rank),
    g: s.guesses,
  };
}

/** "1:05" from "01:05" (the engines' dnTime). */
const dnTime = (t: string) =>
  String(t || '')
    .trim()
    .replace(/^0+(\d)/, '$1');

/** dn-track.js's mmss: a shown time back to seconds. */
export function shownSeconds(t: string): number | null {
  const m = /(\d+):(\d{2})(?::(\d{2}))?/.exec(String(t || ''));
  if (!m) return null;
  return m[3] ? +m[1]! * 3600 + +m[2]! * 60 + +m[3] : +m[1]! * 60 + +m[2]!;
}

/** The `dn:puzzle_end` detail the tracker sends when the result box first opens. */
export function endDetail(s: LinkState, timer: string): Record<string, unknown> {
  return {
    type: SITE_TYPE,
    tv: 3,
    outcome: s.won ? 'solved' : 'failed', // "So close." is one of the tracker's loss titles
    secs: shownSeconds(dnTime(timer)),
    checks: 0,
    reveals: 0,
    hints: 0,
    mistakes: s.mistakes,
  };
}

/** The sheet's title. */
export const titleOf = (won: boolean) => (won ? 'Linked' : 'So close.');

const right = (x: number[]) => x.every((v) => v === x[0]);

/** The guesses the sheet draws, one square each: a rank (1–4) or 0 for a miss. */
export function guessSquares(guesses: unknown[]): number[] {
  return guesses
    .filter((x): x is number[] => Array.isArray(x) && x.length === 4)
    .map((x) => (right(x) ? x[0]! : 0));
}

/** The sheet's one line (finishSheet's note). */
export function finishNote(p: LinkPuzzle, guesses: unknown[], win: boolean): string {
  const gs = guesses.filter((x): x is number[] => Array.isArray(x) && x.length === 4);
  const wrong = gs.filter((x) => !right(x));
  const found = gs.filter(right).length;
  const count: Record<string, number> = {};
  wrong.forEach((x) => x.forEach((r) => (count[r] = (count[r] || 0) + 1)));
  // Object.keys of integer-like keys come out ascending, as in the page.
  const worst = Object.keys(count).sort((a, b) => count[b]! - count[a]!)[0];
  const caught = worst ? ` ${p.groups.find((g) => g.rank === +worst)!.name} caught you out.` : '';
  const nm = wrong.length;
  const m = nm === 1 ? 'one mistake' : `${nm} mistakes`;
  return win
    ? nm
      ? `All four groups with ${m}.${caught}`
      : 'All four groups, no mistakes.'
    : `You found ${found === 1 ? 'one group' : `${['no', 'one', 'two', 'three'][found]} groups`} of four.${caught}`;
}

/** The recap: every group, easiest to hardest. */
export const groupsByRank = (p: LinkPuzzle) => p.groups.slice().sort((a, b) => a.rank - b.rank);

// ---- the unfinished round (engines/link.js curSave / curRead / curRestore, AF-029) ----

/**
 * The round kept in `digi-link-v1` beside `done`, exactly as the website writes it:
 * ranks found in order, mistakes, guesses (ranks), guesses already tried, the board's
 * remaining order, seconds played, and when it was saved (ms). The site's sync keeps the
 * one with the newer `at`.
 */
export interface LinkRound {
  id: string;
  f: number[];
  m: number;
  g: number[][];
  tr: string[];
  l: string[];
  s: number;
  at: number;
}

/** The round to keep now (curSave), or null when there is none to keep. */
export function roundToKeep(
  s: LinkState,
  secs: number,
  at: number,
  dirty: boolean,
): LinkRound | null {
  if (s.over || s.replayStarted || s.hasRecord) return null;
  if (!dirty && !secs) return null;
  return {
    id: s.p.id,
    f: s.solved.map((i) => s.p.groups[i]!.rank),
    m: s.mistakes,
    g: s.guesses.map((x) => x.slice()),
    tr: s.tried.slice(),
    l: s.live.slice(),
    s: secs,
    at,
  };
}

/**
 * curWrite: put `c` (or null to clear) into the save document `raw` read-modify-write,
 * leaving `done` and everything else as it is. Returns the text to store, or null to
 * leave storage alone: a save it can't read is never overwritten, and clearing a round
 * that isn't there writes nothing.
 */
export function withRound(raw: string | null, c: LinkRound | null): string | null {
  let s: unknown = null;
  try {
    s = JSON.parse(raw || 'null');
  } catch {
    s = null;
  }
  let doc: Record<string, unknown>;
  if (!object(s) || s.v !== 1) {
    if (raw) return null;
    doc = { v: 1 };
  } else doc = s;
  if (!c && !doc.cur) return null;
  doc.cur = c;
  return JSON.stringify(doc);
}

/** curRead: this puzzle's kept round from the save `raw`, checked, or null. */
export function readRound(
  p: LinkPuzzle,
  raw: string | null,
): {
  found: number[];
  m: number;
  s: number;
  g: number[][];
  tr: string[];
  l: string[] | null;
} | null {
  let doc: unknown = null;
  try {
    doc = JSON.parse(raw || 'null');
  } catch {
    return null;
  }
  const c = object(doc) ? doc.cur : null;
  if (!object(c) || c.id !== p.id) return null;
  if (object(doc) && object(doc.done) && doc.done[p.id]) return null;
  if (!Array.isArray(c.f) || c.f.length >= 4 || new Set(c.f).size !== c.f.length) return null;
  const found = (c.f as unknown[]).map((k) => p.groups.findIndex((g) => g.rank === k));
  if (found.some((i) => i < 0)) return null;
  const m = Math.floor(+(c.m as number));
  if (!(m >= 0 && m < MAX_MISTAKES)) return null;
  const secs = Math.floor(+(c.s as number));
  if (!(secs >= 0 && secs <= 359999)) return null;
  const g = Array.isArray(c.g)
    ? (c.g as unknown[]).filter(
        (x): x is number[] => Array.isArray(x) && x.length === 4 && x.every((v) => GLYPH_OK(v)),
      )
    : [];
  // A right guess saved while its group was still flying into place counts as found.
  for (const x of g)
    if (x.every((v) => v === x[0])) {
      const i = p.groups.findIndex((q) => q.rank === x[0]);
      if (i >= 0 && !found.includes(i)) found.push(i);
    }
  if (found.length >= 4) return null;
  const tr = Array.isArray(c.tr) ? (c.tr as unknown[]).filter((x) => typeof x === 'string') : [];
  return {
    found,
    m,
    s: secs,
    g,
    tr: tr as string[],
    l: Array.isArray(c.l) ? (c.l as string[]) : null,
  };
}

/** "Paused at 1:05 · tap a word to carry on" (curRestore's message). */
export const pausedNote = (secs: number) =>
  `Paused at ${dnTime(timerText(secs))} · tap a word to carry on`;

/**
 * curRestore: the board with the kept round put back, nothing selected, paused (the
 * clock still, its time `r.s`), or null. `deal` shuffles the remaining tiles when the
 * kept order no longer matches them.
 */
export function resumeRound(
  s: LinkState,
  raw: string | null,
  deal: (tiles: string[]) => string[],
): { state: LinkState; secs: number } | null {
  if (s.hasRecord) return null;
  const r = readRound(s.p, raw);
  if (!r) return null;
  const rest = s.p.groups
    .filter((_, i) => !r.found.includes(i))
    .flatMap((g) => g.members.map((m) => m.toUpperCase()));
  const same =
    !!r.l &&
    r.l.length === rest.length &&
    r.l.every((w) => rest.includes(w)) &&
    new Set(r.l).size === rest.length;
  return {
    state: {
      ...s,
      solved: r.found,
      mistakes: r.m,
      guesses: r.g,
      tried: r.tr,
      sel: [],
      live: same ? r.l!.slice() : deal(rest),
      timer: 'idle',
      msg: { text: pausedNote(r.s), tone: 'wait' },
    },
    secs: r.s,
  };
}
