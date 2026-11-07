/*
 * The controls above a league's board, kept compact so the rows show sooner (tracker
 * AF-017): the league picker in the heading, then the puzzle pager (Alec, 7 Nov 2026): the
 * arrows step through All puzzles and each puzzle, with its tile and a dot for each stop.
 * The date line shows only when looking at an earlier day.
 */
import { BOARD_TYPE, type BoardLeague, type BoardTypeId } from '@noodle/core';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { shortDate } from '@/shared/time';
import { Chevron, PuzzleTile, TAP } from '@/shared/ui';

import { setCurrent } from '../hooks/boardStore';
import { addDays, dayName, inviteLink, inviteText } from '../hooks/boardText';
import type { Flow } from '../hooks/useLeaguesFlow';
import type { BoardView } from '../types';

/** The page's side gutter (Screen's 16 pt). */
export const GUTTER = 16;

/** The app's noodle mark, for All puzzles and Records (which have no puzzle tile). */
const MARK = require('../../../../assets/images/masthead-mark.png') as number;

/**
 * The league's name as the masthead's kicker, "NOODLERS ▾" (Alec, 7 Nov 2026: top right,
 * so the board starts a row higher): tap for the menu of leagues, which opens under the
 * masthead.
 */
export function LeagueKicker({
  league,
  open,
  onPress,
}: {
  league: BoardLeague;
  open: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`League: ${league.name}`}
      accessibilityHint="Choose a league, or start a new one"
      accessibilityState={{ expanded: open }}
      testID="league-picker"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.kickBtn, pressed ? { opacity: 0.7 } : null]}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[styles.kickName, { color: t.ink }]}>
        {league.name}
      </Text>
      <Chevron color={t.ink} dir={open ? 'up' : 'down'} size={6} />
    </Pressable>
  );
}

/**
 * The league menu: the player's leagues, then (Alec, 7 Nov 2026, off the crowded board)
 * "Invite people" and "League settings", then "Start a new league" and "Join with a code".
 */
export function LeagueMenu({
  flow,
  league,
  leagues,
  onClose,
  onSettings,
}: {
  flow: Flow;
  league: BoardLeague;
  leagues: BoardLeague[];
  onClose: () => void;
  /** Opens this league's settings on the board. */
  onSettings: () => void;
}) {
  const t = useTokens();
  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <View
      style={[styles.menu, { backgroundColor: t.paper, borderColor: t.hair }]}
      testID="league-menu">
      {leagues.map((l) => (
        <MenuItem
          key={l.code}
          label={l.name}
          selected={l.code === league.code}
          testID={`league-${l.code}`}
          onPress={go(() => setCurrent(l.code))}
        />
      ))}
      <MenuItem
        label="Invite people"
        accent
        plus={false}
        testID="menu-invite"
        onPress={go(
          () =>
            void Share.share({
              message: `${inviteText(league.name)}\n${inviteLink(league.code)}`,
            }).catch(() => {}),
        )}
      />
      <MenuItem
        label="League settings"
        accent
        plus={false}
        testID="menu-settings"
        onPress={go(onSettings)}
      />
      <MenuItem
        label="Start a new league"
        accent
        onPress={go(() => flow.setView({ k: 'start' }))}
      />
      <MenuItem label="Join with a code" accent onPress={go(() => flow.setView({ k: 'code' }))} />
    </View>
  );
}

function MenuItem({
  label,
  selected,
  accent,
  plus = true,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  accent?: boolean;
  /** An accent item that adds something ("＋ Start a new league"); not Invite or Settings. */
  plus?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole={accent ? 'button' : 'radio'}
      accessibilityState={accent ? undefined : { checked: !!selected }}
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        { borderTopColor: t.hair },
        selected ? { backgroundColor: t.accentSoft } : null,
        pressed ? { backgroundColor: t.accentSoft } : null,
      ]}>
      <Text
        style={[
          styles.itemText,
          {
            color: accent ? t.accent : t.ink,
            fontFamily: selected ? FONT.bodyBold : FONT.bodySemi,
          },
        ]}>
        {accent && plus ? `＋ ${label}` : label}
      </Text>
    </Pressable>
  );
}

/** "Today · Sat 7 Nov", "Yesterday · Fri 6 Nov", or the date alone further back. */
export function dayText(date: string, today: string): string {
  const day = dayName(date, today);
  return day === shortDate(date) ? day : `${day} · ${shortDate(date)}`;
}

/** A view's name in the pager: "All puzzles", "Records", or the puzzle type's. */
export function viewName(v: BoardView): string {
  return v === 'all' ? 'All puzzles' : v === 'records' ? 'Records' : BOARD_TYPE[v].name;
}

/**
 * The puzzle pager: ‹ [tile] Mini 119 / Today · Sat 7 Nov ›. The arrows step along `stops`
 * (All puzzles, then each puzzle); under it a dot for each stop, the current one long, each
 * a tap straight to it. Records sits off the row: from it, the arrows lead back in.
 */
