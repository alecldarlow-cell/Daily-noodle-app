/**
 * The personal link both ways. Pasting one merges its saves into this install by the
 * site's rules (finished puzzles add up, first result kept, the better streak wins) and
 * adopts its board, or leaves a choice pending if this install plays as someone else.
 * Sending one packs this install's saves and board, exactly as the site's moveLink.
 */
import { importMove, packMove, trackerIds, unpackMove } from '@noodle/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Share } from 'react-native';

import { appStorage } from '@/shared/storage';

import { getPid, loadBoard, patchBoard } from './boardStore';
import { BOARD_QUERY, refreshLeagues } from './useLeagues';

export const NOT_A_LINK = 'That doesn’t look like your link. Copy the whole link and try again.';
export const KEY_TEXT =
  'My Daily Noodle link. Open it where I play to bring my leagues, results and streaks there. (It’s my key: not for sharing.)';

export type Arrival =
  /** Took over the link's player (or already was them): "Your leagues are here now". */
  | { kind: 'moved' }
  /** This install plays as someone else: "Which leagues should this browser use?" */
  | { kind: 'pending' };

/** Bring a pasted personal link's saves and leagues into this install. */
export function useImportLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string): Promise<Arrival> => {
      const p = unpackMove(text);
      if (!p) throw new Error(NOT_A_LINK);
      importMove(appStorage, p);
      const s = loadBoard();
      // The page reads `moved` once (dn-board.js moved()).
      if (s.moved) patchBoard({ moved: undefined });
      if (s.pend) return { kind: 'pending' };
      await refreshLeagues().catch(() => {});
      return { kind: 'moved' };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BOARD_QUERY }),
  });
}

/** This install's personal link. */
export function myLink(): string {
  const pid = getPid();
  const s = loadBoard();
  return packMove(
    appStorage,
    appStorage.keys(),
    { pid, cur: s.cur, leagues: s.leagues as never },
    trackerIds(appStorage)[0],
  );
}

/** "Send me my link": the phone's share sheet with the link and the site's warning. */
export function shareMyLink(): Promise<unknown> {
  return Share.share({ message: `${KEY_TEXT}\n${myLink()}` }).catch(() => {});
}
