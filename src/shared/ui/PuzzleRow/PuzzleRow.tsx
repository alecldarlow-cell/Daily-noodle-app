import type { PlayedState } from '@noodle/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/shared/theme';

interface PuzzleRowProps {
  kicker: string;
  title: string;
  detail?: string;
  played: PlayedState | null;
  onPress: () => void;
  testID?: string;
}

/**
 * One puzzle as a tappable row: kicker (type or date), title, and either its result
 * with a tick, "In progress" with a dot, or a Play pill. Wording from @noodle/core.
 */
export function PuzzleRow({ kicker, title, detail, played, onPress, testID }: PuzzleRowProps) {
  const t = useTokens();
  const status = played?.done ? played.text : played ? 'In progress' : null;
  const label = `${title}${status ? `, ${status}` : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.paper, borderColor: t.hair, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={styles.text}>
        <Text style={[styles.kicker, { color: t.faint }]}>{kicker}</Text>
        <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
        {detail ? <Text style={[styles.detail, { color: t.muted }]}>{detail}</Text> : null}
      </View>
      {played?.done ? (
        <View style={styles.result}>
          <Text
            style={[styles.mark, { color: played.lost ? t.faint : t.accent }]}
            accessible={false}>
            ✓
          </Text>
          <Text style={[styles.resultText, { color: played.lost ? t.faint : t.ink }]}>
            {played.text}
          </Text>
        </View>
      ) : played ? (
        <View style={styles.result}>
          <View style={[styles.dot, { backgroundColor: t.play }]} />
          <Text style={[styles.resultText, { color: t.startedInk }]}>In progress</Text>
        </View>
      ) : (
        <View style={[styles.pill, { backgroundColor: t.play }]}>
          <Text style={[styles.pillText, { color: t.onPlay }]}>Play</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  text: { flex: 1 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 19, fontWeight: '800', marginTop: 2 },
  detail: { fontSize: 14, marginTop: 2 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '50%' },
  mark: { fontSize: 18, fontWeight: '800' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  resultText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  pillText: { fontSize: 15, fontWeight: '800' },
});
