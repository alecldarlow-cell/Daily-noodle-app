/**
 * The personal link (`…/board.html#dnmove=…`), ported from the site:
 * - unpacking and merging from `dn-track.js`'s domain-move import (b64d, mergeObj,
 *   isStreak, adoptBoard and the import loop), line for line;
 * - packing from `dn-board.js` `moveLink`.
 * The payload is base64url JSON `{v: 1, d: {key: savedString}, b: {pid, leagues, cur}, h}`.
 * Differences from the browser, none of which change a result: storage is passed in,
 * the clock is injectable, and base64/UTF-8 are done here (Hermes has no `escape`).
 */
import type { KV } from './types';

type Obj = Record<string, unknown>;

export const MOVE_TAG = '#dnmove=';
export const MOVE_BASE = 'https://dailynoodle.co.uk/board.html';

export interface MoveLeague {
  code: string;
  name: string;
  nick: string;
  owner: boolean;
}

export interface MoveBoard {
  pid: string;
  cur: string;
  leagues: MoveLeague[];
}

export interface MovePayload {
  v: 1;
  d: Record<string, unknown>;
  b?: unknown;
  h?: unknown;
}

// ---------- base64url and UTF-8 (btoa(unescape(encodeURIComponent(s))) and back) ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** UTF-8 bytes of a string; throws on a lone surrogate, as encodeURIComponent does. */
function utf8(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = s.charCodeAt(i + 1);
      if (!(n >= 0xdc00 && n <= 0xdfff)) throw new URIError('URI malformed');
      c = 0x10000 + ((c - 0xd800) << 10) + (n - 0xdc00);
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) throw new URIError('URI malformed');
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/** A string from strict UTF-8 (as decodeURIComponent accepts it), or null. */
function fromUtf8(b: number[]): string | null {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const x = b[i]!;
    let need = 0;
    let c = 0;
    let min = 0;
    if (x < 0x80) {
      s += String.fromCharCode(x);
      i++;
      continue;
    } else if (x >= 0xc2 && x <= 0xdf) [need, c, min] = [1, x & 31, 0x80];
    else if (x >= 0xe0 && x <= 0xef) [need, c, min] = [2, x & 15, 0x800];
    else if (x >= 0xf0 && x <= 0xf4) [need, c, min] = [3, x & 7, 0x10000];
    else return null;
    for (let k = 1; k <= need; k++) {
      const y = b[i + k];
      if (y === undefined || (y & 0xc0) !== 0x80) return null;
      c = (c << 6) | (y & 63);
    }
    if (c < min || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return null;
    s += String.fromCodePoint(c);
    i += need + 1;
  }
  return s;
}

/** base64url (no padding) of a string's UTF-8, as dn-board.js `b64e`. */
export function b64urlEncode(s: string): string {
  const b = utf8(s);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += i + 1 < b.length ? B64[(n >> 6) & 63]! : '';
    out += i + 2 < b.length ? B64[n & 63]! : '';
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}

/** The string in base64url (or plain base64), as dn-track.js `b64d`; null where it would throw. */
export function b64urlDecode(text: string): string | null {
  let s = text.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  // atob: ASCII whitespace is ignored, padding only at the end.
  s = s.replace(/[\t\n\f\r ]/g, '');
  if (s.length % 4 === 0) s = s.replace(/={1,2}$/, '');
  if (s.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(s)) return null;
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of s) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 255);
    }
  }
  return fromUtf8(bytes);
}

// ---------- unpacking and merging (dn-track.js) ----------

function isObj(x: unknown): x is Obj {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}
function parse(s: unknown): unknown {
  try {
    return JSON.parse(s as string);
  } catch {
    return undefined;
  }
}
/** A day whose round is over (Tangle's `days[id].state`). */
export function finished(d: unknown): boolean {
  return isObj(d) && d.state === 'done';
}
function isStreak(o: unknown): o is Obj {
  return isObj(o) && 'last' in o && ('streak' in o || 'n' in o);
}

const UNION: Record<string, 1> = { done: 1, days: 1, found: 1 };
const DAY_MS = 864e5;

/**
 * Merge a save from the link (`old`) into the one already here, as dn-track.js
 * `mergeObj`: finished puzzles, days and atlas entries add up (what's here wins an id
 * both hold, so the first result kept here stays); for a streak keep the more recent
 * run and the higher best, recounting the run from both lists of days; for an unfinished
 * round (`cur`) stamped with `at`, the newer one; anything else keeps what's here.
 */
