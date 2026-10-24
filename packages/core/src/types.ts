/** Save documents exactly as the site's players keep them in localStorage. */

/** A storage the shape of Web Storage, so localStorage and the app's store both fit. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Mini and Doku: seconds to solve. */
export interface TimedRecord {
  s: number;
  d?: string;
}
export interface SweepRecord {
  o: 'win' | 'loss' | 'gave';
  s: number;
  b?: number;
  d?: string;
}
/** Path keeps the clock as shown, "m:ss". */
export interface PathRecord {
  t: string;
  d?: string;
}
export interface LinkRecord {
  o: 'win' | 'loss';
  t: string;
  m: number;
  r: number[];
  g: number[][];
  d?: string;
}
export interface TangleRecord {
  o: 'played';
  s: number;
  w: number;
  st: boolean;
  d?: string;
}
export interface BordersRecord {
  c: number;
  p: number;
  secs: number;
  ans: { k: unknown; ok: boolean; h: unknown; nw: unknown }[];
  on: string;
}
export interface ReckonRecord {
  p: number;
  b: number;
  z: number[];
  g: number[];
  secs: number;
  d?: string;
}

export type DoneRecord =
  | TimedRecord
  | SweepRecord
  | PathRecord
  | LinkRecord
  | TangleRecord
  | BordersRecord
  | ReckonRecord;

/** Tangle, Borders and Reckon keep their streak inside the result document. */
export interface RoundStreak {
  last: string | null;
  n: number;
  best: number;
}

/** A result document (`digi-<type>-v1`); fields beyond `done` vary by type. */
export interface SaveDoc {
  v: 1;
  done?: Record<string, DoneRecord | Record<string, unknown>>;
  days?: Record<string, { state?: string; [k: string]: unknown }>;
  cur?: { id?: string; [k: string]: unknown } | null;
  streak?: RoundStreak | Record<string, unknown>;
  best?: number;
  [k: string]: unknown;
}

/** The five grid types' streak documents (`digi-<type>-streak`). */
export interface GridStreak {
  last: string | null;
  streak: number;
  best: number;
  dates: string[];
  /** "L" once written with London days; absent on saves from before 18 Oct 2026. */
  tz?: 'L';
  seeded?: 1;
}
