/* The Records pill and a player's card (board.html renderRecords, renderCard; data: board_records). */
import { BOARD_TYPES, type BoardLeague, type BoardTypeId } from '@noodle/core';
import { Fragment, type ReactNode } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';

import { dayMonth, inviteLink, inviteText, result } from '../hooks/boardText';
import {
  byFinished,
  HONOURS,
  isCrowned,
  leaders,
  playerLine,
  playerMark,
  RECORDS_HOW,
  recordRows,
} from '../hooks/recordsText';
import type { Records, RecordsPlayer } from '../types';
import { Acts, Btn, Sub } from './ui';

const share = (message: string) => Share.share({ message }).catch(() => {});

/** A record, honour or player row: mark, title, a line under it, the figure on the right. */
function RecRow({
  mark,
  title,
  line,
  big,
  small,
  me,
  label,
  onPress,
  testID,
}: {
  mark: string;
  title: ReactNode;
  line?: ReactNode;
  big: string;
  small?: string;
  me?: boolean;
  label: string;
  onPress?: () => void;
  testID?: string;
}) {
  const t = useTokens();
  const body = (
    <>
      <Text style={[styles.rk, { color: t.muted }]} accessible={false}>
        {mark}
      </Text>
      <View style={styles.who}>
        <Text numberOfLines={1} style={[styles.title, { color: t.ink }]}>
          {title}
        </Text>
        {line ? <Text style={[styles.line, { color: t.faint }]}>{line}</Text> : null}
      </View>
      <View>
        <Text style={[styles.res, { color: t.ink }]}>{big}</Text>
        {small ? <Text style={[styles.resSmall, { color: t.faint }]}>{small}</Text> : null}
      </View>
    </>
  );
  const style = [
    styles.row,
    { borderBottomColor: t.hair },
    me && { backgroundColor: t.accentSoft },
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Shows their card"
      onPress={onPress}
      style={style}
      testID={testID}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label} style={style} testID={testID}>
      {body}
    </View>
  );
}

/** Names that open their card when tapped, joined with commas. */
function Names({ names, open }: { names: string[]; open: (n: string) => void }) {
  const t = useTokens();
  return (
    <>
      {names.map((n, i) => (
        <Fragment key={n}>
          {i ? ', ' : ''}
          <Text
            accessibilityRole="button"
            accessibilityHint="Shows their card"
            onPress={() => open(n)}
            style={[styles.nk, { color: t.accent }]}>
            {n}
          </Text>
        </Fragment>
      ))}
    </>
  );
}

/** The Records pill: each puzzle's record, the honours, and every player. Names open cards. */
export function RecordsView({
  league,
  d,
  card,
  setCard,
}: {
  league: BoardLeague;
  d: Records;
  /** The player whose card is open (a name tapped here or on another board), or none. */
  card: string | null;
  setCard: (nick: string | null) => void;
}) {
  const t = useTokens();
  const player = card ? d.players.find((p) => p.nick === card) : undefined;
  if (player) return <PlayerCard d={d} p={player} onBack={() => setCard(null)} />;

  const recs = recordRows(d);
  return (
    <View testID="records-board">
      <Sub>League records</Sub>
      {recs.length ? (
        <View style={[styles.rows, { borderTopColor: t.hair }]}>
          {recs.map(({ type, emoji, name, r }) => {
            const res = result(type, r);
            const when = `${r.nick} · ${dayMonth(r.date)}${r.date === d.today ? ' · 🏆 today' : ''}`;
            return (
              <RecRow
                key={type}
                testID={`record-${type}`}
                mark={emoji}
                title={name}
                line={when}
                big={res.big}
                small={res.small}
                me={r.me}
                label={`${name} record: ${res.big}${res.small ? `, ${res.small}` : ''}, ${when}`}
                onPress={() => setCard(r.nick)}
              />
            );
          })}
        </View>
      ) : (
        <Text style={[styles.empty, { color: t.muted }]} testID="records-empty">
          No records yet: finish a puzzle to set the first.
        </Text>
      )}

      <Sub>Honours</Sub>
      <View style={[styles.rows, { borderTopColor: t.hair }]}>
        {HONOURS.map((h) => {
          const { top, who } = leaders(d.players, h.k);
          const big = top ? h.unit(top) : '–';
          return (
            <RecRow
              key={h.k}
              testID={`honour-${h.k}`}
              mark={h.e}
              title={h.name}
              line={who.length ? <Names names={who} open={setCard} /> : 'Nobody yet'}
              big={big}
              label={`${h.name}: ${who.length ? `${who.join(', ')}, ${big}` : 'nobody yet'}`}
            />
          );
        })}
      </View>

      <Sub>Players</Sub>
      <View style={[styles.rows, { borderTopColor: t.hair }]}>
        {byFinished(d.players).map((p) => {
          const crown = isCrowned(d, p.nick);
          return (
            <RecRow
              key={p.nick}
              testID={`player-${p.nick}`}
              mark={playerMark(p)}
              title={
                <>
                  {p.nick}
                  {crown ? ' 👑' : ''}
                  {p.me ? <Text style={[styles.you, { color: t.accent }]}> YOU</Text> : null}
                </>
              }
              line={playerLine(p)}
              big={String(p.completed)}
              small="finished"
              me={p.me}
              label={`${p.nick}${p.me ? ' (you)' : ''}${crown ? ', last week’s champion' : ''}: ${playerLine(p)}, ${p.completed} finished`}
              onPress={() => setCard(p.nick)}
            />
          );
        })}
      </View>

      <Text style={[styles.how, { color: t.faint }]}>{RECORDS_HOW}</Text>
      <Acts>
        <Btn
          kind="go"
          label="Invite people"
          onPress={() => void share(`${inviteText(league.name)}\n${inviteLink(league.code)}`)}
        />
      </Acts>
    </View>
  );
}

