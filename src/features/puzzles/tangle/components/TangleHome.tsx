import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePuzzleTokens, useTokens } from '@/shared/theme';

import type { homeCard } from '../model';

const HOW = [
  'You have 90 seconds. Drag through touching letters, across, up, down or diagonally, to spell a word. Or tap letters one by one and tap the last one again to enter.',
  'Words are three letters or more, and each tile can be used once per word. QU counts as two letters.',
  'A word scores its length minus two: 1 point for three letters, 2 for four, 3 for five, and so on. The board’s longest word scores double.',
  'One round a day, the same board for everyone. A new one arrives at midnight.',
];

interface TangleHomeProps {
  card: ReturnType<typeof homeCard>;
  onPlay: () => void;
  onBack: () => void;
}

/** Tangle's own home card (the page's #home): the day's round to play, resume or view. */
export function TangleHome({ card, onPlay, onBack }: TangleHomeProps) {
  const t = useTokens();
  const pt = usePuzzleTokens();
  const [how, setHow] = useState(false);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="tangle-home">
      <ScrollView contentContainerStyle={styles.in}>
        <Pressable accessibilityRole="link" onPress={onBack} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: pt.inkSoft }]}>← Puzzles</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: pt.ink }]}>
          Tangle
        </Text>
        <Text style={[styles.num, { color: pt.inkSoft }]}>{card.num}</Text>
        <Text style={[styles.date, { color: pt.inkSoft }]}>{card.date}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play today's tangle"
          onPress={onPlay}
          testID="play-card"
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: pt.card, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.head, { color: pt.ink }]}>{card.head}</Text>
          <Text style={[styles.status, { color: pt.inkSoft }]}>{card.status}</Text>
          <View style={[styles.go, { backgroundColor: t.play }]}>
            <Text style={[styles.goText, { color: t.onPlay }]}>{card.go}</Text>
          </View>
        </Pressable>
        <View style={styles.stats}>
          {(
            [
              [card.streak, 'day streak'],
              [card.best, 'best score'],
              [card.played, 'Tangles played'],
            ] as const
          ).map(([v, label]) => (
            <View key={label} style={styles.stat}>
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
          ? HOW.map((p) => (
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
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 15 },
  title: { fontSize: 44, fontFamily: 'Georgia', marginTop: 8 },
  num: { fontSize: 14, marginTop: 4 },
  date: { fontSize: 20, fontStyle: 'italic', fontFamily: 'Georgia', marginTop: 4 },
  card: { marginTop: 22, borderRadius: 18, padding: 20, gap: 8 },
  head: { fontSize: 30, fontFamily: 'Georgia' },
  status: { fontSize: 16, lineHeight: 23 },
  go: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 8,
  },
  goText: { fontSize: 17, fontWeight: '800' },
  stats: { flexDirection: 'row', marginTop: 22, gap: 12 },
  stat: { flex: 1 },
  statVal: { fontSize: 28, fontFamily: 'Georgia' },
  small: { fontSize: 13 },
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
