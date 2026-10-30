/**
 * Server state for leagues, all through React Query: the player's leagues, a day's
 * board, the All puzzles table, an invite's league, and every change (start, join,
 * leave, PIN, claim, owner actions). Each change refreshes the leagues as dn-board.js
 * does, so the saved state always holds the server's view.
 */
import {
  adoptClaim,
  leaguesFromMine,
  settlePending,
  rememberKeep,
  type BoardTypeId,
  type ClaimResult,
} from '@noodle/core';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { appStorage } from '@/shared/storage';

import {
  boardClaim,
  boardClose,
  boardCreate,
  boardDay,
  boardJoin,
  boardLeave,
  boardLetBack,
  boardMine,
  boardNewCode,
  boardOverall,
  boardPeek,
  boardPinSet,
  boardRecords,
  boardRemove,
  boardRename,
} from '../api/board';
import { BoardError } from '../api/errors';
import { fetchPuzzleCards } from '../api/feed';
import type { BoardView, DayBoard, Overall, Records } from '../types';
import { getPid, loadBoard, saveBoard, setCurrent, setLeagues, useBoardState } from './boardStore';

export const BOARD_QUERY = ['board'] as const;

/** The server's view of this player's leagues, saved as `refresh()` saves it. */
export async function refreshLeagues(): Promise<void> {
  const list = await boardMine(getPid());
  setLeagues(leaguesFromMine(list));
}

/** Ask the server for the leagues again, and redraw every board. */
function refreshAll(qc: QueryClient) {
  return refreshLeagues().finally(() => qc.invalidateQueries({ queryKey: BOARD_QUERY }));
}

/**
 * The board id that player-specific query keys carry (R8), so a board, records table or
 * finish-sheet moment fetched for one player is never shown to another after the install
 * adopts a different identity ("Already in this league?"). '' before one is minted.
 */
export function useBoardPid(): string {
  return useBoardState().pid ?? '';
}

/**
 * Mounted once at the root: when the board id changes, drops every cached answer that was
 * fetched for the old one (their keys carry it).
 */
export function useForgetOldPlayer(): void {
  const pid = useBoardPid();
  const qc = useQueryClient();
  const prev = useRef(pid);
  useEffect(() => {
    const old = prev.current;
    prev.current = pid;
    if (old && old !== pid) qc.removeQueries({ predicate: (q) => q.queryKey.includes(old) });
  }, [pid, qc]);
}

/** This player's leagues from the server (kept in storage, so they show offline too). */
export function useMine(enabled: boolean) {
  const pid = useBoardPid();
  return useQuery({
    queryKey: [...BOARD_QUERY, 'mine', pid],
    queryFn: async () => {
      await refreshLeagues();
      return loadBoard().leagues ?? [];
    },
    enabled: enabled && !!pid,
    retry: 1,
  });
}

/** One league's board for one puzzle (or all eight) on one day. */
export function useBoardData(code: string | undefined, view: BoardView, date: string) {
  const pid = useBoardPid();
  return useQuery<DayBoard | Overall>({
    queryKey: [...BOARD_QUERY, view === 'all' ? 'overall' : 'day', pid, code, view, date],
    queryFn: async () => {
      try {
        return view === 'all'
          ? await boardOverall(getPid(), code!, date)
          : await boardDay(getPid(), code!, view as BoardTypeId, date);
      } catch (e) {
        // Off the league (left, removed, closed, new code): the server's list is the truth.
        if (e instanceof BoardError && (e.code === 'not_member' || e.code === 'no_league'))
          await refreshLeagues().catch(() => {});
        throw e;
      }
    },
    enabled: !!code,
    retry: (n, e) => !(e instanceof BoardError) && n < 2,
  });
}

/**
 * The league's records and honours (the Records pill). A minute fresh, as the site keeps
 * them; off the league is handled as the boards handle it.
 */
export function useBoardRecords(code: string | undefined) {
  const pid = useBoardPid();
  return useQuery<Records>({
    queryKey: [...BOARD_QUERY, 'records', pid, code],
    queryFn: async () => {
      try {
        return await boardRecords(getPid(), code!);
      } catch (e) {
        if (e instanceof BoardError && (e.code === 'not_member' || e.code === 'no_league'))
          await refreshLeagues().catch(() => {});
        throw e;
      }
    },
    enabled: !!code,
    staleTime: 60_000,
    retry: (n, e) => !(e instanceof BoardError) && n < 2,
  });
}

