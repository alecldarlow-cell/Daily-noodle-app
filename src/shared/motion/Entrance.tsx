import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

interface EntranceProps {
  /** Animate in (a fresh finish); otherwise the children simply show. */
  play: boolean;
  /** Milliseconds before this part starts. */
  delay?: number;
  /** Points it rises from. */
  rise?: number;
  /** The scale it grows from (1: none). */
  from?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
}

/** How long a part takes to arrive. */
export const ENTRANCE_MS = 420;

/**
 * A short, quiet arrival: fades in while rising a few points (and, for the result,
 * growing a touch). Shown still when `play` is off or the phone asks for reduced
 * motion. Native-driven, so it never holds up a tap.
 */
export function Entrance({
  play,
  delay = 0,
  rise = 12,
  from = 1,
  style,
  testID,
  children,
}: EntranceProps) {
  const reduced = useReduceMotion();
  const [t] = useState(() => new Animated.Value(play ? 0 : 1));
  const still = !play || reduced === true;
  useEffect(() => {
    if (!play || reduced === null) return;
    if (reduced) {
      t.setValue(1);
      return;
    }
    const a = Animated.timing(t, {
      toValue: 1,
      duration: ENTRANCE_MS,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [play, reduced, delay, t]);
  if (still)
    return (
      <View style={style} testID={testID}>
        {children}
      </View>
    );
  const transform = [
    { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) },
    { scale: t.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) },
  ];
  return (
    <Animated.View style={[style, { opacity: t, transform }]} testID={testID}>
      {children}
    </Animated.View>
  );
}
