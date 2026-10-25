/* A league's boards: league picker, puzzle pills, day bar, rows, actions and settings (board.html). */
import { BOARD_TYPE, BOARD_TYPES, type BoardLeague, type BoardTypeId } from '@noodle/core';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { appStorage, useStoredRaw } from '@/shared/storage';
import { useTokens } from '@/shared/theme';
import { shortDate, useLondonDay } from '@/shared/time';

import { hasPin, setCurrent, setLastType, useBoardState } from '../hooks/boardStore';
import {
  addDays,
  dayName,
  inviteLink,
  inviteText,
  MEDAL,
  pts,
  puzzleOn,
  result,
  shareAll,
  shareDay,
  weekDays,
  weekLabel,
} from '../hooks/boardText';
import { shareMyLink } from '../hooks/useHandoff';
import type { Flow, Notice } from '../hooks/useLeaguesFlow';
import { useBoardData, useLeaveLeague, useOwnerAction, usePuzzleCards } from '../hooks/useLeagues';
import { useBackfill } from '../hooks/useResults';
import { leagueNameSchema, firstError } from '../schemas';
import type { BoardView, DayBoard, DayRow, NotYet, Overall, OverallRow } from '../types';
import { Acts, B, Btn, Card, Field, Msg, P, Sub } from './ui';

const PILLS: { id: BoardView; emoji: string; name: string }[] = [
  { id: 'all', emoji: '🏆', name: 'All puzzles' },
  ...BOARD_TYPES.map((t) => ({ id: t.id as BoardView, emoji: t.emoji, name: t.name })),
];
const isView = (v: unknown): v is BoardView =>
  v === 'all' || (typeof v === 'string' && v in BOARD_TYPE);

/** "Later" on the PIN card, for the rest of the London day (the site's key). */
const PIN_LATER = 'noodle-board-pinlater';

const share = (message: string) => Share.share({ message }).catch(() => {});

