/* One board row, the "not played yet" line and the Share button under a board. */
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { Button } from '@/shared/ui';

import type { NotYet } from '../types';
import { RecordsCtx } from './boardShared';
import { isPlace, PlaceMedal, placeTint } from './PlaceMedal';
import { ROW_INSET_RIGHT } from './ui';

export function Row({
  rank,
  nick,
  me,
  big,
  small,
  streak,
  dim,
  record,
  place,
  shine,
}: {
  rank: string;
  nick: string;
  me: boolean;
  big: string;
  small?: string;
  streak?: number;
  dim?: boolean;
  /** This result is the league's record (set on the day shown). */
  record?: boolean;
  /** 1–3: shown as a medal disc instead of the number. */
  place?: number | null;
  /** Your podium place on today's board: pop and shine the medal once (see PlaceMedal). */
  shine?: { key: string; day: string };
}) {
  const t = useTokens();
  const { open } = useContext(RecordsCtx);
  const medal = !dim && isPlace(place) ? place : null;
  const label = `${rank} ${nick}${me ? ' (you)' : ''}, ${big}${small ? `, ${small}` : ''}${record ? ', new league record' : ''}`;
  const style = [
    styles.row,
    { borderBottomColor: t.hair },
    me && { backgroundColor: medal ? placeTint(medal) : t.accentSoft },
  ];
  const Box = open ? Pressable : View;
  return (
    <Box
      accessible
      accessibilityRole={open ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={open ? 'Shows their card' : undefined}
      onPress={open ? () => open(nick) : undefined}
      testID={`row-${nick}`}
      style={style}>
      {medal ? (
        <View style={styles.rkBox}>
          <PlaceMedal
            place={medal}
            shine={me ? shine : undefined}
            testID={`medal-${medal}-${nick}`}
          />
        </View>
      ) : (
        <Text style={[styles.rk, { color: t.muted }]}>{rank}</Text>
      )}
      <View style={styles.who}>
        <Text numberOfLines={1} style={[styles.nick, { color: dim ? t.muted : t.ink }]}>
          {nick}
          {me ? <Text style={[styles.you, { color: t.accent }]}> YOU</Text> : null}
        </Text>
        {record ? (
          <Text style={[styles.st, { color: t.faint }]} testID={`new-record-${nick}`}>
            🏆 New league record
          </Text>
        ) : null}
        {streak && streak > 1 ? (
          <Text style={[styles.st, { color: t.faint }]}>🔥 {streak}-day streak</Text>
        ) : null}
      </View>
      <View>
        <Text style={[styles.res, { color: dim ? t.muted : t.ink }]}>{big}</Text>
        {small ? <Text style={[styles.resSmall, { color: t.faint }]}>{small}</Text> : null}
      </View>
    </Box>
  );
}

/**
 * Under the board, one small line: who hasn't played yet. (Alec, 7 Nov 2026: last week's
 * champion is no longer shown anywhere; the data stays.)
 */
export function NotesLine({ rows }: { rows: NotYet[] }) {
  const t = useTokens();
  if (!rows.length) return null;
  return (
    <Text style={[styles.notes, { color: t.muted }]} testID="board-notes">
      Not played yet: {rows.map((r) => `${r.nick}${r.me ? ' (you)' : ''}`).join(', ')}
    </Text>
  );
}

/**
 * The one action under a board (Alec, 7 Nov 2026): a quiet, compact Share; Invite and League
 * settings live in the league menu.
 */
export function ShareBtn({ onPress }: { onPress: () => unknown }) {
  return (
    <View style={styles.shareRow} testID="share-board">
      <Button variant="tonal" label="Share leaderboard" onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Room round the one action (Alec, 7 Nov 2026: it felt cramped).
  shareRow: { flexDirection: 'row', marginTop: 24, marginBottom: 32 },
  notes: { fontFamily: FONT.body, marginTop: 12, fontSize: 13.5, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingLeft: 2,
    paddingRight: ROW_INSET_RIGHT,
    borderBottomWidth: 1,
  },
  rk: { fontFamily: FONT.displayHeavy, width: 34, textAlign: 'center', fontSize: 17 },
  rkBox: { width: 34, alignItems: 'center' },
  who: { flex: 1, minWidth: 0 },
  nick: { fontFamily: FONT.bodySemi, fontSize: 16 },
  you: { fontFamily: FONT.bodyBold, fontSize: 11, letterSpacing: 0.7 },
  st: { fontFamily: FONT.body, fontSize: 12.5, marginTop: 1 },
  res: {
    fontFamily: FONT.display,
    fontSize: 17,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  resSmall: { fontFamily: FONT.body, fontSize: 12, textAlign: 'right' },
});
