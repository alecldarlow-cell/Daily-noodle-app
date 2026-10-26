import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useReduceMotion } from '@/shared/motion';
import { useTokens } from '@/shared/theme';

/** One pulse, dim to bright and back (the site's `.skel` shimmer runs 1.2 s). */
export const SKELETON_PULSE_MS = 1200;

/**
 * Grey rows in the shape of the cards while the list loads (front.css `.skel`), so the
 * page's shape is there at once instead of a lone spinner. They pulse gently, and hold
 * still when the phone asks for reduced motion.
 */
export function PuzzleRowSkeleton({ rows = 5, testID }: { rows?: number; testID?: string }) {
  const t = useTokens();
  const reduce = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(1));
  // Still until the phone has said whether motion is reduced, so nothing flickers first.
  const still = reduce !== false;
  useEffect(() => {
    if (still) {
      pulse.setValue(1);
      return;
    }
    const half = SKELETON_PULSE_MS / 2;
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: half,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 1, duration: half, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, pulse]);
  const fill = { backgroundColor: t.hair };
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading puzzles"
      testID={testID}>
      {Array.from({ length: rows }, (_, i) => (
        <Animated.View
          key={i}
          testID={testID ? `${testID}-row` : undefined}
          style={[styles.row, { borderBottomColor: t.hair, opacity: pulse }]}>
          <View style={[styles.tile, fill]} />
          <View style={styles.body}>
            <View style={[styles.bar, styles.title, fill]} />
            <View style={[styles.bar, fill]} />
            <View style={[styles.bar, styles.short, fill]} />
            <View style={[styles.bar, styles.meta, fill]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

// The card's own measures (PuzzleRow): an 18 pt pad, the 96 pt tile, a 14 pt gap.
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tile: { width: 96, height: 96, borderRadius: 4 },
  body: { flex: 1, gap: 9, paddingTop: 3 },
  bar: { height: 11, borderRadius: 3 },
  title: { height: 17, width: '55%' },
  short: { width: '70%' },
  meta: { width: '35%', marginTop: 6 },
});
