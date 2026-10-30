/**
 * Leagues' local rules, ported line for line from dailynoodle `dn-board.js`: the saved
 * state (`noodle-board-v1`), the board's puzzle types, the result sent when a puzzle
 * ends, adopting a claimed player, the pending choice, and the history copy
 * (savedResults, trackerIds, backfillPlan). Server calls stay with the app; these are
 * the pure parts, so the app and the site send the same things.
 */
import type { KV } from './types';

type Obj = Record<string, unknown>;

/** Saved state, verbatim key. */
export const BOARD_KEY = 'noodle-board-v1';

export interface BoardLeague {
  code: string;
  name: string;
  nick: string;
  owner: boolean;
  /** From board_mine (refresh): players in the league, and whether this player has a PIN. */
  members?: number;
  pin?: boolean;
}

export interface BoardPending {
  pid: string;
  leagues: BoardLeague[];
  cur: string;
}

/** `{pid, leagues, cur, ptype, fill: {n, aids}}`, plus the site's transient `pend` and `moved`. */
export interface BoardState {
  pid?: string;
  leagues?: BoardLeague[];
  cur?: string;
  ptype?: string;
  fill?: { n: number; aids: string[] };
  pend?: BoardPending;
  moved?: { at: number; n: number };
  [k: string]: unknown;
}

/** The board's puzzles in pill order; `tv` is the tracker's (and the page event's) type name. */
export const BOARD_TYPES = [
  { id: 'mini', tv: 'crossword-mini', name: 'Mini', emoji: '✏️' },
  { id: 'doku', tv: 'logic-doku', name: 'Doku', emoji: '🔢' },
  { id: 'path', tv: 'logic-path', name: 'Path', emoji: '〰️' },
  { id: 'sweep', tv: 'logic-sweep', name: 'Sweep', emoji: '💣' },
  { id: 'link', tv: 'word-link', name: 'Link', emoji: '🔗' },
  { id: 'tangle', tv: 'word-tangle', name: 'Tangle', emoji: '🧶' },
  { id: 'borders', tv: 'geo-borders', name: 'Borders', emoji: '🌍' },
  { id: 'reckon', tv: 'quiz-reckon', name: 'Reckon', emoji: '🎯' },
] as const;

export type BoardType = (typeof BOARD_TYPES)[number];
export type BoardTypeId = BoardType['id'];

const BY_TV: Record<string, BoardType> = {};
export const BOARD_TYPE: Record<BoardTypeId, BoardType> = {} as Record<BoardTypeId, BoardType>;
for (const t of BOARD_TYPES) {
  BY_TV[t.tv] = t;
  BOARD_TYPE[t.id] = t;
}

export function boardTypeOfPath(p: unknown): BoardType | null {
  const m = String(p || '').match(
    /(crossword-mini|logic-doku|logic-path|logic-sweep|word-link|word-tangle|geo-borders|quiz-reckon)/,
  );
  return m ? BY_TV[m[1]!]! : null;
}

export function dateOfPath(p: unknown): string {
  const m = String(p || '').match(/(\d{4}-\d{2}-\d{2})-/);
  return m ? m[1]! : '';
}

// ---------- saved state ----------

export function readBoard(kv: KV): BoardState {
  try {
    const s: unknown = JSON.parse(kv.getItem(BOARD_KEY) as string);
    return s && typeof s === 'object' ? (s as BoardState) : {};
  } catch {
    return {};
  }
}

export function writeBoard(kv: KV, s: BoardState): void {
  try {
    kv.setItem(BOARD_KEY, JSON.stringify(s));
  } catch {
    /* as the site */
  }
}

/** The board id, minted (uuid v4) and saved on first use. */
export function boardPid(kv: KV, mint: () => string): string {
  const s = readBoard(kv);
  if (!s.pid) {
    s.pid = mint();
    writeBoard(kv, s);
  }
  return s.pid;
}

export function boardLeagues(kv: KV): BoardLeague[] {
  return readBoard(kv).leagues || [];
}

export function inAnyLeague(kv: KV): boolean {
  return boardLeagues(kv).length > 0;
}

/** board_mine's rows as `refresh()` keeps them. */
export interface MineRow {
  code: string;
  name: string;
  nickname: string;
  owner: boolean;
  members: number;
  pin?: boolean;
}

export function leaguesFromMine(list: readonly MineRow[] | null | undefined): BoardLeague[] {
  return (list || []).map((l) => ({
    code: l.code,
    name: l.name,
    nick: l.nickname,
    owner: !!l.owner,
    members: l.members,
    pin: !!l.pin,
  }));
}

// ---------- a finished puzzle ----------

