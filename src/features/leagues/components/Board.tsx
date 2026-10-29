/* A league's boards: league picker, puzzle pills, day bar, rows, actions and settings (board.html). */
import { BOARD_TYPE, BOARD_TYPES, type BoardLeague, type BoardTypeId } from '@noodle/core';
import { router } from 'expo-router';
import { createContext, useContext, useState } from 'react';
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

import { BUILD_ENV } from '@/shared/env';
import { appStorage, useStoredRaw } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { shortDate, useLondonDay } from '@/shared/time';

import { isOffline, sayError } from '../api/errors';
import { hasPin, setCurrent, setLastType, useBoardState } from '../hooks/boardStore';
import {
  addDays,
  dayMonth,
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
import type { Flow, Notice } from '../hooks/useLeaguesFlow';
import {
  useBoardData,
  useBoardRecords,
  useLeaveLeague,
  useOwnerAction,
  usePuzzleCards,
} from '../hooks/useLeagues';
import { useBackfill } from '../hooks/useResults';
import { leagueNameSchema, firstError } from '../schemas';
import type { BoardView, DayBoard, DayRow, NotYet, Overall, OverallRow, Records } from '../types';
import { RecordsView } from './Records';
import { Acts, B, Btn, Card, Field, Msg, P, Sub } from './ui';

/** Sign-in sync is in this build: then joining points to it, for playing on another phone. */
const syncOn = (): boolean => BUILD_ENV.EXPO_PUBLIC_SYNC === '1';

const PILLS: { id: BoardView; emoji: string; name: string }[] = [
  { id: 'all', emoji: '🏆', name: 'All puzzles' },
  { id: 'records', emoji: '🏅', name: 'Records' },
  ...BOARD_TYPES.map((t) => ({ id: t.id as BoardView, emoji: t.emoji, name: t.name })),
];
const isView = (v: unknown): v is BoardView =>
  v === 'all' || v === 'records' || (typeof v === 'string' && v in BOARD_TYPE);

/**
 * The league's records, read alongside every view as the site does (loadRecords): for 👑
 * after last week's champion, "🏆 New league record" on a row, the record line under a
 * day's board, and a name's card on a tap. Absent until they load, or if they can't.
 */
const RecordsCtx = createContext<{ recs?: Records; open?: (nick: string) => void }>({});

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
    // A new ask from the route; its params being cleared once read keeps what's showing.
    if (asked.view || asked.date) {
      setChosen(asked.view);
      setDate(asked.date ?? today);
    }
  }
  const view: BoardView = chosen ?? (isView(s.ptype) ? s.ptype : 'all');
  const day = date > today ? today : date;
  const cards = usePuzzleCards();
  const feed = cards.isPending ? undefined : (cards.data ?? []);
  const { filling } = useBackfill(true, feed, s.pid);
  const records = view === 'records';
  const data = useBoardData(
    filling || records ? undefined : league.code,
    records ? 'all' : view,
    day,
  );
  const rec = useBoardRecords(filling ? undefined : league.code);
  // A name tapped on any board opens its card on Records (board.html renderCard).
  const [card, setCard] = useState<string | null>(null);
  const openCard = (nick: string) => {
    setCard(nick);
    pick('records');
  };
  const shown = records ? rec : data;
  // Settings' player list: the board's, or on Records every member there.
  const roster = records
    ? rec.data && { players: rec.data.players.map((p) => p.nick), members: rec.data.players.length }
    : data.data && { players: data.data.players, members: data.data.members };

  const pick = (v: BoardView) => {
    setChosen(null);
    setLastType(v);
  };

  return (
    <RecordsCtx.Provider value={{ recs: rec.data, open: rec.data ? openCard : undefined }}>
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
                onPress={() => {
                  setCard(null);
                  pick(p.id);
                }}
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
        ) : shown.isPending ? (
          <ActivityIndicator style={styles.spin} color={t.muted} />
        ) : shown.isError || !shown.data ? (
          <BoardFailed
            error={shown.error}
            busy={shown.isFetching}
            retry={() => void shown.refetch()}
          />
        ) : records ? (
          <RecordsView
            key={league.code}
            league={league}
            d={rec.data!}
            card={card}
            setCard={setCard}
          />
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

        {roster ? (
          <Settings flow={flow} league={league} players={roster.players} members={roster.members} />
        ) : null}
      </View>
    </RecordsCtx.Provider>
  );
}

