import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';
import { Chevron } from '@/shared/ui';

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

/**
 * What a screen reader says for the clock: whole minutes only, so the label changes
 * once a minute rather than every tick ("Time, under a minute", "Time, 3 minutes").
 */
export function clockLabel(clock: string): string {
  const parts = clock.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 'Time';
  const mins = parts.length === 3 ? parts[0]! * 60 + parts[1]! : parts[0]!;
  if (mins < 1) return 'Time, under a minute';
  return `Time, ${mins} minute${mins === 1 ? '' : 's'}`;
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
        <Chevron color={pt.ink} dir="left" size={10} />
      </Pressable>
      <View style={styles.mid}>
        <Text style={[styles.name, { color: pt.ink }]} numberOfLines={1}>
          {name}
        </Text>
        {sub ? (
          <Text style={[styles.sub, { color: pt.inkSoft }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {streak > 0 ? (
        <Text
          style={[styles.streak, { color: pt.inkSoft }]}
          accessibilityLabel={`Day streak ${streak}`}>
          {`🔥${streak}`}
        </Text>
      ) : null}
      {clock !== undefined ? (
        <Text
          style={[styles.clock, { color: pt.ink }]}
          accessibilityRole="timer"
          accessibilityLabel={clockLabel(clock)}
          accessibilityLiveRegion="none"
          maxFontSizeMultiplier={1.3}
          testID="puzzle-clock">
          {clock}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, marginBottom: 6 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  mid: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, lineHeight: 19, fontFamily: FONT.sansSemi },
  // house.css .dn-sub #pband: "Medium · Replay".
  sub: { fontSize: 13, lineHeight: 16, fontFamily: FONT.sans, textTransform: 'capitalize' },
  streak: { fontSize: 14, fontFamily: FONT.sans },
  clock: {
    fontSize: 17,
    fontFamily: FONT.sansSemi,
    minWidth: 54,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
