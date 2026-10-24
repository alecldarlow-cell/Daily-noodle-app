import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePuzzleTokens } from '@/shared/theme';

interface PuzzleBarProps {
  /** "Mini 105" */
  name: string;
  /** The difficulty, "medium". */
  sub?: string;
  /** The saved streak; the flame shows only once there is one. */
  streak: number;
  /** The clock as the page shows it, "00:14". */
  clock?: string;
  onBack: () => void;
}

/** The slim bar over a board (engines/house.js): back, name and number, difficulty, streak, clock. */
export function PuzzleBar({ name, sub, streak, clock, onBack }: PuzzleBarProps) {
  const pt = usePuzzleTokens();
  return (
    <View style={styles.bar} testID="puzzle-bar">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Puzzles"
        onPress={onBack}
        style={[styles.back, { borderColor: pt.lineSoft, backgroundColor: pt.card }]}>
        <Text style={[styles.chev, { color: pt.ink }]}>‹</Text>
      </Pressable>
      <View style={styles.mid}>
        <Text style={[styles.name, { color: pt.ink }]}>{name}</Text>
        {sub ? <Text style={[styles.sub, { color: pt.inkSoft }]}>{sub}</Text> : null}
      </View>
      {streak > 0 ? (
        <Text
          style={[styles.streak, { color: pt.inkSoft }]}
          accessibilityLabel={`Day streak ${streak}`}>
          {`🔥${streak}`}
        </Text>
      ) : null}
      {clock !== undefined ? (
        <Text style={[styles.clock, { color: pt.ink }]} accessibilityLabel={`Time ${clock}`}>
          {clock}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chev: { fontSize: 26, lineHeight: 28, fontWeight: '600' },
  mid: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13 },
  streak: { fontSize: 14 },
  clock: {
    fontSize: 17,
    fontWeight: '600',
    minWidth: 54,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
