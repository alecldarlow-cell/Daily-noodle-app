import type { GridStreakType } from '@noodle/core';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePuzzleTokens, useTokens } from '@/shared/theme';
import { longDate } from '@/shared/time';

import { HOW, nameOf } from './copy';
import type { StartStats } from './stats';

interface StartCardProps {
  type: GridStreakType;
  /** The player number ("105"). */
  n: number | string;
  /** The puzzle's day, YYYY-MM-DD. */
  date: string;
  rule: string;
  stats: StartStats;
  /** A small picture of the board (house.js art). */
  art?: ReactNode;
  onPlay: () => void;
  onBack: () => void;
}

/**
 * The card before a puzzle you haven't finished (engines/house.js, approved 18 Oct
 * 2026): back to Puzzles and your streak, the name and date, today's rule with Play,
 * your three numbers, and How to play.
 */
export function StartCard({ type, n, date, rule, stats, art, onPlay, onBack }: StartCardProps) {
  const t = useTokens();
  const pt = usePuzzleTokens();
  const [how, setHow] = useState(false);
  const name = nameOf(type);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="start-card">
      <ScrollView contentContainerStyle={styles.in}>
        <View style={styles.top}>
          <Pressable accessibilityRole="link" onPress={onBack} hitSlop={8} style={styles.back}>
            <Text style={[styles.backText, { color: pt.inkSoft }]}>← Puzzles</Text>
          </Pressable>
          {stats.streak >= 1 ? (
            <Text
              style={[styles.small, { color: pt.inkSoft }]}>{`${stats.streak}-day streak`}</Text>
          ) : null}
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: pt.ink }]}>
          {name}
        </Text>
        <Text style={[styles.date, { color: pt.inkSoft }]}>{`No. ${n}, ${longDate(date)}`}</Text>
        <View style={[styles.card, { backgroundColor: pt.card }]}>
          {art ? <View style={styles.art}>{art}</View> : null}
          <View>
            <Text style={[styles.h2, { color: pt.ink }]}>{`Today’s ${name}`}</Text>
            <Text style={[styles.rule, { color: pt.inkSoft }]}>{rule}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onPlay}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: t.play, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={[styles.pillText, { color: t.onPlay }]}>Play</Text>
          </Pressable>
        </View>
        <View style={styles.stats}>
          {[
            [stats.streak, 'day streak'],
            [stats.best, 'best streak'],
            [stats.played, `${name}s played`],
          ].map(([v, label]) => (
            <View key={String(label)} style={styles.stat}>
              <Text style={[styles.statVal, { color: pt.ink }]}>{String(v)}</Text>
              <Text style={[styles.small, { color: pt.inkSoft }]}>{label}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: how }}
          onPress={() => setHow((x) => !x)}
          style={[styles.howBar, { borderColor: pt.lineSoft }]}>
          <Text style={[styles.howTitle, { color: pt.ink }]}>How to play</Text>
          <Text style={{ color: pt.inkSoft }}>{how ? '▴' : '▾'}</Text>
        </Pressable>
        {how
          ? HOW[type].map((p) => (
              <Text key={p} style={[styles.howText, { color: pt.inkSoft }]}>
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
  backText: { fontSize: 15 },
  small: { fontSize: 13 },
  title: { fontSize: 44, fontWeight: '400', fontFamily: 'Georgia', marginTop: 8 },
  date: { fontSize: 20, fontStyle: 'italic', fontFamily: 'Georgia', marginTop: 6 },
  card: { marginTop: 22, borderRadius: 18, padding: 20, gap: 16 },
  art: { alignItems: 'flex-start' },
  h2: { fontSize: 32, fontFamily: 'Georgia', lineHeight: 34 },
  rule: { fontSize: 16, lineHeight: 23, marginTop: 6 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12 },
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