export function mergeMoved(here: Obj, old: Obj): Obj {
  const out: Obj = {};
  for (const k in here) out[k] = here[k];
  if (isStreak(here) && isStreak(old)) {
    const src = ((old.last || '') as string) > ((here.last || '') as string) ? old : here;
    for (const k in src) out[k] = src[k];
    if ('best' in old || 'best' in here)
      out.best = Math.max(+(old.best as number) || 0, +(here.best as number) || 0);
    if (Array.isArray(old.dates) && Array.isArray(here.dates)) {
      const seen: Record<string, 1> = {};
      const all = (here.dates as unknown[])
        .concat(old.dates as unknown[])
        .filter((d) => (seen[d as string] ? 0 : (seen[d as string] = 1)));
      const dates = all.sort();
      out.dates = dates;
      // With the full list of days played, the current run can be recounted across both.
      if ('streak' in out && dates.length) {
        let run = 1;
        let day = dates[dates.length - 1] as string;
        while (true) {
          const prev = new Date(Date.parse(`${day}T12:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
          if (dates.indexOf(prev) < 0) break;
          run++;
          day = prev;
        }
        out.last = dates[dates.length - 1];
        out.streak = run;
        out.best = Math.max((out.best as number) || 0, run);
      }
    }
  }
  for (const k in old) {
    if (!(k in out)) out[k] = old[k];
    else if (UNION[k] && isObj(out[k]) && isObj(old[k])) {
      const u: Obj = Object.assign({}, old[k], out[k]);
      // A day finished there beats the same day still in play here (Tangle, 30 Oct 2026).
      if (k === 'days')
        for (const j in old[k] as Obj)
          if (finished((old[k] as Obj)[j]) && !finished((out[k] as Obj)[j]))
            u[j] = (old[k] as Obj)[j];
      out[k] = u;
    } else if (k === 'streak' && isObj(out[k]) && isObj(old[k])) {
      out[k] = mergeMoved(out[k] as Obj, old[k] as Obj);
    } else if (k === 'cur' && isObj(old[k]) && Number(old[k].at) > 0) {
      // An unfinished round stamped with when it was saved (Link, 29 Oct 2026): the newer
      // one wins. Rounds without a stamp (Borders, Reckon) keep what's here.
      const here = out[k];
      if (here == null || (isObj(here) && Number(old[k].at) > (Number(here.at) || 0)))
        out[k] = old[k];
    }
  }
  return out;
}

/** The payload of a personal link (the whole link, or anything holding `#dnmove=…`), or null. */
export function unpackMove(text: string): MovePayload | null {
  const v = String(text || '').replace(/\s+/g, '');
  const i = v.indexOf(MOVE_TAG);
  if (i < 0) return null;
  const json = b64urlDecode(v.slice(i + MOVE_TAG.length));
  if (json === null) return null;
  const p = parse(json);
  return isObj(p) && p.v === 1 && isObj(p.d) ? (p as unknown as MovePayload) : null;
}

/** The board state key (also in board.ts; repeated so this file stands alone). */
const BOARD = 'noodle-board-v1';
const PID = /^[0-9a-f-]{36}$/i;

/**
 * Take over the link's board id, as dn-track.js `adoptBoard`: if this install is in no
 * league (or is the same player) it becomes that player; if it is in a league as someone
 * else the choice is left pending (`pend`), never made silently.
 */
export function adoptBoard(kv: KV, b: Obj, now: () => number = Date.now): void {
  if (!PID.test((b.pid as string) || '')) return;
  const ls = (Array.isArray(b.leagues) ? (b.leagues as unknown[]) : [])
    .filter((l): l is Obj => isObj(l) && /^[A-Z0-9]{4,12}$/.test((l.code as string) || ''))
    .slice(0, 10)
    .map((l) => ({
      code: l.code as string,
      name: String(l.name || '').slice(0, 30),
      nick: String(l.nick || '').slice(0, 16),
      owner: !!l.owner,
    }));
  const cur = typeof b.cur === 'string' ? b.cur : '';
  let s: unknown = null;
  try {
    s = parse(kv.getItem(BOARD) || '{}');
  } catch {
    /* unreadable: start afresh */
  }
  const st: Obj = isObj(s) ? s : {};
  const mine = Array.isArray(st.leagues) && st.leagues.length;
  if (st.pid === b.pid) {
    st.moved = { at: now(), n: ls.length };
  } else if (!st.pid || !mine) {
    st.pid = b.pid;
    st.leagues = ls;
    st.cur = cur;
    delete st.fill;
    delete st.filled;
    delete st.pend;
    st.moved = { at: now(), n: ls.length };
  } else {
    st.pend = { pid: b.pid, leagues: ls, cur };
  }
  try {
    kv.setItem(BOARD, JSON.stringify(st));
  } catch {
    /* as the site: a failed write leaves things as they were */
  }
}

/**
 * Bring a personal link's saves into this install, as dn-track.js does on arrival:
 * every key merges with what's here (never overwriting newer progress), the link's
 * tracker id is kept as `digi.aid.prev` for the history copy, then the board is adopted.
 * Returns false if the link isn't one.
 */
export function importMove(kv: KV, p: MovePayload, now: () => number = Date.now): boolean {
  if (!(isObj(p) && p.v === 1 && isObj(p.d))) return false;
  try {
    try {
      const oldAid = p.d['digi.aid'];
      const nowAid = kv.getItem('digi.aid');
      if (
        PID.test((oldAid as string) || '') &&
        nowAid &&
        nowAid !== oldAid &&
        kv.getItem('digi.optout') !== '1'
      ) {
        let prev = parse(kv.getItem('digi.aid.prev') || '[]');
        if (!Array.isArray(prev)) prev = [];
        const list = prev as unknown[];
        if (list.indexOf(oldAid) < 0) list.push(oldAid);
        kv.setItem('digi.aid.prev', JSON.stringify(list.slice(-5)));
      }
    } catch {
      /* the history copy is a nicety */
    }
    for (const k in p.d) {
      if (k === 'digi.aid.prev') continue;
      const oldV = p.d[k];
      let here: string | null = null;
      try {
        here = kv.getItem(k);
      } catch {
        /* unreadable: the link's copy goes in */
      }
      let val: unknown = oldV;
      if (here != null) {
        const a = parse(here);
        const b = parse(oldV);
        val = isObj(a) && isObj(b) ? JSON.stringify(mergeMoved(a, b)) : here;
      }
      try {
        kv.setItem(k, String(val));
      } catch {
        /* as the site: carry on with the other keys */
      }
    }
    if (isObj(p.b)) adoptBoard(kv, p.b, now);
  } catch {
    // As the site, whose whole import sits in one try: a bad value stops it there.
    return true;
  }
  return true;
}

// ---------- packing (dn-board.js moveLink) ----------

const PUZZLE_KEY = /^digi-(mini|doku|sweep|path|link|tangle|borders|reckon)-(v1|streak)$/;
const GAME_BUDGET = 40000;
/** The app's own caches (today's list, the archive): nothing a browser can use. */
const APP_ONLY = /^noodle-app-/;

/**
 * This install's personal link, as dn-board.js `moveLink`: puzzle saves and streaks,
 * then other saves while they fit in 40,000 characters, the tracker id if there is
 * one, and the board (`pid`, current league, leagues). The app leaves out its own
 * caches (`noodle-app-*`), which the browser has no use for.
 */
export function packMove(
  kv: KV,
  keys: readonly string[],
  board: { pid: string; cur?: string; leagues?: Obj[] },
  aid?: string,
): string {
  const d: Record<string, string> = {};
  const sorted = [...keys].sort();
  let spent = 0;
  for (const k of sorted) {
    if (!PUZZLE_KEY.test(k)) continue;
    const v = kv.getItem(k);
    if (v != null) d[k] = v;
  }
  for (const k of sorted) {
    if (PUZZLE_KEY.test(k) || k === BOARD || !/^(digi|noodle)-/.test(k) || APP_ONLY.test(k))
      continue;
    const v = kv.getItem(k);
    if (v != null && spent + v.length <= GAME_BUDGET) {
      d[k] = v;
      spent += v.length;
    }
  }
  if (aid) d['digi.aid'] = aid;
  const b: MoveBoard = {
    pid: board.pid,
    cur: board.cur || '',
    leagues: (board.leagues || []).map((l) => ({
      code: l.code as string,
      name: l.name as string,
      nick: l.nick as string,
      owner: !!l.owner,
    })),
  };
  return `${MOVE_BASE}${MOVE_TAG}${b64urlEncode(JSON.stringify({ v: 1, d, b, h: '' }))}`;
}
