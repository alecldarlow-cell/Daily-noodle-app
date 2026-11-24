/*
 * A league's boards (board.html): the pager, the swipe between puzzles and which board shows.
 * The parts are their own files: BoardNotices (top cards), BoardViews and BoardRows (the
 * boards), LeagueSettings, Records and BoardControls.
 */
import { BOARD_TYPE, BOARD_TYPES, type BoardLeague } from '@noodle/core';
import { useMemo, useState } from 'react';
import { ActivityIndicator, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { useLondonDay } from '@/shared/time';

import { setLastType, useBoardState } from '../hooks/boardStore';
import { puzzleOn } from '../hooks/boardText';
import type { Flow } from '../hooks/useLeaguesFlow';
import { useBoardData, useBoardRecords, usePuzzleCards } from '../hooks/useLeagues';
import { useBackfill } from '../hooks/useResults';
import { unhide, useHidden } from '../hooks/hidden';
import type { BoardView, DayBoard, Overall } from '../types';
import { dayText, TypePager, viewName } from './BoardControls';
import { BoardFailed, TopCard } from './BoardNotices';
import { DayView, OverallView } from './BoardViews';
import { RecordsCtx } from './boardShared';
import { Settings } from './LeagueSettings';
import { RecordsView } from './Records';

/** Report a name (8 Nov 2026): kept here too, where it was first exported. */
export { reportUrl } from './LeagueSettings';

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
/** The hidden list back from its memo key (one nickname per line). */
const splitKey = (k: string) => (k ? k.split('\n') : []);

export function ordinal(n: number): string {
  const ten = n % 100;
  const s = ten >= 11 && ten <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${n % 10 > 3 ? 'th' : s}`;
}
const isView = (v: unknown): v is BoardView =>
  v === 'all' || v === 'records' || (typeof v === 'string' && v in BOARD_TYPE);

export function Board({
  flow,
  league,
  settingsOpen = false,
  onSettingsClose = () => {},
}: {
  flow: Flow;
  league: BoardLeague;
  /** League settings, opened from the league menu (Alec, 7 Nov 2026: off the board). */
  settingsOpen?: boolean;
  onSettingsClose?: () => void;
}) {
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
  // Hidden players (8 Nov 2026) come off every board on this phone; the roster keeps them.
  const hidden = useHidden(league.code);
  const hiddenKey = hidden.list.join('\n');
  const recData = useMemo(() => unhide(rec.data, splitKey(hiddenKey)), [rec.data, hiddenKey]);
  const dayData = useMemo(() => unhide(data.data, splitKey(hiddenKey)), [data.data, hiddenKey]);
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
    // Not over the settings card or a player's card: those are read and typed in, not swiped.
    const claims = (dx: number, dy: number) =>
      !settingsOpen && !(view === 'records' && card) && claimsSwipe(dx, dy);
    return PanResponder.create({
      // Capture: the board's scroll view would otherwise take the touch first, so a sideways
      // swipe never reached the board.
      onMoveShouldSetPanResponderCapture: (_e, g) => claims(g.dx, g.dy),
      onMoveShouldSetPanResponder: (_e, g) => claims(g.dx, g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => {
        const dir = swipeStep(g.dx);
        if (dir) step(dir);
      },
    });
  }, [view, settingsOpen, card]);
  const headline = isType ? (puzzleOn(cards.data, view, day)?.headline ?? null) : null;

  return (
    <RecordsCtx.Provider value={{ recs: recData, open: recData ? openCard : undefined }}>
      <View testID="league-board" style={styles.board}>
        {/* The swipe area fills the space down to the tab bar, so an empty board swipes
            too (Alec, 8 Nov 2026). The pager stays put; the board scrolls under it. */}
        <View {...swipe.panHandlers} testID="board-swipe" style={styles.board}>
          <TypePager
            stops={STOPS}
            view={view}
            title={headline ?? viewName(view)}
            sub={dayText(day, today)}
            onPick={(v) => {
              setCard(null);
              pick(v);
            }}
            dayOpen={showDay}
            onDay={
              records
                ? undefined
                : () => {
                    if (showDay) {
                      setDayOpen(false);
                      setDate(today);
                    } else setDayOpen(true);
                  }
            }
          />

          <ScrollView
            style={styles.board}
            contentContainerStyle={styles.boardScroll}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            testID="board-scroll">
            {settingsOpen && roster ? (
              <Settings
                flow={flow}
                league={league}
                players={roster.players}
                members={roster.members}
                hidden={hidden.list}
                onHide={hidden.set}
                onClose={onSettingsClose}
              />
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
                d={recData!}
                card={card}
                setCard={setCard}
              />
            ) : view === 'all' ? (
              <OverallView
                league={league}
                d={dayData as Overall}
                date={day}
                today={today}
                setDate={setDate}
                showDay={showDay}
              />
            ) : (
              <DayView
                league={league}
                type={view}
                d={dayData as DayBoard}
                date={day}
                today={today}
                setDate={setDate}
                headline={headline}
                path={puzzleOn(cards.data, view, day)?.path ?? null}
                showDay={showDay}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </RecordsCtx.Provider>
  );
}

const styles = StyleSheet.create({
  loading: { fontFamily: FONT.body, textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  spin: { marginTop: 40 },
  board: { flex: 1 },
  // Room under the last row clear of the tab bar, as the page scroll has.
  boardScroll: { paddingBottom: 72, flexGrow: 1 },
});
