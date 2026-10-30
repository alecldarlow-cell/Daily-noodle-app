import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';
import { Chevron, pressable } from '@/shared/ui';

interface PuzzleBarProps {
  /** "Mini 105" */
  name: string;
  /** The difficulty, "medium". */
  sub?: string;
  /** This type's streak as its start card shows it; the flame shows only once there is one. */
  streak: number;
  /** The clock as the player shows it, "0:14". */
  clock?: string;
  /** The clock hasn't started yet (or is paused): drawn dimmed (link.css #timer.waiting). */
  waiting?: boolean;
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

/**
 * The slim bar over a board (engines/house.js): back, name and number, difficulty, streak,
 * clock. The name is the board screen's heading for screen readers.
 */
export function PuzzleBar({ name, sub, streak, clock, waiting, onBack }: PuzzleBarProps) {
  const pt = usePuzzleTokens();
  const shown = clock;
  return (
    <View style={styles.bar} testID="puzzle-bar">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Puzzles"
        onPress={onBack}
        style={pressable([styles.back, { borderColor: pt.lineSoft, backgroundColor: pt.card }])}>
        <Chevron color={pt.ink} dir="left" size={10} />
      </Pressable>
      <View style={styles.mid}>
        <Text accessibilityRole="header" style={[styles.name, { color: pt.ink }]} numberOfLines={1}>
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
          accessibilityLabel={`${streak}-day streak`}>
          {`🔥${streak}`}
        </Text>
      ) : null}
      {shown !== undefined ? (
        <Text
          style={[styles.clock, { color: pt.ink }, waiting && styles.waiting]}
          accessibilityRole="timer"
          accessibilityLabel={clockLabel(shown)}
          accessibilityLiveRegion="none"
          maxFontSizeMultiplier={1.3}
          testID="puzzle-clock">
          {shown}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  waiting: { opacity: 0.42 },
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
