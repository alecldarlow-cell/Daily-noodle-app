/**
 * Typed calls to the board functions, with exactly the SQL's argument names
 * (dailynoodle toolchain/sql/2026-10-18-leaderboards.sql, -hide-only, 2026-10-20-reckon-board,
 * 2026-10-24-board-pins-and-overall). Components never call these: hooks do.
 */
import type { BackfillRow, BoardTypeId, ClaimResult, MineRow, SubmitArgs } from '@noodle/core';

import type { DayBoard, LeagueRef, Moment, Overall, Peek } from '../types';
import { rpc } from './client';

export const boardMine = (p_player: string) => rpc<MineRow[]>('board_mine', { p_player });

export const boardPeek = (p_code: string) => rpc<Peek>('board_peek', { p_code });

export const boardDay = (p_player: string, p_code: string, p_type: BoardTypeId, p_date: string) =>
  rpc<DayBoard>('board_day', { p_player, p_code, p_type, p_date });

export const boardOverall = (p_player: string, p_code: string, p_date: string) =>
  rpc<Overall>('board_overall', { p_player, p_code, p_date });

export const boardCreate = (p_player: string, p_name: string, p_nick: string) =>
  rpc<LeagueRef>('board_create', { p_player, p_name, p_nick });

export const boardJoin = (p_player: string, p_code: string, p_nick: string) =>
  rpc<LeagueRef>('board_join', { p_player, p_code, p_nick });

export const boardLeave = (p_player: string, p_code: string) =>
  rpc<boolean>('board_leave', { p_player, p_code });

export const boardRename = (p_player: string, p_code: string, p_name: string) =>
  rpc<boolean>('board_rename', { p_player, p_code, p_name });

export const boardNewCode = (p_player: string, p_code: string) =>
  rpc<{ code: string }>('board_new_code', { p_player, p_code });

export const boardRemove = (p_player: string, p_code: string, p_nick: string) =>
  rpc<boolean>('board_remove', { p_player, p_code, p_nick });

export const boardClose = (p_player: string, p_code: string) =>
  rpc<boolean>('board_close', { p_player, p_code });

export const boardLetBack = (p_player: string, p_code: string, p_nick: string) =>
  rpc<boolean>('board_let_back', { p_player, p_code, p_nick });

export const boardPinSet = (p_player: string, p_pin: string) =>
  rpc<boolean>('board_pin_set', { p_player, p_pin });

/** Returns {ok, error?} rather than raising, so failed tries count towards the limits. */
export const boardClaim = (p_code: string, p_nick: string, p_pin: string) =>
  rpc<ClaimResult>('board_claim', { p_code, p_nick, p_pin });

export const boardSubmit = (a: SubmitArgs) =>
  rpc<boolean>('board_submit', {
    p_player: a.p_player,
    p_path: a.p_path,
    p_outcome: a.p_outcome,
    p_secs: a.p_secs,
    p_score: a.p_score,
    p_mistakes: a.p_mistakes,
  });

export const boardBackfill = (p_player: string, p_aid: string | null, p_rows: BackfillRow[]) =>
  rpc<number>('board_backfill', { p_player, p_aid, p_rows });

/** The caller's own result on a puzzle: `{type, pb, records: [{code, name}]}`, null if not completed. */
export const boardMoment = (p_player: string, p_path: string) =>
  rpc<Moment | null>('board_moment', { p_player, p_path });
