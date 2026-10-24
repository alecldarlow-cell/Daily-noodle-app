/**
 * The board's saved state, `noodle-board-v1`, in exactly the browser's shape
 * (`{pid, leagues: [{code, name, nick, owner}], cur, ptype, fill: {n, aids}}`), kept in the
 * app's store. Read and written through @noodle/core's ports of dn-board.js.
 */
import {
  BOARD_KEY,
  boardPid,
  readBoard,
  writeBoard,
  type BoardLeague,
  type BoardState,
} from '@noodle/core';
import { uuid } from 'expo';
import { useMemo } from 'react';

import { appStorage, useStoredRaw, type CachedStorage } from '@/shared/storage';

export function loadBoard(store: CachedStorage = appStorage): BoardState {
  return readBoard(store);
}

export function saveBoard(s: BoardState, store: CachedStorage = appStorage): void {
  writeBoard(store, s);
}

/** Change some fields of the saved state, keeping the rest. */
export function patchBoard(patch: Partial<BoardState>, store: CachedStorage = appStorage): void {
  saveBoard({ ...loadBoard(store), ...patch }, store);
}

/** The board id: a random uuid v4 minted on first use, as dn-board.js pid(). Never shown. */
export function getPid(store: CachedStorage = appStorage): string {
  return boardPid(store, () => uuid.v4());
}

export function setLeagues(list: BoardLeague[], store: CachedStorage = appStorage): void {
  patchBoard({ leagues: list || [] }, store);
}

export function setCurrent(code: string, store: CachedStorage = appStorage): void {
  patchBoard({ cur: code }, store);
}

export function setLastType(t: string, store: CachedStorage = appStorage): void {
  patchBoard({ ptype: t }, store);
}

/** The saved state, re-rendering whenever it changes. */
export function useBoardState(store: CachedStorage = appStorage): BoardState {
  const raw = useStoredRaw(BOARD_KEY, store);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read when the stored text changes
  return useMemo(() => readBoard(store), [raw, store]);
}

/** The league shown: the current one, else the first, as board.html cur(). */
export function currentLeague(s: BoardState): BoardLeague | null {
  const ls = s.leagues || [];
  return ls.find((l) => l.code === s.cur) ?? ls[0] ?? null;
}

export const hasPin = (s: BoardState) => (s.leagues || []).some((l) => l.pin);