export function TypePager({
  stops,
  view,
  title,
  sub,
  onPick,
  onDay,
  dayOpen = false,
}: {
  stops: BoardView[];
  view: BoardView;
  /** The big line: the puzzle's headline ("Mini 119"), else the view's name. */
  title: string;
  sub: string;
  onPick: (v: BoardView) => void;
  /** A tap on the date: open the earlier-days line, or close it back to today. */
  onDay?: () => void;
  /** The earlier-days line is showing. */
  dayOpen?: boolean;
}) {
  const t = useTokens();
  const at = stops.indexOf(view);
  const prev = at > 0 ? stops[at - 1] : null;
  const next = at < 0 ? stops[1] : at < stops.length - 1 ? stops[at + 1] : null;
  const back = at < 0 ? stops[0] : prev;
  const btn = (to: BoardView | null | undefined, dir: 'left' | 'right') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === 'left' ? 'Previous puzzle' : 'Next puzzle'}
      accessibilityHint={to ? viewName(to) : undefined}
      accessibilityState={{ disabled: !to }}
      disabled={!to}
      testID={dir === 'left' ? 'pager-prev' : 'pager-next'}
      onPress={() => to && onPick(to)}
      style={({ pressed }) => [
        styles.pagerArrow,
        { opacity: to ? 1 : 0.3 },
        pressed ? { backgroundColor: t.accentSoft } : null,
      ]}>
      <Chevron color={t.ink} dir={dir} size={9} />
    </Pressable>
  );
  return (
    <View testID="type-pager">
      <View style={[styles.pager, { borderColor: t.hair }]}>
        {btn(back, 'left')}
        <View style={styles.pagerMid} testID="pager-title">
          {view === 'all' || view === 'records' ? (
            <Image source={MARK} style={styles.pagerIcon} accessible={false} />
          ) : (
            <View style={styles.pagerIcon}>
              <PuzzleTile type={view as BoardTypeId} size={36} testID={`pager-tile-${view}`} />
            </View>
          )}
          <View style={styles.pagerText}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={[styles.pagerTitle, { color: t.ink }]}>
              {title}
            </Text>
            {/* The date opens the earlier days (Alec, 7 Nov 2026: no separate link). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${sub}, ${dayOpen ? 'back to today' : 'choose an earlier day'}`}
              accessibilityState={{ expanded: dayOpen }}
              disabled={!onDay}
              onPress={onDay}
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
              testID="pager-day-btn"
              style={({ pressed }) => [styles.dayBtn, pressed ? { opacity: 0.6 } : null]}>
              <Text
                numberOfLines={1}
                style={[styles.pagerSub, { color: t.muted }]}
                testID="pager-day">
                {sub}
              </Text>
              {onDay ? <Chevron color={t.muted} dir={dayOpen ? 'up' : 'down'} size={5} /> : null}
            </Pressable>
          </View>
        </View>
        {btn(next, 'right')}
      </View>
      <View style={styles.dots} testID="puzzle-chips">
        {stops.map((v) => {
          const on = v === view;
          return (
            <Pressable
              key={v}
              accessibilityRole="button"
              accessibilityLabel={viewName(v)}
              accessibilityState={{ selected: on }}
              testID={`pill-${v}`}
              onPress={() => onPick(v)}
              style={styles.dotHit}>
              <View
                style={[
                  styles.dot,
                  { width: on ? 16 : 6, backgroundColor: on ? t.accent : t.hair },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The day as one slim line, "‹ Today · Wed 28 Oct ›", with an optional puzzle after it. */
export function DayLine({
  date,
  first,
  today,
  setDate,
  what,
}: {
  date: string;
  first: string;
  today: string;
  setDate: (d: string) => void;
  /** The puzzle on that day ("✏️ Mini 105"), on a puzzle's board. */
  what?: string;
}) {
  const t = useTokens();
  const day = dayName(date, today);
  const text = `${day === shortDate(date) ? day : `${day} · ${shortDate(date)}`}${what ? ` · ${what}` : ''}`;
  const btn = (dir: -1 | 1, can: boolean, name: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled: !can }}
      disabled={!can}
      hitSlop={8}
      onPress={() => setDate(addDays(date, dir))}
      style={({ pressed }) => [
        styles.arrow,
        { opacity: can ? 1 : 0.3 },
        pressed ? { backgroundColor: t.accentSoft } : null,
      ]}>
      <Chevron color={t.ink} dir={dir < 0 ? 'left' : 'right'} size={8} />
    </Pressable>
  );
  return (
    <View style={styles.dayLine} testID="day-bar">
      {btn(-1, date > first, 'Previous day')}
      <Text style={[styles.dayText, { color: t.ink }]} testID="day-line">
        {text}
      </Text>
      {btn(1, date < today, 'Next day')}
    </View>
  );
}

const styles = StyleSheet.create({
  // The masthead kicker's size (Screen's kickText), a little bolder and in ink: it's a control.
  kickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    maxWidth: 170,
  },
  kickName: {
    fontFamily: FONT.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  menu: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  item: {
    minHeight: TAP,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemText: { fontSize: 15 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  pagerArrow: {
    width: TAP,
    height: TAP,
    borderRadius: TAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pagerIcon: { width: 36, height: 36, borderRadius: 6, overflow: 'hidden' },
  pagerText: { flexShrink: 1 },
  pagerTitle: { fontFamily: FONT.displayHeavy, fontSize: 18, lineHeight: 23 },
  dayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  pagerSub: { fontFamily: FONT.bodySemi, fontSize: 12.5, lineHeight: 17 },
  // A 28 pt tap target round each dot; ten fit across a small phone.
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 2, marginBottom: 2 },
  dotHit: { width: 26, height: 28, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 6, borderRadius: 3 },
  dayLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 2 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONT.bodySemi,
    fontSize: 14.5,
    lineHeight: 20,
  },
});
