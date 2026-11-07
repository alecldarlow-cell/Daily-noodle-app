/* A league's boards: league picker, puzzle pager, rows, actions and settings (board.html). */
import { BOARD_TYPE, BOARD_TYPES, type BoardLeague, type BoardTypeId } from '@noodle/core';
import { router } from 'expo-router';
import { createContext, useContext, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BUILD_ENV } from '@/shared/env';
import { appStorage, useStoredRaw } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { useLondonDay } from '@/shared/time';

import { isOffline, sayError } from '../api/errors';
import { setLastType, useBoardState } from '../hooks/boardStore';
import {
  addDays,
  inviteLink,
  isMonday,
  inviteText,
  MEDAL,
  pts,
  puzzleOn,
  recapRows,
  result,
  shareAll,
  shareDay,
  shareRecap,
  dayCount,
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
import { DayLine, dayText, TypePager, viewName } from './BoardControls';
import { RecordsView } from './Records';
import { Acts, B, Btn, Card, Field, Msg, P, ROW_INSET_RIGHT, Sub } from './ui';

/** Sign-in sync is in this build: then joining points to it, for playing on another phone. */
const syncOn = (): boolean => BUILD_ENV.EXPO_PUBLIC_SYNC === '1';

/**
 * The pager's stops, in the arrows' order: All puzzles, each puzzle in the daily order, then
 * Records (Alec, 7 Nov 2026: a stop of its own, not a link).
 */
const STOPS: BoardView[] = ['all', ...BOARD_TYPES.map((t) => t.id as BoardView), 'records'];

/**
 * A sideways drag takes the board once it leans sideways (so the page still scrolls). Alec,
 * 7 Nov 2026: the scroll won too often, so it now claims sooner and at a shallower angle.
 */
export const claimsSwipe = (dx: number, dy: number): boolean =>
  Math.abs(dx) > 12 && Math.abs(dx) > 1.2 * Math.abs(dy);
/** Where a finished swipe goes: left to the next puzzle, right to the previous, short to none. */
export const swipeStep = (dx: number): 1 | -1 | 0 => (dx < -50 ? 1 : dx > 50 ? -1 : 0);

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const ten = n % 100;
  const s = ten >= 11 && ten <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${n % 10 > 3 ? 'th' : s}`;
}
const isView = (v: unknown): v is BoardView =>
  v === 'all' || v === 'records' || (typeof v === 'string' && v in BOARD_TYPE);

/**
 * The league's records, read alongside every view as the site does (loadRecords): for 👑
 * after last week's champion, "🏆 New league record" on a row, the record line under a
 * day's board, and a name's card on a tap. Absent until they load, or if they can't.
 */
const RecordsCtx = createContext<{ recs?: Records; open?: (nick: string) => void }>({});

/** "Later" on the sign-in card, for the rest of the London day (the site's key). */
const PIN_LATER = 'noodle-board-pinlater';
/** Set by the first sync, so a player already signed in isn't asked to. */
const SYNCED_KEY = 'noodle-app-sync';

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
  // Alec, 7 Nov 2026: the arrows step through the puzzles; earlier days are one tap away.
  const [dayOpen, setDayOpen] = useState(false);
  const showDay = dayOpen || day !== today;
  const isType = view !== 'all' && view !== 'records';
  // On a puzzle's board, the player's place today and this week overall, from the All board.
  const overall = useBoardData(filling || !isType ? undefined : league.code, 'all', day);
  // A sideways swipe over the board does what the arrows do.
  const swipe = useMemo(() => {
    const step = (dir: 1 | -1) => {
      const at = STOPS.indexOf(view);
      const to = at < 0 ? (dir > 0 ? STOPS[1] : STOPS[0]) : STOPS[at + dir];
      if (!to) return;
      setCard(null);
      setChosen(null);
      setLastType(to);
    };
    return PanResponder.create({
      // Capture: the page's scroll view would otherwise take the touch first, so a sideways
      // swipe never reached the board.
      onMoveShouldSetPanResponderCapture: (_e, g) => claimsSwipe(g.dx, g.dy),
      onMoveShouldSetPanResponder: (_e, g) => claimsSwipe(g.dx, g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => {
        const dir = swipeStep(g.dx);
        if (dir) step(dir);
      },
    });
  }, [view]);
  const headline = isType ? (puzzleOn(cards.data, view, day)?.headline ?? null) : null;

  return (
    <RecordsCtx.Provider value={{ recs: rec.data, open: rec.data ? openCard : undefined }}>
      <View testID="league-board">
        <View {...swipe.panHandlers} testID="board-swipe">
          <TypePager
            stops={STOPS}
            view={view}
            title={headline ?? viewName(view)}
            sub={dayText(day, today)}
            onPick={(v) => {
              setCard(null);
              pick(v);
            }}
          />
          {isType && overall.data ? (
            <YouLine d={overall.data as Overall} today={day === today} />
          ) : null}

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
              showDay={showDay}
            />
          ) : (
            <DayView
              league={league}
              type={view}
              d={data.data as DayBoard}
              date={day}
              today={today}
              setDate={setDate}
              headline={headline}
              path={puzzleOn(cards.data, view, day)?.path ?? null}
              showDay={showDay}
            />
          )}
        </View>

        {records ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showDay }}
            testID="day-open"
            hitSlop={8}
            style={styles.links}
            onPress={() => {
              if (showDay) {
                setDayOpen(false);
                setDate(today);
              } else setDayOpen(true);
            }}>
            <Text style={[styles.linkText, { color: t.accent }]}>
              {showDay ? 'Back to today' : 'Earlier days'}
            </Text>
          </Pressable>
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
/** Mondays: last week's top three, to share, until closed for the day (board.html fillRecap). */
function RecapCard({ league, today }: { league: BoardLeague; today: string }) {
  const key = `noodle-board-recap-${league.code}`;
  const closed = useStoredRaw(key) === today;
  const q = useBoardData(closed ? undefined : league.code, 'all', addDays(today, -1));
  const d = q.data as Overall | undefined;
  if (closed || !d?.week || d.week.length < 2) return null;
  return (
    <Card title={`🏆 Last week in ${league.name}`} testID="recap-card">
      {recapRows(d.week).map((r) => (
        <P key={r.nick}>{`${MEDAL[r.rank] ?? `${r.rank}.`} ${r.nick} · ${pts(r.points)}`}</P>
      ))}
      <Acts>
        <Btn
          variant="filled"
          label="Share"
          onPress={() => share(shareRecap(league, d.week_from, d.week_to, d.week))}
        />
        <Btn label="Close" onPress={() => appStorage.setItem(key, today)} />
      </Acts>
    </Card>
  );
}

/** The one card at the top after something happened, else the PIN nudge (board.html topCard). */
function TopCard({ flow, league }: { flow: Flow; league: BoardLeague }) {
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
  if (isMonday(today) && appStorage.getItem(`noodle-board-recap-${league.code}`) !== today)
    return <RecapCard league={league} today={today} />;
  // Email sign-in is how leagues follow a player (Alec's call). A PIN already set still works
  // on Already in this league?; nobody is asked to set one (6 Nov 2026).
  if (syncOn() && !later && !appStorage.getItem(SYNCED_KEY))
    return (
      <Card title="Keep your leagues" testID="signin-nudge">
        <P>Sign in with your email and your leagues follow you to another phone or the website.</P>
        <Acts>
          <Btn
            variant="filled"
            label="Sign in on Account"
            onPress={() => router.navigate('/account')}
          />
          <Btn label="Later" onPress={() => appStorage.setItem(PIN_LATER, today)} />
        </Acts>
      </Card>
    );
  return null;
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

/** Says what a 👑 means: last week's champion, not whoever is leading now. */
/**
 * Under the board, one small line (Alec, 7 Nov 2026): who hasn't played yet, and what a 👑
 * means (last week's champion, not whoever leads now) when someone wears one.
 */
function NotesLine({ rows }: { rows: NotYet[] }) {
  const t = useTokens();
  const { recs } = useContext(RecordsCtx);
  const parts = [
    rows.length
      ? `Not played yet: ${rows.map((r) => `${r.nick}${r.me ? ' (you)' : ''}`).join(', ')}`
      : '',
    recs?.crown?.length ? '👑 last week’s champion' : '',
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <Text style={[styles.notes, { color: t.muted }]} testID="board-notes">
      {parts.join(' · ')}
    </Text>
  );
}

/** On a puzzle's board: the player's place overall that day and this week ("3rd · 12 pts"). */
function YouLine({ d, today }: { d: Overall; today: boolean }) {
  const t = useTokens();
  const day = d.day.find((r) => r.me);
  const week = d.week.find((r) => r.me);
  if (!day && !week) return null;
  const part = (label: string, r: OverallRow | undefined) =>
    r ? (
      <Text style={[styles.youText, { color: t.muted }]}>
        {label}{' '}
        <Text style={[styles.youBold, { color: t.ink }]}>
          {ordinal(r.rank)} · {pts(r.points)}
        </Text>
      </Text>
    ) : null;
  return (
    <View style={styles.youLine} testID="you-line">
      {part(today ? 'Today overall' : 'That day overall', day)}
      {part('Week', week)}
    </View>
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
      <NotesLine rows={d.not_yet} />
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
      {showDay ? (
        <DayLine date={date} first={d.first || date} today={today} setDate={setDate} />
      ) : null}
      {!d.day.length ? (
        <Text style={[styles.nobody, { color: t.muted }]}>
          Nobody in {league.name} has played {date === today ? 'yet today' : 'on this day'}.
        </Text>
      ) : (
        <View style={[styles.rows, { borderTopColor: t.hair }]}>
          {d.day.map((r) => row(r, dayCount(date)))}
        </View>
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
            Playing as <B>{league.nick}</B>
          </P>
          <Acts>
            <Btn label="Change nickname" onPress={() => flow.setView({ k: 'nick' })} />
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
            {syncOn()
              ? 'Your leagues are kept in this app. Sign in on Account with your email, and your leagues and streaks follow you.'
              : 'Your leagues are kept in this app.'}
          </P>
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
                without a PIN.
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
  loading: { fontFamily: FONT.body, textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  spin: { marginTop: 40 },
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
  youLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 12,
    marginTop: 6,
    marginBottom: 2,
  },
  youText: { fontFamily: FONT.body, fontSize: 13 },
  youBold: { fontFamily: FONT.bodyBold },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },
  linkText: { fontFamily: FONT.bodySemi, fontSize: 14, lineHeight: 22 },
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
