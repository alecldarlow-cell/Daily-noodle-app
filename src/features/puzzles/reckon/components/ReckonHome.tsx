import { dayBefore } from '@noodle/core';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { longDate } from '@/shared/time';

import { homeView, serial, type ReckonState } from '../model';
import type { ReckonColors } from './colors';

const HOW = [
  'Drag the marker along the scale to guess, nudge it with − and +, then Lock in. Each big mark on the scale is ten times the last.',
  'Within 15% of the answer scores 100; within 30%, 75; within 60%, 50; within three times either way, 25. Gaps are measured from the smaller number, so half the answer scores the same as double it.',
  'Ten questions, the same for everyone, one go a day. Figures are rounded; dated ones say when they’re from.',
];

/** The page's picture on the card: the zones, the scale, the pin and the marker. */
function Art({ c }: { c: ReckonColors }) {
  return (
    <View
      style={styles.art}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {[118, 74, 46, 22].map((w, k) => (
        <View
          key={w}
          style={[styles.zone, { width: w, left: 145 - w / 2, backgroundColor: c.zones[3 - k] }]}
        />
      ))}
      <View style={[styles.track, { backgroundColor: c.ink }]} />
      <View style={[styles.pinLine, { backgroundColor: c.ink }]} />
      <View style={[styles.pinHead, { backgroundColor: c.ink }]} />
      <View style={[styles.marker, { backgroundColor: c.tom }]} />
      {[
        ['100', 30],
        ['1k', 140],
        ['10k', 250],
      ].map(([t, x]) => (
        <Text key={t} style={[styles.artLab, { left: Number(x) - 20, color: c.ink2 }]}>
          {t}
        </Text>
      ))}
    </View>
  );
}

interface Props {
  state: ReckonState;
  today: string;
  c: ReckonColors;
  onPlay: () => void;
  onBack: () => void;
}

/** Reckon's start screen (the page's #home, filled by renderHome). */
export function ReckonHome({ state, today, c, onPlay, onBack }: Props) {
  const h = homeView(state, today, dayBefore);
  const [how, setHow] = useState(false);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} testID="reckon-home">
      <ScrollView contentContainerStyle={styles.in}>
        <View style={styles.top}>
          <Pressable accessibilityRole="link" onPress={onBack} hitSlop={8} style={styles.back}>
            <Text style={[styles.small, { color: c.ink2, fontSize: 15 }]}>← Puzzles</Text>
          </Pressable>
          {h.streak ? <Text style={[styles.small, { color: c.ink2 }]}>{h.streak}</Text> : null}
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>
          Reckon
        </Text>
        <Text style={[styles.date, { color: c.ink2 }]}>
          {`No. ${serial(state.P.id)}, ${longDate(state.P.date)}`}
        </Text>
        <View style={[styles.card, { backgroundColor: c.paper }]}>
          <Art c={c} />
          <View>
            <Text style={[styles.h2, { color: c.ink }]}>Today’s ten</Text>
            <Text style={[styles.status, { color: c.ink2 }]} testID="reckon-status">
              {h.status}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onPlay}
            testID="reckon-play-button"
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: c.tom, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Text style={[styles.pillText, { color: c.onTom }]}>{h.button}</Text>
          </Pressable>
        </View>
        <View style={styles.stats}>
          {(['day streak', 'best score', 'Reckons played'] as const).map((label, k) => (
            <View key={label} style={styles.stat}>
              <Text style={[styles.statVal, { color: c.ink }]}>{h.stats[k]}</Text>
              <Text style={[styles.small, { color: c.ink2 }]}>{label}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: how }}
          onPress={() => setHow((x) => !x)}
          style={[styles.howBar, { borderColor: c.line }]}>
          <Text style={[styles.howTitle, { color: c.ink }]}>How to play</Text>
          <Text style={{ color: c.ink2 }}>{how ? '▴' : '▾'}</Text>
        </Pressable>
        {how
          ? HOW.map((p) => (
              <Text key={p} style={[styles.howText, { color: c.ink2 }]}>
                {p}
              </Text>
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  in: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  back: { minHeight: 44, justifyContent: 'center' },
  small: { fontSize: 13 },
  title: { fontSize: 64, fontFamily: 'Georgia', marginTop: 4 },
  date: { fontSize: 20, fontStyle: 'italic', fontFamily: 'Georgia', marginTop: 2 },
  card: { marginTop: 22, borderRadius: 18, padding: 20, gap: 16 },
  art: { width: 280, height: 96, alignSelf: 'center' },
  zone: { position: 'absolute', top: 22, height: 36, borderRadius: 7 },
  track: { position: 'absolute', left: 6, top: 34, width: 268, height: 12, borderRadius: 6 },
  pinLine: { position: 'absolute', left: 144, top: 10, width: 2, height: 24 },
  pinHead: { position: 'absolute', left: 136, top: 1, width: 18, height: 18, borderRadius: 9 },
  marker: { position: 'absolute', left: 156, top: 26, width: 28, height: 28, borderRadius: 14 },
  artLab: { position: 'absolute', top: 76, width: 40, textAlign: 'center', fontSize: 12 },
  h2: { fontSize: 32, fontFamily: 'Georgia', lineHeight: 34 },
  status: { fontSize: 16, lineHeight: 23, marginTop: 6 },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    minHeight: 44,
  },
  pillText: { fontSize: 17, fontWeight: '800' },
  stats: { flexDirection: 'row', marginTop: 22, gap: 12 },
  stat: { flex: 1 },
  statVal: { fontSize: 28, fontFamily: 'Georgia' },
  howBar: {
    marginTop: 18,
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  howTitle: { fontSize: 16, fontWeight: '600' },
  howText: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
});
