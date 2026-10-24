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

/** What the board shows: one puzzle, or all eight. */
export type BoardView = BoardTypeId | 'all';

/** A puzzle card, from the site's feed-lite.json. */
export interface PuzzleCard {
  path: string;
  type: string;
  id: string;
  date: string;
  headline: string;
}
