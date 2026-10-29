/*
 * The controls above a league's board, kept compact so the rows show sooner (tracker
 * AF-017): the league picker in the heading, one row of short puzzle chips, and one
 * slim date line. Chip rows run to the screen's edges with the gutter as inner padding,
 * as Archive's do (AF-007).
 */
import type { BoardLeague } from '@noodle/core';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { shortDate } from '@/shared/time';
import { Chevron, TAP } from '@/shared/ui';

import { setCurrent } from '../hooks/boardStore';
import { addDays, dayName } from '../hooks/boardText';
import type { Flow } from '../hooks/useLeaguesFlow';
import type { BoardView } from '../types';

/** The page's side gutter (Screen's 16 pt), which edge-to-edge rows pad back in. */
export const GUTTER = 16;
/** Puzzle chips are this tall (the site's ~32 pt), with their tap area grown to 44 by hitSlop. */
export const CHIP_H = 32;
export const CHIP_SLOP = (44 - CHIP_H) / 2;

/**
 * The league's name as the heading, "Noodlers ▾": tap for the menu of leagues, with
 * "Start a new league" and "Join with a code" inside it.
 */
export function LeaguePicker({
  flow,
  league,
  leagues,
}: {
  flow: Flow;
  league: BoardLeague;
  leagues: BoardLeague[];
}) {
  const t = useTokens();
  const [open, setOpen] = useState(false);
  const go = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <View style={styles.picker}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`League: ${league.name}`}
        accessibilityHint="Choose a league, or start a new one"
        accessibilityState={{ expanded: open }}
        testID="league-picker"
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.pickerBtn, pressed ? { opacity: 0.7 } : null]}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.leagueName, { color: t.ink }]}>
          {league.name}
        </Text>
        <Chevron color={t.ink} dir={open ? 'up' : 'down'} size={8} />
      </Pressable>
      {open ? (
        <View
          style={[styles.menu, { backgroundColor: t.paper, borderColor: t.hair }]}
          testID="league-menu">
          {leagues.map((l) => {
            const on = l.code === league.code;
            return (
              <MenuItem
                key={l.code}
                label={l.name}
                selected={on}
                testID={`league-${l.code}`}
                onPress={go(() => setCurrent(l.code))}
              />
            );
          })}
          <MenuItem
            label="Start a new league"
            accent
            onPress={go(() => flow.setView({ k: 'start' }))}
          />
          <MenuItem
            label="Join with a code"
            accent
            onPress={go(() => flow.setView({ k: 'code' }))}
          />
        </View>
      ) : null}
    </View>
  );
}

function MenuItem({
  label,
  selected,
  accent,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  accent?: boolean;
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
        {accent ? `＋ ${label}` : label}
      </Text>
    </Pressable>
  );
}

/** One scrolling row of short puzzle chips, out to the screen's edges. */
export function PuzzleChips({
  pills,
  view,
  onPick,
}: {
  pills: { id: BoardView; emoji: string; name: string }[];
  view: BoardView;
  onPick: (v: BoardView) => void;
}) {
  const t = useTokens();
  return (
    <ScrollView
      horizontal
      testID="puzzle-chips"
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.chips}>
      {pills.map((p) => {
        const on = p.id === view;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={p.name}
            testID={`pill-${p.id}`}
            hitSlop={{ top: CHIP_SLOP, bottom: CHIP_SLOP }}
            onPress={() => onPick(p.id)}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: on ? t.ink : t.hair, backgroundColor: on ? t.ink : t.paper },
              pressed && !on ? { backgroundColor: t.accentSoft } : null,
            ]}>
            <Text style={[styles.chipText, { color: on ? t.canvas : t.ink }]}>
              {p.emoji} {p.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
  picker: { marginBottom: 2 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    minHeight: TAP,
    maxWidth: '100%',
  },
  leagueName: { fontFamily: FONT.displayHeavy, fontSize: 22, letterSpacing: -0.3, flexShrink: 1 },
  menu: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  item: {
    minHeight: TAP,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemText: { fontSize: 15 },
  // Out to the screen's edges; the gutter comes back as the row's inner padding, so the
  // last chip slides off the edge rather than being cut in mid-air.
  bleed: { flexGrow: 0, flexShrink: 0, marginHorizontal: -GUTTER },
  chips: { gap: 6, paddingHorizontal: GUTTER, paddingVertical: CHIP_SLOP, alignItems: 'center' },
  chip: {
    minHeight: CHIP_H,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontFamily: FONT.bodySemi, fontSize: 13.5 },
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
