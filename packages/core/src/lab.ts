/**
 * The Lab: puzzles on trial (Alec, 11 Nov 2026; project doc claude/lab-in-app-brief.md).
 * They are not daily puzzles: they never join PUZZLE_TYPES, streaks shown on Today, the
 * overall run or the leagues. Their ids, storage keys and pages are already the ones they
 * would keep as a daily (digi-<type>-v1, DP·<ID>·NNNN), so a trial that graduates moves
 * from LAB_TYPES to PUZZLE_TYPES and nothing is renamed.
 */
import { TYPE_LABEL, type PuzzleType } from './ids';
import { clock, type PlayedState } from './played';
import type { SaveDoc } from './types';

export const LAB_TYPES = ['tilt', 'redact', 'tumbler'] as const;

export type LabType = (typeof LAB_TYPES)[number];

/** A daily puzzle or a Lab trial: anything the play route opens. */
export type AnyType = PuzzleType | LabType;

export const LAB_LABEL: Record<LabType, string> = {
  tilt: 'Tilt',
  redact: 'Redact',
  tumbler: 'Tumbler',
};

/** The id prefix after "DP·" for each Lab type (tools/build-feed.js TYPE_OF_ID). */
export const LAB_OF_ID: Record<string, LabType> = {
  TILT: 'tilt',
  REDA: 'redact',
  TUMB: 'tumbler',
};

/** A daily or Lab type's name: "Mini", "Redact". */
export function labelOf(type: AnyType): string {
  return isLabType(type) ? LAB_LABEL[type] : TYPE_LABEL[type];
}

export function isLabType(x: unknown): x is LabType {
  return typeof x === 'string' && (LAB_TYPES as readonly string[]).includes(x);
}

/** The Lab type of a puzzle id such as "DP·REDA·0024", or null. */
export function labTypeOfId(id: string): LabType | null {
  const m = /^DP·([A-Z]+)·/.exec(id);
  return (m && LAB_OF_ID[m[1] ?? '']) || null;
}

/**
 * A trial is running while its newest released puzzle is today's or yesterday's (one a
 * day); after that it is retired: its puzzles stay playable in the Archive.
 */
export function labRunning(newest: string | undefined, today: string): boolean {
  if (!newest) return false;
  const y = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return newest >= y;
}

// ---- votes ----

/** The answers given on this phone, `{type: {v, at}}`: the website's shape (engines/finish.js). */
export const LAB_VOTES_KEY = 'noodle-lab-votes-v1';
/** This phone's own voter code for public.lab_vote: never the tracker's visitor code. */
export const LAB_VOTER_KEY = 'noodle-lab-voter';

export type LabVote = 'yes' | 'no';
export type LabVotes = Partial<Record<LabType, { v: LabVote; at: number }>>;

/** The kept answers, dropping anything that isn't one. */
export function readLabVotes(raw: string | null | undefined): LabVotes {
  let o: unknown = null;
  try {
    o = JSON.parse(raw || 'null');
  } catch {
    return {};
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  const out: LabVotes = {};
  for (const t of LAB_TYPES) {
    const e = (o as Record<string, unknown>)[t] as { v?: unknown; at?: unknown } | undefined;
    if (e && (e.v === 'yes' || e.v === 'no'))
      out[t] = { v: e.v, at: typeof e.at === 'number' ? e.at : 0 };
  }
  return out;
}

/**
 * The document with `type`'s answer set to `v`, other types' answers (and anything else the
 * website kept) untouched. Null when the answer is already `v`: nothing to keep or send.
 */
export function withLabVote(
  raw: string | null | undefined,
  type: LabType,
  v: LabVote,
  at: number,
): string | null {
  if (readLabVotes(raw)[type]?.v === v) return null;
  let o: Record<string, unknown> = {};
  try {
    const x: unknown = JSON.parse(raw || 'null');
    if (x && typeof x === 'object' && !Array.isArray(x)) o = x as Record<string, unknown>;
  } catch {
    /* a broken document is replaced */
  }
  return JSON.stringify({ ...o, [type]: { v, at } });
}

/** A Lab card's state from its type's save (digi-<type>-v1): "Solved in 1:42", in progress, or null. */
export function labPlayed(id: string, doc: SaveDoc | null): PlayedState | null {
  if (!doc || typeof doc !== 'object') return null;
  const r = doc.done && typeof doc.done === 'object' ? doc.done[id] : undefined;
  if (r) {
    const t = typeof r === 'object' && r ? clock((r as { s?: unknown }).s) : '';
    return { done: true, lost: false, text: t ? `Solved in ${t}` : 'Played' };
  }
  const cur = (doc as { cur?: { id?: unknown } | null }).cur;
  return cur && cur.id === id ? { done: false } : null;
}

/** A Lab type's save key: the one it keeps as a daily. */
export const labSaveKey = (type: LabType) => `digi-${type}-v1`;
