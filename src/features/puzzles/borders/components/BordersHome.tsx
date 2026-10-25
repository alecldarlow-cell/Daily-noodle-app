import { dayBefore } from '@noodle/core';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { homeView, serial, type BordersState } from '../model';
import { homeDate } from '../simulate';
import type { BordersColors } from './colors';
import { worldHtml } from './drawing';
import { Picture } from './Picture';

const HOW = [
  'Ten country outlines, easiest first. Pick the country from four names: 100 points for each right answer, and 10 more for every one in a row, up to 50.',
  'Stuck? Show on map puts the outline on a world map, for half points. Every country you name goes into your atlas in Borderline.',
];

interface Props {
  state: BordersState;
  today: string;
  c: BordersColors;
  onPlay: () => void;
  onBack: () => void;
}

/** Borders' start screen (the page's #home, renderHome and homeExtras). */
export function BordersHome({ state, today, c, onPlay, onBack }: Props) {
  const h = homeView(state, today, dayBefore);
  const [how, setHow] = useState(false);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} testID="borders-home">
      <ScrollView contentContainerStyle={styles.in}>
        <Pressable accessibilityRole="link" onPress={onBack} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: c.ink2 }]}>← Puzzles</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>
          Borders
        </Text>
        <Text style={[styles.date, { color: c.ink2 }]}>
          {`No. ${serial(state.P.id)}, ${homeDate(state.P.date)}`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play today's ten"
          onPress={onPlay}
          testID="borders-play-button"
          style={[styles.card, { backgroundColor: c.paper }]}>
          <Picture html={worldHtml(c)} style={styles.world} />
          <View style={styles.cardtxt}>
            <Text style={[styles.h2, { color: c.ink }]}>{"Today's ten"}</Text>
            <Text style={[styles.status, { color: c.ink2 }]} testID="borders-status">
              {h.status}
            </Text>
            <View style={[styles.go, { backgroundColor: c.ink }]}>
              <Text style={[styles.goText, { color: c.paper }]}>{h.button}</Text>
            </View>
          </View>
        </Pressable>
        <View style={[styles.stats, { borderColor: c.line }]}>
          {(['day streak', 'best score', 'Borders played'] as const).map((label, k) => (
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
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 15 },
  title: { fontSize: 56, fontFamily: 'Georgia', marginTop: 4 },
  date: { fontSize: 20, fontFamily: 'Georgia', marginTop: 8 },
  card: { marginTop: 22, borderRadius: 18, paddingBottom: 20, overflow: 'hidden' },
  world: { marginTop: 16, marginHorizontal: 14, aspectRatio: 600 / 270 },
  cardtxt: { paddingHorizontal: 20, paddingTop: 8 },
  h2: { fontSize: 32, fontFamily: 'Georgia' },
  status: { fontSize: 16, lineHeight: 23, marginTop: 6 },
  go: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 22,
    borderRadius: 24,
  },
  goText: { fontSize: 16, fontWeight: '600' },
  stats: { flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1 },
  stat: { flex: 1, paddingVertical: 10 },
  statVal: { fontSize: 28, fontFamily: 'Georgia' },
  small: { fontSize: 13, marginTop: 4 },
  howBar: {
    minHeight: 52,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  howTitle: { fontSize: 16, fontWeight: '600' },
  howText: { fontSize: 15, lineHeight: 22, marginTop: 12 },
});