/** The board didn't load: why, in the site's words (no signal, or the server), and Try again. */
function BoardFailed({ error, busy, retry }: { error: unknown; busy: boolean; retry: () => void }) {
  const offline = isOffline(error);
  return (
    <Card title={offline ? 'You’re offline' : 'Couldn’t load the board'} testID="board-error">
      <P>
        {offline
          ? 'Couldn’t load the board. Check your connection, then try again.'
          : sayError(error)}
      </P>
      <Acts>
        <Btn
          variant="filled"
          label={busy ? 'Trying…' : 'Try again'}
          disabled={busy}
          onPress={retry}
          testID="board-retry"
        />
      </Acts>
    </Card>
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
              <Text
                style={[
                  styles.pillText,
                  { color: t.ink, fontFamily: on ? FONT.bodyBold : FONT.bodySemi },
                ]}>
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
            variant="filled"
            label="Invite people"
            onPress={() =>
              share(`${inviteText(league.name)}\n${inviteLink(league.code)}`).then(done)
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
            variant="tonal"
            label="Start another league"
            onPress={() => (done(), flow.setView({ k: 'start', from: 'joined' }))}
          />
        </Acts>
        {syncOn() ? (
          <>
            <P>
              Playing on another phone or on the website too? Sign in with your email and your
              leagues come with you.
            </P>
            <Acts>
              <Btn
                label="Sign in on Account"
                onPress={() => (done(), router.navigate('/account'))}
              />
            </Acts>
          </>
        ) : null}
      </Card>
    );
  if (n?.k === 'moved')
    return (
      <Card title="Your leagues are here now" testID="notice-moved">
        <P>
          Results and streaks from your other player have been added to this app, and puzzles you
          finish here go on the board as {league.nick}.
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
            variant="filled"
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
  record,
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
}) {
  const t = useTokens();
  const { recs, open } = useContext(RecordsCtx);
  const crown = !!recs?.crown?.includes(nick);
  const label = `${rank} ${nick}${me ? ' (you)' : ''}${crown ? ', last week’s champion' : ''}, ${big}${small ? `, ${small}` : ''}${record ? ', new league record' : ''}`;
  const style = [
    styles.row,
    { borderBottomColor: t.hair },
    me && { backgroundColor: t.accentSoft },
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
      <Text style={[styles.rk, { color: t.muted }]}>{rank}</Text>
      <View style={styles.who}>
        <Text numberOfLines={1} style={[styles.nick, { color: dim ? t.muted : t.ink }]}>
          {nick}
          {crown ? ' 👑' : ''}
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
  const { recs } = useContext(RecordsCtx);
  const R = recs?.records?.[type];
  const rec = R ? result(type, R) : null;
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
      {R && rec ? (
        <Text style={[styles.reline, { color: t.muted }]} testID="record-line">
          {'🏅 League record '}
          <Text style={[styles.relineBold, { color: t.ink }]}>{rec.big}</Text>
          {`${rec.small ? ` (${rec.small})` : ''} · ${R.nick} · ${dayMonth(R.date)}`}
        </Text>
      ) : null}
      <Acts>
        {d.ranked.length ? (
          <Btn
            variant="filled"
            label="Share leaderboard"
            onPress={() => share(shareDay(type, headline, date, d.ranked, league))}
          />
        ) : null}
        <Btn
          variant={d.ranked.length ? 'tonal' : 'filled'}
          label="Invite people"
          onPress={() => share(`${inviteText(league.name)}\n${inviteLink(league.code)}`)}
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
            variant="filled"
            label="Share leaderboard"
            onPress={() => share(shareAll(date, d.day, league))}
          />
        ) : null}
        <Btn
          variant={d.day.length ? 'tonal' : 'filled'}
          label="Invite people"
          onPress={() => share(`${inviteText(league.name)}\n${inviteLink(league.code)}`)}
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
  // Another league picked: its own name in the rename box, and no message left from the
  // last one (else Save would rename this league to the other's name).
  const [forCode, setForCode] = useState(league.code);
  if (forCode !== league.code) {
    setForCode(league.code);
    setName(league.name);
    setMsg({ text: '' });
  }
  const leave = useLeaveLeague();
  const owner = useOwnerAction();
  const fail = (e: unknown) => setMsg({ text: sayError(e) });
  const pin = hasPin(s);
  return (
    <View style={[styles.settings, { borderTopColor: t.hair }]} testID="league-settings">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.summaryBtn}>
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
              variant="tonal"
              destructive
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
          {syncOn() ? (
            <P fine>
              Or sign in on Account with your email, and your leagues and streaks follow you.
            </P>
          ) : null}
          {league.owner ? (
            <>
              <Sub>League name</Sub>
              <Field
                label="League name"
                testID="settings-league-name"
                maxLength={30}
                value={name}
                onChangeText={setName}
              />
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
                      { onSuccess: () => setMsg({ ok: true, text: 'Saved.' }), onError: fail },
                    );
                  }}
                />
              </Acts>
              <Sub>Players</Sub>
              {players.map((p) => (
                <View key={p} style={[styles.plist, { borderBottomColor: t.hair }]}>
                  <Text style={[styles.plistName, { color: t.ink }]}>
                    {p}
                    {p === league.nick ? ' (you)' : ''}
                  </Text>
                  {p === league.nick ? null : (
                    <View style={styles.plistActs}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Let ${p} back in`}
                        style={styles.plistHit}
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
                        style={styles.plistHit}
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
                  variant="tonal"
                  destructive
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
    fontFamily: FONT.bodySemi,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pills: { gap: 8, paddingVertical: 6 },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontFamily: FONT.bodySemi, fontSize: 14 },
  loading: { fontFamily: FONT.body, textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  spin: { marginTop: 40 },
  nobody: {
    fontFamily: FONT.body,
    textAlign: 'center',
    paddingTop: 28,
    paddingBottom: 10,
    fontSize: 15,
  },
  dayBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 6 },
  dayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayArrow: { fontFamily: FONT.display, fontSize: 22, lineHeight: 26 },
  dayLabel: { flex: 1, alignItems: 'center' },
  dayName: { fontFamily: FONT.displayHeavy, fontSize: 16 },
  daySmall: {
    fontFamily: FONT.bodySemi,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  play: { marginTop: 10, marginBottom: 4, padding: 12, borderRadius: 10, gap: 4 },
  playText: { fontFamily: FONT.body, fontSize: 14.5 },
  playLink: { fontFamily: FONT.bodyBold, fontSize: 14.5 },
  rows: { marginTop: 10, borderTopWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
  },
  rk: { fontFamily: FONT.displayHeavy, width: 34, textAlign: 'center', fontSize: 17 },
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
  notyet: { fontFamily: FONT.body, marginTop: 6, fontSize: 14.5 },
  how: { fontFamily: FONT.body, marginTop: 14, fontSize: 13 },
  reline: { fontFamily: FONT.body, marginTop: 12, fontSize: 14 },
  relineBold: { fontFamily: FONT.bodyBold },
  settings: { marginTop: 26, borderTopWidth: 1, paddingTop: 12 },
  summaryBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  summary: { fontFamily: FONT.bodySemi, fontSize: 14.5, paddingVertical: 4 },
  code: { fontFamily: FONT.display, letterSpacing: 1.6 },
  plist: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: 1,
  },
  plistName: { fontFamily: FONT.body, fontSize: 15, flexShrink: 1 },
  plistActs: { flexDirection: 'row', gap: 8 },
  plistHit: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8 },
  plistBtn: { fontFamily: FONT.bodySemi, fontSize: 14 },
});
