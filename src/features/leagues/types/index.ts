import type { BoardTypeId } from '@noodle/core';

/** Shapes the board_* functions return (dailynoodle toolchain/sql, 18–24 Oct 2026). */

export interface LeagueRef {
  code: string;
  name: string;
}

/** board_peek: a league seen through its code. */
export interface Peek {
  name: string;
  members: number;
  players?: string[];
}

export type Outcome = 'solved' | 'failed' | 'revealed' | 'scored';

/** board_day: a finisher (ranked) or a round that didn't finish (unranked). */
export interface DayRow {
  rank?: number;
  nick: string;
  me: boolean;
  outcome: Outcome;
  secs: number | null;
  score?: number | null;
  mistakes: number | null;
  streak: number;
}

export interface NotYet {
  nick: string;
  me: boolean;
}

export interface DayBoard {
  ranked: DayRow[];
  unranked: DayRow[];
  not_yet: NotYet[];
  players: string[];
  members: number;
  first: string | null;
}

/** board_overall: points across all eight puzzles. */
export interface OverallRow {
  rank: number;
  nick: string;
  me: boolean;
  points: number;
  played: number;
  completed: number;
}

export interface Overall {
  day: OverallRow[];
  week: OverallRow[];
  not_yet: NotYet[];
  week_from: string;
  week_to: string;
  players: string[];
  members: number;
  first: string | null;
}

/** board_moment (2026-10-25-board-records.sql): a personal best, and the leagues it's a record in. */
export interface Moment {
  type: string;
  pb: boolean;
  records: LeagueRef[] | null;
}

/** A result as records keep it (board_records): when it was set and the figures that rank it. */
export interface RecordResult {
  date: string;
  secs: number | null;
  score?: number | null;
  mistakes: number | null;
}

/** A league's best result ever on one puzzle, and who holds it. */
export interface LeagueRecord extends RecordResult {
  nick: string;
  me: boolean;
}

/** A member's honours, bests and per-puzzle streaks (board_records players[], by joining order). */
export interface RecordsPlayer {
  nick: string;
  me: boolean;
  completed: number;
  wins: number;
  titles: number;
  perfect: number;
  sweeps: number;
  longest: number;
  current: number;
  bests: Partial<Record<BoardTypeId, RecordResult>>;
  streaks: Partial<Record<BoardTypeId, number>>;
}

/** board_records (2026-10-25-board-records.sql): records, honours and last week's champion. */
export interface Records {
  records: Partial<Record<BoardTypeId, LeagueRecord>>;
  players: RecordsPlayer[];
  crown: string[];
  crown_week: string | null;
  today: string;
}

/** What the board shows: one puzzle, all eight, or the league's records. */
export type BoardView = BoardTypeId | 'all' | 'records';

/** A puzzle card, from the site's feed-lite.json. */
export interface PuzzleCard {
  path: string;
  type: string;
  id: string;
  date: string;
  headline: string;
}