export function Board({ flow, league }: { flow: Flow; league: BoardLeague }) {
  const t = useTokens();
  const today = useLondonDay();
  const s = useBoardState();
  // The route's puzzle and day (board.html ?p=&d=), until a pill is picked; else the last pill.
  const { pick: asked } = flow;
  const [chosen, setChosen] = useState<BoardView | null>(asked.view);
  const [date, setDate] = useState(asked.date ?? today);
  const [seen, setSeen] = useState(asked.key);
  if (asked.key !== seen) {
    setSeen(asked.key);
    setChosen(asked.view);
    setDate(asked.date ?? today);
  }
  const view: BoardView = chosen ?? (isView(s.ptype) ? s.ptype : 'all');
  const day = date > today ? today : date;
  const cards = usePuzzleCards();
  const feed = cards.isPending ? undefined : (cards.data ?? []);
  const { filling } = useBackfill(true, feed, s.pid);
  const data = useBoardData(filling ? undefined : league.code, view, day);

  const pick = (v: BoardView) => {
    setChosen(null);
    setLastType(v);
  };

  return (
    <View testID="league-board">
      <LeagueBar flow={flow} league={league} leagues={s.leagues || []} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}>
        {PILLS.map((p) => {
          const on = p.id === view;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={p.name}
              testID={`pill-${p.id}`}
              onPress={() => pick(p.id)}
              style={[
                styles.pill,
                { borderColor: on ? t.ink : t.hair, backgroundColor: on ? t.ink : t.paper },
              ]}>
              <Text style={[styles.pillText, { color: on ? t.canvas : t.ink }]}>
                {p.emoji} {p.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <TopCard flow={flow} league={league} />

      {filling ? (
        <Text style={[styles.loading, { color: t.faint }]}>Adding your earlier results…</Text>
      ) : data.isPending ? (
        <ActivityIndicator style={styles.spin} color={t.muted} />
      ) : data.isError || !data.data ? (
        <Text style={[styles.nobody, { color: t.muted }]} testID="board-error">
          Couldn’t load the board. {data.error instanceof Error ? data.error.message : ''}
        </Text>
      ) : view === 'all' ? (
        <OverallView
          league={league}
          d={data.data as Overall}
          date={day}
          today={today}
          setDate={setDate}
        />
      ) : (
        <DayView
          league={league}
          type={view}
          d={data.data as DayBoard}
          date={day}
          today={today}
          setDate={setDate}
          headline={puzzleOn(cards.data, view, day)?.headline ?? null}
          path={puzzleOn(cards.data, view, day)?.path ?? null}
        />
      )}

      {data.data ? (
        <Settings
          flow={flow}
          league={league}
          players={data.data.players}
          members={data.data.members}
        />
      ) : null}
    </View>
  );
}

/** The league in the masthead: switch, start or join another. */
function LeagueBar({
  flow,
  league,
  leagues,
}: {
  flow: Flow;
  league: BoardLeague;
  leagues: BoardLeague[];
}) {
  const t = useTokens();
  return (
    <View style={styles.leagueBar}>
      <Text style={[styles.kicker, { color: t.faint }]}>Leaderboard</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}>
        {leagues.map((l) => {
          const on = l.code === league.code;
          return (
            <Pressable
              key={l.code}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              testID={`league-${l.code}`}
              onPress={() => setCurrent(l.code)}
              style={[
                styles.pill,
                {
                  borderColor: on ? t.accent : t.hair,
                  backgroundColor: on ? t.accentSoft : t.paper,
                },
              ]}>
              <Text style={[styles.pillText, { color: t.ink, fontWeight: on ? '800' : '600' }]}>
                {l.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={() => flow.setView({ k: 'start' })}
          style={[styles.pill, { borderColor: t.hair }]}>
          <Text style={[styles.pillText, { color: t.accent }]}>＋ Start a new league</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => flow.setView({ k: 'code' })}
          style={[styles.pill, { borderColor: t.hair }]}>
          <Text style={[styles.pillText, { color: t.accent }]}>＋ Join with a code</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** The one card at the top after something happened, else the PIN nudge (board.html topCard). */
function TopCard({ flow, league }: { flow: Flow; league: BoardLeague }) {
  const s = useBoardState();
  const today = useLondonDay();
  const later = useStoredRaw(PIN_LATER) === today;
  const n: Notice | null = flow.notice;
  const done = () => flow.setNotice(null);
  if (n?.k === 'created' && n.code === league.code)
    return (
      <Card title={`${league.name} is ready`} testID="notice-created">
        <P>Share the link in your group chat. Anyone who taps it picks a nickname and joins.</P>
        <Acts>
          <Btn
            kind="go"
            label="Invite people"
            onPress={() =>
              void share(`${inviteText(league.name)}\n${inviteLink(league.code)}`).then(done)
            }
          />
        </Acts>
      </Card>
    );
  if (n?.k === 'joined')
    return (
      <Card title={`You’re in ${league.name}`} testID="notice-joined">
        <P>
          Your results will show here every day. Got another group, like friends or work? Start a
          league for them too.
        </P>
        <Acts>
          <Btn
            kind="alt"
            label="Start another league"
            onPress={() => (done(), flow.setView({ k: 'start', from: 'joined' }))}
          />
        </Acts>
      </Card>
    );
  if (n?.k === 'moved')
    return (
      <Card title="Your leagues are here now" testID="notice-moved">
        <P>
          Results and streaks from your link have been added to this app, and puzzles you finish
          here go on the board as {league.nick}.
        </P>
      </Card>
    );
  if (n?.k === 'claimed')
    return (
      <Card title={`You’re playing as ${n.nick} here too`} testID="notice-claimed">
        <P>
          Puzzles you finish in this app now go on your league’s boards, and the ones you’d already
          finished here have been added.
        </P>
      </Card>
    );
  if (n?.k === 'pinSaved')
    return (
      <Card title="PIN saved" testID="notice-pin">
        <P>
          To play as yourself in another browser or app, open the league’s invite link there and tap{' '}
          <B>Already in this league?</B>
        </P>
      </Card>
    );
  if (!hasPin(s) && !later)
    return (
      <Card title="Set a PIN" testID="pin-nudge">
        <P>Then you can join as yourself from another phone or app.</P>
        <Acts>
          <Btn
            kind="go"
            label="Set a PIN"
            onPress={() => flow.setView({ k: 'pin', fresh: false })}
          />
          <Btn label="Later" onPress={() => appStorage.setItem(PIN_LATER, today)} />
        </Acts>
      </Card>
    );
  return null;
}

function DayBar({
  label,
  date,
  first,
  today,
  setDate,
}: {
  label: string;
  date: string;
  first: string;
  today: string;
  setDate: (d: string) => void;
}) {
  const t = useTokens();
  const btn = (dir: -1 | 1, can: boolean, name: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled: !can }}
      disabled={!can}
      onPress={() => setDate(addDays(date, dir))}
      style={[
        styles.dayBtn,
        { borderColor: t.hair, backgroundColor: t.paper, opacity: can ? 1 : 0.3 },
      ]}>
      <Text style={[styles.dayArrow, { color: t.ink }]}>{dir < 0 ? '‹' : '›'}</Text>
    </Pressable>
  );
  return (
    <View style={styles.dayBar} testID="day-bar">
      {btn(-1, date > first, 'Previous day')}
      <View style={styles.dayLabel}>
        <Text style={[styles.dayName, { color: t.ink }]}>{dayName(date, today)}</Text>
        <Text style={[styles.daySmall, { color: t.faint }]}>{label}</Text>
      </View>
      {btn(1, date < today, 'Next day')}
    </View>
  );
}

function Row({
  rank,
  nick,
  me,
  big,
  small,
  streak,
  dim,
}: {
  rank: string;
  nick: string;
  me: boolean;
  big: string;
  small?: string;
  streak?: number;
  dim?: boolean;
}) {
  const t = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={`${rank} ${nick}${me ? ' (you)' : ''}, ${big}${small ? `, ${small}` : ''}`}
      style={[styles.row, { borderBottomColor: t.hair }, me && { backgroundColor: t.accentSoft }]}>
      <Text style={[styles.rk, { color: t.muted }]}>{rank}</Text>
      <View style={styles.who}>
        <Text numberOfLines={1} style={[styles.nick, { color: dim ? t.muted : t.ink }]}>
          {nick}
          {me ? <Text style={[styles.you, { color: t.accent }]}> YOU</Text> : null}
        </Text>
        {streak && streak > 1 ? (
          <Text style={[styles.st, { color: t.faint }]}>🔥 {streak}-day streak</Text>
        ) : null}
      </View>
      <View>
        <Text style={[styles.res, { color: dim ? t.muted : t.ink }]}>{big}</Text>
        {small ? <Text style={[styles.resSmall, { color: t.faint }]}>{small}</Text> : null}
      </View>
    </View>
  );
}

function NotYetList({ rows }: { rows: NotYet[] }) {
  const t = useTokens();
  if (!rows.length) return null;
  return (
    <>
      <Sub>Not played yet</Sub>
      <Text style={[styles.notyet, { color: t.muted }]}>
        {rows.map((r) => `${r.nick}${r.me ? ' (you)' : ''}`).join(', ')}
      </Text>
    </>
  );
}

function DayView({
  league,
  type,
  d,
  date,
  today,
  setDate,
  headline,
  path,
}: {
  league: BoardLeague;
  type: BoardTypeId;
  d: DayBoard;
  date: string;
  today: string;
  setDate: (d: string) => void;
  headline: string | null;
  path: string | null;
}) {
  const t = useTokens();
  const T = BOARD_TYPE[type];
  const played = [...d.ranked, ...d.unranked].some((r) => r.me);
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
      />
    );
  };
  const file = path?.replace(/^reports\//, '').replace(/\.html$/, '');
  return (
    <View testID="day-board">
      <DayBar
        label={`${T.emoji} ${headline ?? T.name} · ${shortDate(date)}`}
        date={date}
        first={d.first || date}
        today={today}
        setDate={setDate}
      />
      {!played && headline && file ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/play/[type]/[file]', params: { type, file } })}
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
        <View style={[styles.rows, { borderTopColor: t.hair }]}>
          {d.ranked.map((r) => row(r, false))}
          {d.unranked.map((r) => row(r, true))}
        </View>
      )}
      <NotYetList rows={d.not_yet} />
      <Acts>
        {d.ranked.length ? (
          <Btn
            kind="go"
            label="Share leaderboard"
            onPress={() => void share(shareDay(type, headline, date, d.ranked, league))}
          />
        ) : null}
        <Btn
          kind={d.ranked.length ? 'alt' : 'go'}
          label="Invite people"
          onPress={() => void share(`${inviteText(league.name)}\n${inviteLink(league.code)}`)}
        />
      </Acts>
    </View>
  );
}

function OverallView({
  league,
  d,
  date,
  today,
  setDate,
}: {
  league: BoardLeague;
  d: Overall;
  date: string;
  today: string;
  setDate: (d: string) => void;
}) {
  const t = useTokens();
  const row = (r: OverallRow, of: number) => (
    <Row
      key={r.nick}
      rank={MEDAL[r.rank] ?? String(r.rank)}
      nick={r.nick}
      me={r.me}
      big={pts(r.points)}
      small={`${r.completed} of ${of} done`}
    />
  );
  return (
    <View testID="overall-board">
      <DayBar
        label={`🏆 All eight puzzles · ${shortDate(date)}`}
        date={date}
        first={d.first || date}
        today={today}
        setDate={setDate}
      />
      {!d.day.length ? (
        <Text style={[styles.nobody, { color: t.muted }]}>
          Nobody in {league.name} has played {date === today ? 'yet today' : 'on this day'}.
        </Text>
      ) : (
        <View style={[styles.rows, { borderTopColor: t.hair }]}>{d.day.map((r) => row(r, 8))}</View>
      )}
      <NotYetList rows={d.not_yet} />
      <Sub>This week · {weekLabel(d.week_from, d.week_to)}</Sub>
      {!d.week.length ? (
        <Text style={[styles.notyet, { color: t.muted }]}>No results yet this week.</Text>
      ) : (
        <View style={[styles.rows, { borderTopColor: t.hair }]}>
          {d.week.map((r) => row(r, weekDays(date, d.week_from)))}
        </View>
      )}
      <Text style={[styles.how, { color: t.faint }]}>
        Each puzzle you finish scores 1 point, plus 1 for every player whose result on it was worse.
        Equal points: more puzzles finished goes first.
      </Text>
      <Acts>
        {d.day.length ? (
          <Btn
            kind="go"
            label="Share leaderboard"
            onPress={() => void share(shareAll(date, d.day, league))}
          />
        ) : null}
        <Btn
          kind={d.day.length ? 'alt' : 'go'}
          label="Invite people"
          onPress={() => void share(`${inviteText(league.name)}\n${inviteLink(league.code)}`)}
        />
      </Acts>
    </View>
  );
}

/** Confirm with the phone's own dialog, as the site's confirm(). */
function confirm(title: string, message: string, ok: string, then: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: then },
  ]);
}