/** An invite's league: its name, size and nicknames. */
export function usePeek(code: string) {
  return useQuery({
    queryKey: [...BOARD_QUERY, 'peek', code],
    queryFn: () => boardPeek(code),
    enabled: !!code,
    retry: (n, e) => !(e instanceof BoardError) && n < 2,
  });
}

/** Puzzle pages from the site's feed-lite.json: names on the board and the history copy. */
export function usePuzzleCards(enabled = true) {
  return useQuery({
    queryKey: ['leagues', 'feed-lite'],
    queryFn: fetchPuzzleCards,
    staleTime: 30 * 60_000,
    enabled,
  });
}

/** Set (or change) this player's PIN. A failure after joining never undoes the join. */
async function setPin(pin: string) {
  await boardPinSet(getPid(), pin);
  await refreshLeagues();
}

export function useCreateLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { name: string; nick: string; pin?: string }) => {
      const l = await boardCreate(getPid(), v.name, v.nick);
      await refreshLeagues();
      setCurrent(l.code);
      if (v.pin) await setPin(v.pin).catch(() => {});
      return l;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOARD_QUERY }),
  });
}

export function useJoinLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { code: string; nick: string; pin?: string }) => {
      const l = await boardJoin(getPid(), v.code, v.nick);
      await refreshLeagues();
      setCurrent(l.code);
      if (v.pin) await setPin(v.pin).catch(() => {});
      return l;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOARD_QUERY }),
  });
}

export function useSetPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setPin,
    onSettled: () => qc.invalidateQueries({ queryKey: BOARD_QUERY }),
  });
}

/** Off the league's boards; nothing is deleted on the server. */
export function useLeaveLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      await boardLeave(getPid(), code);
      await refreshLeagues();
      setCurrent('');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOARD_QUERY }),
  });
}

export type OwnerAction =
  | { act: 'rename'; code: string; name: string }
  | { act: 'new_code'; code: string }
  | { act: 'remove'; code: string; nick: string }
  | { act: 'close'; code: string }
  | { act: 'let_back'; code: string; nick: string };

/** League settings for its owner. Returns the server's answer (let_back: found or not). */
export function useOwnerAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: OwnerAction): Promise<unknown> => {
      const pid = getPid();
      switch (a.act) {
        case 'rename':
          await boardRename(pid, a.code, a.name);
          break;
        case 'new_code': {
          const r = await boardNewCode(pid, a.code);
          setCurrent(r.code);
          break;
        }
        case 'remove':
          await boardRemove(pid, a.code, a.nick);
          break;
        case 'close':
          await boardClose(pid, a.code);
          setCurrent('');
          break;
        case 'let_back':
          return boardLetBack(pid, a.code, a.nick);
      }
      await refreshAll(qc);
      return true;
    },
  });
}

export interface ClaimOutcome {
  nick: string;
  needsPin: boolean;
  pending: boolean;
}

/**
 * "Already in this league?": code, nickname and PIN → the server hands back the player's
 * board id, which this install adopts (dn-board.js claim). If this install already plays
 * in a league as someone else, the choice is left pending for the player.
 */
export function useClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { code: string; nick: string; pin: string }): Promise<ClaimOutcome> => {
      const r: ClaimResult = await boardClaim(v.code, v.nick, v.pin);
      if (!r || !r.ok) throw new BoardError((r && r.error) || 'error');
      const { state, pending } = adoptClaim(loadBoard(), r);
      saveBoard(state);
      if (!pending) {
        await refreshLeagues();
        setCurrent(r.code!);
      }
      return { nick: r.nick!, needsPin: !!r.needs_pin, pending };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOARD_QUERY }),
  });
}

/** "Use my link" or "Keep this one", then the leagues from the server. */
export function useSettlePending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (take: boolean) => {
      const before = loadBoard();
      // "Keep this one" is remembered for that account player (plan R4), so the next sync
      // and a restart don't ask again; "Use my link" makes it this phone's player anyway.
      if (!take && before.pend?.pid) rememberKeep(appStorage, before.pend.pid);
      saveBoard(settlePending(before, take));
      await refreshLeagues().catch(() => {});
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOARD_QUERY }),
  });
}
