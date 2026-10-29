/**
 * "See today's board" in the finish sheet's board slot (dn-board.js, on a puzzle page):
 * members only. Once the result has reached the board (this path's submission settled,
 * or at once on a reopened puzzle), board_moment says whether it's a league record or a
 * personal best; the line goes above the link, and a league record tags the share line
 * with 🏆. The link opens the Leagues tab on that puzzle and day, as board.html?p=&d=.
 */
import { boardTypeOfPath, dateOfPath } from '@noodle/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BoardSlotProps } from '@/shared/finish-sheet';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { useLondonDay } from '@/shared/time';

import { boardMoment } from '../api/board';
import { getPid, useBoardState } from '../hooks/boardStore';
import { momentLine } from '../hooks/boardText';
import { leaguesParams } from '../hooks/useLeaguesFlow';
import { onSubmission, submissionOf } from '../hooks/submissions';

export function BoardLink({ path, onTag }: BoardSlotProps) {
  const s = useBoardState();
  const member = (s.leagues || []).length > 0;
  const T = /^reports\//.test(path) ? boardTypeOfPath(path) : null;
  if (!member || !T) return null;
  return <MemberLink path={path} onTag={onTag} typeId={T.id} typeName={T.name} pid={s.pid ?? ''} />;
}

function MemberLink({
  path,
  onTag,
  typeId,
  typeName,
  pid,
}: {
  path: string;
  onTag: (tag: string) => void;
  typeId: string;
  typeName: string;
  /** In the key, so another player's answer is never reused (R8). */
  pid: string;
}) {
  const pt = usePuzzleTokens();
  const today = useLondonDay();
  const pdate = dateOfPath(path);
  // A new submission of this puzzle (it finished again while the sheet shows) asks again.
  const n = useSyncExternalStore(onSubmission, () => submissionOf(path).n);
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
  useEffect(() => {
    if (record) onTag('🏆');
  }, [record, onTag]);

  // Back down to the tabs (not a second copy pushed over the puzzle), on Leagues; a fresh
  // `n` each tap, so it opens this board even if Leagues was last asked for the same one.
  const open = () =>
    router.dismissTo({
      pathname: '/leagues',
      params: leaguesParams({ p: typeId, d: pdate }),
    });
  return (
    <View style={styles.slot} testID="board-slot">
      {line ? (
        <Text style={[styles.moment, { color: pt.ink }]} testID="board-moment">
          {line.text}
        </Text>
      ) : null}
      <Pressable accessibilityRole="link" onPress={open} hitSlop={4} style={styles.link}>
        <Text style={[styles.linkText, { color: pt.actInk }]}>🏆 See today’s board</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // finish.css .fin-board-slot: its room is kept so nothing below jumps.
  slot: { minHeight: 48, marginTop: 4 },
  moment: { fontSize: 15, lineHeight: 20, fontFamily: FONT.display, marginTop: 10 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 4 },
  linkText: { fontSize: 15, fontFamily: FONT.sansSemi },
});
