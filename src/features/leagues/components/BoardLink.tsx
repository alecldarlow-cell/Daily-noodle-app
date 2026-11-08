/**
 * The league line in the finish sheet's board slot: the reward block's second line in
 * Alec's design B3 (8 Nov 2026), rank only, no names. In a league, for the league last
 * viewed, one tap target ending in an accent "See board ›":
 *   today's puzzle: "1st in Noodlers today" from board_day's own `me` row once the result
 *     has reached the board; "Noodlers board today" until then; "Not placed in Noodlers
 *     today" when the round was lost or has no rank (failed, revealed);
 *   an earlier day's puzzle: "Noodlers board for Thu 5 Nov";
 *   a league record (board_moment): "New league record in Noodlers" ("League record" on an
 *     earlier day), and the share line is tagged 🏆, as dn-board.js does.
 * It opens the Leagues tab on that league, puzzle and day, as board.html?p=&d=. Standing
 * alone (no personal best or streak above it, `lead`), a podium place leads with its disc,
 * which pops and shines only on a fresh finish. Not in a league: no line.
 */
import { boardTypeOfPath, dateOfPath, type BoardTypeId } from '@noodle/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { BoardSlotProps } from '@/shared/finish-sheet';
import { FONT, usePuzzleTokens, useTokens } from '@/shared/theme';
import { shortDate, useLondonDay } from '@/shared/time';
import { pressable } from '@/shared/ui';

import { boardDay, boardMoment } from '../api/board';
import { currentLeague, getPid, setCurrent, useBoardState } from '../hooks/boardStore';
import { momentLine } from '../hooks/boardText';
import { myRank, placeLine } from '../hooks/rankText';
import { leaguesParams } from '../hooks/useLeaguesFlow';
import { onSubmission, submissionOf } from '../hooks/submissions';
import { isPlace, PlaceMedal } from './PlaceMedal';

export function BoardLink({ path, onTag, solved = true, celebrate = false, lead }: BoardSlotProps) {
  const s = useBoardState();
  const league = currentLeague(s);
  const T = /^reports\//.test(path) ? boardTypeOfPath(path) : null;
  if (!T || !league) return null;
  return (
    <MemberLink
      path={path}
      onTag={onTag}
      typeId={T.id}
      typeName={T.name}
      pid={s.pid ?? ''}
      code={league.code}
      leagueName={league.name}
      solved={solved}
      celebrate={celebrate}
      lead={!!lead}
    />
  );
}

function MemberLink({
  path,
  onTag,
  typeId,
  typeName,
  pid,
  code,
  leagueName,
  solved,
  celebrate,
  lead,
}: {
  path: string;
  onTag: (tag: string) => void;
  typeId: BoardTypeId;
  typeName: string;
  /** In the key, so another player's answer is never reused (R8). */
  pid: string;
  /** The league the line names: the one last viewed (board state's `cur`), else the first. */
  code: string;
  leagueName: string;
  solved: boolean;
  celebrate: boolean;
  lead: boolean;
}) {
  const today = useLondonDay();
  const pt = usePuzzleTokens();
  const t = useTokens();
  const pdate = dateOfPath(path);
  const isToday = !pdate || pdate >= today;
  // A new submission of this puzzle (it finished again while the sheet shows) asks again.
  const n = useSyncExternalStore(onSubmission, () => submissionOf(path).n);
  // The player's rank in that league, once the result has reached the board.
  const rank = useQuery({
    queryKey: ['leagues', 'rank', pid, code, path, n],
    queryFn: async () => {
      await submissionOf(path).done;
      return boardDay(getPid(), code, typeId, pdate ?? today);
    },
    retry: false,
    staleTime: 60_000,
    enabled: isToday && solved,
  });
  const place = rank.isSuccess ? myRank(rank.data) : null;
  const q = useQuery({
    queryKey: ['leagues', 'moment', pid, path, n],
    queryFn: async () => {
      await submissionOf(path).done;
      return boardMoment(getPid(), path);
    },
    retry: false,
    // A record can be beaten later: a reopened sheet asks again after a minute (R8).
    staleTime: 60_000,
  });
  const moment = q.isSuccess ? momentLine(q.data, typeName, pdate === today) : null;
  const record = !!moment?.record;
  // The share line carries 🏆 only while the line shows a record: a record beaten since (asked
  // again after a minute), another player, or leaving the league takes it off (review 30 Oct).
  useEffect(() => {
    if (!record) return;
    onTag('🏆');
    return () => onTag('');
  }, [record, onTag]);

  const text = record
    ? moment!.text.replace(/^🏆 /, '').replace(/!$/, '')
    : !isToday
      ? `${leagueName} board for ${shortDate(pdate!)}`
      : !solved || (rank.isSuccess && place === null)
        ? `Not placed in ${leagueName} today`
        : place !== null
          ? placeLine(place, leagueName)
          : `${leagueName} board today`;
  const medal = lead && isToday && solved && isPlace(place) ? place : null;

  // That league's board, on this puzzle and day (dn-board.js setCurrent, then board.html):
  // back down to the tabs (not a second copy pushed over the puzzle), on Leagues; a fresh
  // `n` each tap, so it opens this board even if Leagues was last asked for the same one.
  const open = () => {
    setCurrent(code);
    router.dismissTo({
      pathname: '/leagues',
      params: leaguesParams({ p: typeId, d: pdate }),
    });
  };
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${text}. See board`}
      onPress={open}
      style={pressable(styles.link)}
      testID="board-slot">
      {medal ? (
        <PlaceMedal
          place={medal}
          shine={celebrate ? { key: `finish:${code}:${path}`, day: today } : undefined}
          testID="board-medal"
        />
      ) : null}
      <Text style={[styles.text, { color: pt.sheetSoft }]} testID="board-line">
        {text}
        {' · '}
        <Text style={[styles.see, { color: t.accent }]}>See board ›</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
  },
  text: { fontSize: 14, lineHeight: 20, fontFamily: FONT.sans, flexShrink: 1 },
  see: { fontFamily: FONT.sansSemi },
});
