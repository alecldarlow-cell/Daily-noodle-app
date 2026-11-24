/* A league's boards for one day: a puzzle's (DayView) and All puzzles with the week (OverallView). */
import { BOARD_TYPE, type BoardLeague, type BoardTypeId } from '@noodle/core';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pushPuzzle } from '@/shared/played';
import { FONT, useTokens } from '@/shared/theme';

import {
  MEDAL,
  pts,
  result,
  shareAll,
  shareDay,
  dayCount,
  weekDays,
  weekLabel,
} from '../hooks/boardText';
import type { DayBoard, DayRow, Overall, OverallRow } from '../types';
import { DayLine } from './BoardControls';
import { NotesLine, Row, ShareBtn } from './BoardRows';
import { RecordsCtx, share } from './boardShared';
import { Sub } from './ui';

export function DayView({
  league,
  type,
  d,
  date,
  today,
  setDate,
  headline,
  path,
  showDay,
}: {
  league: BoardLeague;
  type: BoardTypeId;
  d: DayBoard;
  date: string;
  today: string;
  setDate: (d: string) => void;
  headline: string | null;
  path: string | null;
  /** The date line, only while looking back (the pager says which day). */
  showDay: boolean;
}) {
  const t = useTokens();
  const T = BOARD_TYPE[type];
  const played = [...d.ranked, ...d.unranked].some((r) => r.me);
  const { recs } = useContext(RecordsCtx);
  const R = recs?.records?.[type];
  const row = (r: DayRow, dim: boolean) => {
    const res = result(type, r);
    return (
      <Row
        key={`${dim ? 'u' : 'r'}${r.nick}`}
        rank={dim ? '–' : (MEDAL[r.rank!] ?? String(r.rank))}
        nick={r.nick}
        me={r.me}
        big={res.big}
        small={res.small}
        streak={r.streak}
        dim={dim}
        record={!dim && !!R && R.nick === r.nick && R.date === date}
        place={r.rank}
        shine={date === today ? { key: `${league.code}:${type}`, day: today } : undefined}
      />
    );
  };
  const file = path?.replace(/^reports\//, '').replace(/\.html$/, '');
  return (
    <View testID="day-board">
      {showDay ? (
        <DayLine date={date} first={d.first || date} today={today} setDate={setDate} />
      ) : null}
      {!played && headline && file ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => pushPuzzle({ pathname: '/play/[type]/[file]', params: { type, file } })}
          style={[styles.play, { backgroundColor: t.accentSoft }]}>
          <Text style={[styles.playText, { color: t.ink }]}>You haven’t played this one yet.</Text>
          <Text style={[styles.playLink, { color: t.accent }]}>Play {headline} →</Text>
        </Pressable>
      ) : null}
      {!d.ranked.length && !d.unranked.length ? (
        <Text style={[styles.nobody, { color: t.muted }]}>
          Nobody in {league.name} has played {T.name} {date === today ? 'yet today' : 'on this day'}
          .
        </Text>
      ) : (
        <View style={styles.rowsTop}>
          {d.ranked.map((r) => row(r, false))}
          {d.unranked.map((r) => row(r, true))}
        </View>
      )}
      <NotesLine rows={d.not_yet} />
      {d.ranked.length ? (
        <ShareBtn onPress={() => share(shareDay(type, headline, date, d.ranked, league))} />
      ) : null}
    </View>
  );
}

export function OverallView({
  league,
  d,
  date,
  today,
  setDate,
  showDay,
}: {
  league: BoardLeague;
  d: Overall;
  date: string;
  today: string;
  setDate: (d: string) => void;
  showDay: boolean;
}) {
  const t = useTokens();
  const row = (r: OverallRow, of: number, shine?: { key: string; day: string }) => (
    <Row
      key={r.nick}
      rank={MEDAL[r.rank] ?? String(r.rank)}
      nick={r.nick}
      me={r.me}
      big={pts(r.points)}
      small={`${r.completed} of ${of} done`}
      place={r.rank}
      shine={shine}
    />
  );
  const dayShine = date === today ? { key: `${league.code}:all`, day: today } : undefined;
  return (
    <View testID="overall-board">
      {showDay ? (
        <DayLine date={date} first={d.first || date} today={today} setDate={setDate} />
      ) : null}
      {!d.day.length ? (
        <Text style={[styles.nobody, { color: t.muted }]}>
          Nobody in {league.name} has played {date === today ? 'yet today' : 'on this day'}.
        </Text>
      ) : (
        <View style={styles.rowsTop}>{d.day.map((r) => row(r, dayCount(date), dayShine))}</View>
      )}
      <NotesLine rows={d.not_yet} />
      <Sub>This week · {weekLabel(d.week_from, d.week_to)}</Sub>
      {!d.week.length ? (
        <Text style={[styles.notyet, { color: t.muted }]}>No results yet this week.</Text>
      ) : (
        <View style={[styles.rows, { borderTopColor: t.hair }]}>
          {d.week.map((r) => row(r, weekDays(date, d.week_from)))}
        </View>
      )}
      <Text style={[styles.how, { color: t.faint }]}>
        Each puzzle you finish scores 1 point for every player you beat. Equal points: more puzzles
        finished goes first.
      </Text>
      {d.day.length ? <ShareBtn onPress={() => share(shareAll(date, d.day, league))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nobody: {
    fontFamily: FONT.body,
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 10,
    fontSize: 15,
  },
  play: { marginTop: 10, marginBottom: 4, padding: 12, borderRadius: 10, gap: 4 },
  playText: { fontFamily: FONT.body, fontSize: 14.5 },
  playLink: { fontFamily: FONT.bodyBold, fontSize: 14.5 },
  // The leaderboard is the key information: room above and below it.
  rows: { marginTop: 14, marginBottom: 6, borderTopWidth: 1 },
  // The table straight under the pager: no rule of its own (the pager's is above it) and
  // close to the dots (Alec, 7 Nov 2026).
  rowsTop: { marginTop: 2, marginBottom: 6 },
  notyet: { fontFamily: FONT.body, marginTop: 6, fontSize: 14.5 },
  how: { fontFamily: FONT.body, marginTop: 14, fontSize: 13 },
});
