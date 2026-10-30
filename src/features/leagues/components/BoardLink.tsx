/**
 * The league line in the finish sheet's board slot (dn-board.js, AF-019 and AF-022; Alec,
 * 28 Oct 2026: rank only, no names). In a league: "Currently 1st in Noodlers ›" /
 * "Currently 3rd of 6 in Noodlers ›" for the league last viewed, from board_day's own `me`
 * row once the result has reached the board ("currently": others may still play today);
 * "See today’s board in Noodlers ›" until then, or when the round has no rank (failed,
 * revealed). It opens the Leagues tab on that league, puzzle and day, as board.html?p=&d=.
 * Not in a league: "Start a league with friends ›", opening Leagues' start form. The
 * app's own line trophy (the Leagues tab's icon), no emoji.
 *
 * Members also get board_moment's record or personal-best line above it, and a league
 * record tags the share line with 🏆.
 */
import { boardTypeOfPath, dateOfPath, type BoardTypeId } from '@noodle/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BoardSlotProps } from '@/shared/finish-sheet';
import { FONT, usePuzzleTokens, useTokens } from '@/shared/theme';
import { useLondonDay } from '@/shared/time';
import { Chevron, pressable } from '@/shared/ui';

import { boardDay, boardMoment } from '../api/board';
import { currentLeague, getPid, setCurrent, useBoardState } from '../hooks/boardStore';
import { momentLine } from '../hooks/boardText';
import { rankLine } from '../hooks/rankText';
import { leaguesParams } from '../hooks/useLeaguesFlow';
import { onSubmission, submissionOf } from '../hooks/submissions';

export function BoardLink({ path, onTag }: BoardSlotProps) {
  const s = useBoardState();
  const league = currentLeague(s);
  const T = /^reports\//.test(path) ? boardTypeOfPath(path) : null;
  if (!T) return null;
  if (!league) return <StartLine />;
  return (
    <MemberLink
      path={path}
      onTag={onTag}
      typeId={T.id}
      typeName={T.name}
      pid={s.pid ?? ''}
      code={league.code}
      leagueName={league.name}
    />
  );
}

/** One tappable line with the trophy and a chevron (finish.css .fin-board-slot .nn-board-link). */
function TrophyLine({ text, onPress }: { text: string; onPress: () => void }) {
  const pt = usePuzzleTokens();
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={text}
      onPress={onPress}
      style={pressable(styles.link)}
      testID="board-line">
      <SymbolView
        name={{ ios: 'trophy', android: 'trophy' }}
        size={22}
        tintColor={t.accent}
        accessible={false}
        importantForAccessibility="no"
        testID="board-trophy"
      />
      <Text style={[styles.linkText, { color: pt.ink }]}>{text}</Text>
      <Chevron color={pt.sheetSoft} size={7} />
    </Pressable>
  );
}

/** Not in a league (AF-022): a quiet invitation, no account needed. */
function StartLine() {
  const open = () =>
    router.dismissTo({ pathname: '/leagues', params: leaguesParams({ go: 'start' }) });
  return (
    <View style={styles.slot} testID="board-slot">
      <TrophyLine text="Start a league with friends" onPress={open} />
    </View>
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
}) {
  const today = useLondonDay();
  const pt = usePuzzleTokens();
  const pdate = dateOfPath(path);
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
  });
  const ranked = rank.isSuccess ? rankLine(rank.data, leagueName) : null;
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
  const line = q.isSuccess ? momentLine(q.data, typeName, pdate === today) : null;
  const record = !!line?.record;
  // The share line carries 🏆 only while the line shows a record: a record beaten since (asked
  // again after a minute), another player, or leaving the league takes it off (review 30 Oct).
  useEffect(() => {
    if (!record) return;
    onTag('🏆');
    return () => onTag('');
  }, [record, onTag]);

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
    <View style={styles.slot} testID="board-slot">
      {line ? (
        <Text style={[styles.moment, { color: pt.ink }]} testID="board-moment">
          {line.text}
        </Text>
      ) : null}
      <TrophyLine text={ranked ?? `See today’s board in ${leagueName}`} onPress={open} />
    </View>
  );
}

const styles = StyleSheet.create({
  // finish.css .fin-board-slot: its room is kept so nothing below jumps.
  slot: { minHeight: 52 },
  moment: { fontSize: 15, lineHeight: 20, fontFamily: FONT.sansSemi, marginBottom: 2 },
  link: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
  },
  linkText: { fontSize: 16, lineHeight: 21, fontFamily: FONT.sansSemi, flexShrink: 1 },
});