function Settings({
  flow,
  league,
  players,
  members,
}: {
  flow: Flow;
  league: BoardLeague;
  players: string[];
  members: number;
}) {
  const t = useTokens();
  const s = useBoardState();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(league.name);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean }>({ text: '' });
  const leave = useLeaveLeague();
  const owner = useOwnerAction();
  const fail = (e: unknown) => setMsg({ text: e instanceof Error ? e.message : String(e) });
  const pin = hasPin(s);
  return (
    <View style={[styles.settings, { borderTopColor: t.hair }]} testID="league-settings">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}>
        <Text style={[styles.summary, { color: t.muted }]}>⚙︎ League settings</Text>
      </Pressable>
      {open ? (
        <View>
          <Sub>Invite</Sub>
          <P>
            Code <Text style={styles.code}>{league.code}</Text> · {members}{' '}
            {members === 1 ? 'player' : 'players'}
          </P>
          <Sub>Another group?</Sub>
          <P>
            Start a separate league for friends, work or another chat. You can be in more than one.
          </P>
          <Acts>
            <Btn
              label="Start another league"
              onPress={() => flow.setView({ k: 'start', from: 'settings' })}
            />
          </Acts>
          <Sub>You</Sub>
          <P>
            Playing as <B>{league.nick}</B> · PIN {pin ? 'set' : 'not set'}
          </P>
          <Acts>
            <Btn
              label={pin ? 'Change PIN' : 'Set a PIN'}
              onPress={() => flow.setView({ k: 'pin', fresh: false })}
            />
            <Btn
              kind="warn"
              label="Leave league"
              onPress={() =>
                confirm(
                  'Leave league',
                  `Leave ${league.name}? You’ll come off its boards. You can rejoin with the link.`,
                  'Leave',
                  () => leave.mutate(league.code, { onError: fail }),
                )
              }
            />
          </Acts>
          <Sub>Play somewhere else too?</Sub>
          <P>
            Your leagues are kept in this app. Where else you play, open the league’s invite link,
            tap <B>Already in this league?</B>, pick your nickname and enter your PIN.
          </P>
          <P fine>
            Or send yourself your personal link, which also brings your streaks. It’s your key, so
            don’t post it in a group.
          </P>
          <Acts>
            <Btn label="Send me my link" onPress={() => void shareMyLink()} />
            <Btn label="Paste a link" onPress={() => flow.setView({ k: 'paste' })} />
          </Acts>
          {league.owner ? (
            <>
              <Sub>League name</Sub>
              <Field label="League name" maxLength={30} value={name} onChangeText={setName} />
              <Acts>
                <Btn
                  label="Save"
                  onPress={() => {
                    const problem = firstError(leagueNameSchema, name);
                    if (problem) return setMsg({ text: problem });
                    owner.mutate(
                      {
                        act: 'rename',
                        code: league.code,
                        name: leagueNameSchema.cast(name) as string,
                      },
                      { onError: fail },
                    );
                  }}
                />
              </Acts>
              <Sub>Players</Sub>
              {players.map((p) => (
                <View key={p} style={[styles.plist, { borderBottomColor: t.hair }]}>
                  <Text style={{ color: t.ink, fontSize: 15 }}>
                    {p}
                    {p === league.nick ? ' (you)' : ''}
                  </Text>
                  {p === league.nick ? null : (
                    <View style={styles.plistActs}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Let ${p} back in`}
                        onPress={() =>
                          owner.mutate(
                            { act: 'let_back', code: league.code, nick: p },
                            {
                              onSuccess: (ok) =>
                                setMsg({
                                  ok: true,
                                  text: ok
                                    ? `${p} can join from another phone or app without a PIN for the next day: ask them to open the league link and tap “Already in this league?”.`
                                    : `Couldn’t find ${p}.`,
                                }),
                              onError: fail,
                            },
                          )
                        }>
                        <Text style={[styles.plistBtn, { color: t.accent }]}>Let back in</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${p}`}
                        onPress={() =>
                          confirm(
                            'Remove player',
                            `Remove ${p} from ${league.name}? They come off its boards. They could rejoin with the link unless you make a new join code.`,
                            'Remove',
                            () =>
                              owner.mutate(
                                { act: 'remove', code: league.code, nick: p },
                                { onError: fail },
                              ),
                          )
                        }>
                        <Text style={[styles.plistBtn, { color: t.bad }]}>Remove</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
              <P fine>
                Let back in: for a day, that player can join as themselves from another phone or app
                without their PIN, then sets a new one.
              </P>
              <Sub>Join code</Sub>
              <P>A new code stops the old link and code working; everyone already in stays in.</P>
              <Acts>
                <Btn
                  label="New join code"
                  onPress={() =>
                    confirm(
                      'New join code',
                      'Make a new join code? The old link and code stop working; people already in the league stay in.',
                      'Make new code',
                      () => owner.mutate({ act: 'new_code', code: league.code }, { onError: fail }),
                    )
                  }
                />
              </Acts>
              <Sub>Close league</Sub>
              <P>Takes the league off everyone’s boards.</P>
              <Acts>
                <Btn
                  kind="warn"
                  label="Close league"
                  onPress={() =>
                    confirm(
                      'Close league',
                      `Close ${league.name} for everyone? It comes off all its players’ boards.`,
                      'Close',
                      () => owner.mutate({ act: 'close', code: league.code }, { onError: fail }),
                    )
                  }
                />
              </Acts>
            </>
          ) : null}
          <Msg text={msg.text} ok={msg.ok} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  leagueBar: { marginBottom: 4 },
  kicker: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pills: { gap: 8, paddingVertical: 6 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 14, fontWeight: '600' },
  loading: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  spin: { marginTop: 40 },
  nobody: { textAlign: 'center', paddingTop: 28, paddingBottom: 10, fontSize: 15 },
  dayBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 6 },
  dayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayArrow: { fontSize: 20, lineHeight: 22 },
  dayLabel: { flex: 1, alignItems: 'center' },
  dayName: { fontSize: 16, fontWeight: '800' },
  daySmall: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  play: { marginTop: 10, marginBottom: 4, padding: 12, borderRadius: 10, gap: 4 },
  playText: { fontSize: 14.5 },
  playLink: { fontSize: 14.5, fontWeight: '700' },
  rows: { marginTop: 10, borderTopWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
  },
  rk: { width: 34, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  who: { flex: 1, minWidth: 0 },
  nick: { fontSize: 16, fontWeight: '600' },
  you: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.7 },
  st: { fontSize: 12.5, marginTop: 1 },
  res: { fontSize: 17, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  resSmall: { fontSize: 12, textAlign: 'right' },
  notyet: { marginTop: 6, fontSize: 14.5 },
  how: { marginTop: 14, fontSize: 13 },
  settings: { marginTop: 26, borderTopWidth: 1, paddingTop: 12 },
  summary: { fontSize: 14.5, fontWeight: '600', paddingVertical: 4 },
  code: { fontWeight: '800', letterSpacing: 1.6 },
  plist: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  plistActs: { flexDirection: 'row', gap: 4 },
  plistBtn: { fontSize: 13, fontWeight: '600', padding: 6 },
});