/** board_submit's arguments. */
export interface SubmitArgs {
  p_player: string;
  p_path: string;
  p_outcome: string;
  p_secs: number | null;
  p_score: number | null;
  p_mistakes: number | null;
}

/**
 * What the site sends when a puzzle ends (dn-board.js, the dn:puzzle_end listener):
 * only for a puzzle page (`reports/<file>.html`, the page path's last two parts), and
 * only when the event's type is that page's. Null when nothing is sent. Membership is
 * the caller's check.
 */
export function submitArgs(pid: string, here: string, detail: Obj): SubmitArgs | null {
  const T = boardTypeOfPath(here);
  if (!T || !/^reports\//.test(here)) return null;
  const d = detail || {};
  if (BY_TV[d.type as string] !== T) return null;
  return {
    p_player: pid,
    p_path: here,
    p_outcome: (d.outcome as string) || '',
    p_secs: d.secs == null ? null : (d.secs as number),
    p_score: d.score == null ? null : (d.score as number),
    p_mistakes: d.mistakes == null ? null : (d.mistakes as number),
  };
}

// ---------- claiming a player by PIN ----------

export interface ClaimResult {
  ok: boolean;
  error?: string;
  player?: string;
  code?: string;
  name?: string;
  nick?: string;
  needs_pin?: boolean;
}

/**
 * Adopt the player board_claim returned, as dn-board.js `claim`: take their id if this
 * install is in no league (or is already them); otherwise leave it pending for the
 * player to choose. Returns the new state and whether it is pending.
 */
export function adoptClaim(s: BoardState, r: ClaimResult): { state: BoardState; pending: boolean } {
  const me: BoardLeague = { code: r.code!, name: r.name!, nick: r.nick!, owner: false };
  const st: BoardState = { ...s };
  const inAny = (s.leagues || []).length > 0;
  if (!inAny || s.pid === r.player) {
    st.pid = r.player;
    st.cur = r.code;
    st.leagues = [me];
    delete st.fill;
    delete st.filled;
    delete st.pend;
    return { state: st, pending: false };
  }
  st.pend = { pid: r.player!, leagues: [me], cur: r.code! };
  return { state: st, pending: true };
}

/** "Use my link" (take) or "Keep this one", as dn-board.js `settlePending`. */
export function settlePending(s: BoardState, take: boolean): BoardState {
  const p = s.pend;
  if (!p) return s;
  const st: BoardState = { ...s };
  delete st.pend;
  if (take) {
    st.pid = p.pid;
    st.leagues = p.leagues || [];
    st.cur = p.cur || '';
    delete st.fill;
    delete st.filled;
  }
  return st;
}

/**
 * The league-identity choice, remembered (plan R4, 29 Oct 2026). When a sync finds the
 * account holds another league player and the player taps "Keep this one", the account's
 * player id is recorded here, so the next sync (and a restart) doesn't ask again: that
 * account player is left alone and the account keeps it, as the site does while a
 * browser hasn't chosen. App-only key; never synced.
 */
export const KEEP_KEY = 'noodle-app-league-keep';

export function keptPids(kv: KV): string[] {
  try {
    const v: unknown = JSON.parse(kv.getItem(KEEP_KEY) ?? 'null');
    const list = v && typeof v === 'object' ? (v as { pids?: unknown }).pids : null;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberKeep(kv: KV, pid: string): void {
  if (!pid) return;
  const pids = keptPids(kv).filter((x) => x !== pid);
  pids.push(pid);
  kv.setItem(KEEP_KEY, JSON.stringify({ pids: pids.slice(-10) }));
}

// ---------- the history copy (dn-board.js backfill) ----------

/** One finished puzzle for board_backfill: `{outcome, secs?, score?, mistakes?, path}`. */
export type BackfillRow = Obj & { path: string; outcome: string };

/** A puzzle card: `{path, kind?}` (feed.json items carry kind; feed-lite holds puzzles only). */
export interface FeedPath {
  path: string;
  kind?: string;
}

export function clockSecs(v: unknown): number | null {
  const m = String(v || '').match(/^(\d{1,4}):(\d{2})$/);
  return m ? +m[1]! * 60 + +m[2]! : null;
}

type Rec = Obj;
const SAVES: { key: string; t: BoardTypeId; read: (r: Rec) => Obj }[] = [
  { key: 'digi-mini-v1', t: 'mini', read: (r) => ({ outcome: 'solved', secs: r.s }) },
  { key: 'digi-doku-v1', t: 'doku', read: (r) => ({ outcome: 'solved', secs: r.s }) },
  { key: 'digi-path-v1', t: 'path', read: (r) => ({ outcome: 'solved', secs: clockSecs(r.t) }) },
  {
    key: 'digi-link-v1',
    t: 'link',
    read: (r) => ({
      outcome: r.o === 'win' ? 'solved' : 'failed',
      secs: clockSecs(r.t),
      mistakes: r.m,
    }),
  },
  {
    key: 'digi-sweep-v1',
    t: 'sweep',
    read: (r) => ({
      outcome: r.o === 'win' ? 'solved' : r.o === 'loss' ? 'failed' : 'revealed',
      secs: r.s,
    }),
  },
  { key: 'digi-tangle-v1', t: 'tangle', read: (r) => ({ outcome: 'scored', score: r.s }) },
  {
    key: 'digi-borders-v1',
    t: 'borders',
    read: (r) => ({ outcome: 'scored', score: r.p, secs: r.secs }),
  },
  {
    key: 'digi-reckon-v1',
    t: 'reckon',
    read: (r) => ({ outcome: 'scored', score: r.p, secs: r.secs }),
  },
];

/** Every finished puzzle this install remembers, as board rows, found by its page in the feed. */
export function savedResults(kv: KV, feed: readonly FeedPath[] | null | undefined): BackfillRow[] {
  const byKey: Record<string, string> = {};
  for (const it of feed || []) {
    const T = boardTypeOfPath(it.path);
    if (!T || (it.kind !== undefined && it.kind !== 'puzzle')) continue;
    const num = (it.path.match(/-(\d{3,5})\.html$/) || [])[1];
    byKey[`${T.id}|${num ? String(+num) : dateOfPath(it.path)}`] = it.path;
  }
  const rows: BackfillRow[] = [];
  for (const S of SAVES) {
    let s: unknown = null;
    try {
      s = JSON.parse(kv.getItem(S.key) || 'null');
    } catch {
      /* unreadable save: nothing from it */
    }
    const done = s && (s as Obj).done;
    if (!done || typeof done !== 'object') continue;
    for (const id of Object.keys(done)) {
      const last = String(id).split('·').pop() as string;
      const k = /^\d{4}-\d{2}-\d{2}$/.test(last) ? last : String(+last);
      const path = byKey[`${S.t}|${k}`];
      if (!path) continue;
      const r = (done as Obj)[id];
      if (!r || typeof r !== 'object') continue;
      const x = S.read(r as Rec) as BackfillRow;
      x.path = path;
      rows.push(x);
    }
  }
  return rows;
}

/** This install's tracker ids (current first, then older ones a handoff brought), none if opted out. */
export function trackerIds(kv: KV): string[] {
  const out: string[] = [];
  try {
    if (kv.getItem('digi.optout') === '1') return out;
    const prev: unknown = JSON.parse(kv.getItem('digi.aid.prev') || '[]');
    for (const a of [kv.getItem('digi.aid')].concat(Array.isArray(prev) ? prev : [])) {
      if (a && /^[0-9a-f-]{36}$/i.test(a) && out.indexOf(a) < 0) out.push(a);
    }
  } catch {
    /* as the site */
  }
  return out;
}

export interface BackfillPlan {
  rows: BackfillRow[];
  aids: string[];
  n: number;
  done: string[];
}

/**
 * What to copy in, as dn-board.js `backfillPlan`: null unless this install is in a league
 * and its saves hold more finished puzzles than last time, or a tracker id is unread.
 */
export function backfillPlan(
  kv: KV,
  feed: readonly FeedPath[] | null | undefined,
): BackfillPlan | null {
  if (!inAnyLeague(kv)) return null;
  const f = readBoard(kv).fill || { n: 0, aids: [] };
  const rows = savedResults(kv, feed);
  const aids = trackerIds(kv).filter((a) => (f.aids || []).indexOf(a) < 0);
  if (rows.length <= (f.n || 0) && !aids.length) return null;
  return {
    rows: rows.length > (f.n || 0) ? rows : [],
    aids,
    n: Math.max(rows.length, f.n || 0),
    done: f.aids || [],
  };
}

/** The board_backfill calls a plan makes, in order: the rows go with the first. */
export function backfillCalls(plan: BackfillPlan): { aid: string | null; rows: BackfillRow[] }[] {
  return plan.aids.length
    ? plan.aids.map((a, i) => ({ aid: a, rows: i ? [] : plan.rows }))
    : [{ aid: null, rows: plan.rows }];
}

/** The state once a plan's calls have all gone through. */
export function afterBackfill(s: BoardState, plan: BackfillPlan): BoardState {
  const st: BoardState = { ...s };
  delete st.filled;
  st.fill = { n: plan.n, aids: plan.done.concat(plan.aids) };
  return st;
}