/** One player's card: their honours, then their best on each puzzle (🏅 where it's the record). */
function PlayerCard({ d, p, onBack }: { d: Records; p: RecordsPlayer; onBack: () => void }) {
  const t = useTokens();
  const crown = isCrowned(d, p.nick);
  return (
    <View testID="player-card">
      <Text accessibilityRole="header" style={[styles.cardName, { color: t.ink }]}>
        {p.nick}
        {crown ? ' 👑' : ''}
        {p.me ? <Text style={[styles.you, { color: t.accent }]}> YOU</Text> : null}
      </Text>
      {crown ? <Text style={[styles.champ, { color: t.muted }]}>Last week’s champion.</Text> : null}
      <View style={styles.grid}>
        {HONOURS.map((h) => (
          <View
            key={h.k}
            accessible
            accessibilityLabel={`${h.name}: ${p[h.k] || 0}`}
            style={[styles.cell, { borderColor: t.hair }]}
            testID={`card-${h.k}`}>
            <Text style={[styles.cellBig, { color: t.ink }]}>{String(p[h.k] || 0)}</Text>
            <Text style={[styles.cellName, { color: t.faint }]}>
              {h.e} {h.name}
              {h.k === 'longest' || h.k === 'current' ? ' (days)' : ''}
            </Text>
          </View>
        ))}
      </View>
      <Sub>Bests</Sub>
      <View style={[styles.rows, { borderTopColor: t.hair }]}>
        {BOARD_TYPES.map((ty) => {
          const id = ty.id as BoardTypeId;
          const b = p.bests?.[id];
          const st = p.streaks?.[id] ?? 0;
          const holds = d.records?.[id]?.nick === p.nick;
          const res = b ? result(id, b) : null;
          const line =
            (b ? `${dayMonth(b.date)}${holds ? ' · 🏅 league record' : ''}` : 'Not finished yet') +
            (st > 1 ? ` · best streak ${st}` : '');
          return (
            <RecRow
              key={id}
              testID={`best-${id}`}
              mark={ty.emoji}
              title={ty.name}
              line={line}
              big={res ? res.big : '–'}
              small={res?.small}
              label={`${ty.name}: ${res ? `${res.big}${res.small ? `, ${res.small}` : ''}, ` : ''}${line}`}
            />
          );
        })}
      </View>
      <Acts>
        <Btn label="← Back" onPress={onBack} testID="card-back" />
      </Acts>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: 10, borderTopWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 52,
  },
  rk: { fontFamily: FONT.displayHeavy, width: 34, textAlign: 'center', fontSize: 17 },
  who: { flex: 1, minWidth: 0 },
  title: { fontFamily: FONT.bodySemi, fontSize: 16 },
  line: { fontFamily: FONT.body, fontSize: 12.5, marginTop: 1 },
  nk: { fontFamily: FONT.bodySemi, textDecorationLine: 'underline' },
  you: { fontFamily: FONT.bodyBold, fontSize: 11, letterSpacing: 0.7 },
  res: {
    fontFamily: FONT.display,
    fontSize: 17,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  resSmall: { fontFamily: FONT.body, fontSize: 12, textAlign: 'right' },
  empty: { fontFamily: FONT.body, marginTop: 10, fontSize: 14.5 },
  how: { fontFamily: FONT.body, marginTop: 14, fontSize: 13 },
  cardName: { fontFamily: FONT.displayHeavy, fontSize: 26, marginTop: 14 },
  champ: { fontFamily: FONT.body, fontSize: 14.5, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  cell: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 10, padding: 10 },
  cellBig: { fontFamily: FONT.displayHeavy, fontSize: 22, fontVariant: ['tabular-nums'] },
  cellName: { fontFamily: FONT.body, fontSize: 12.5, marginTop: 2 },
});
