/**
 * Link's beats as the page plays them (engines/link.css, link.js): a wrong four goes red and
 * wobbles while the spent pip flashes out; a right four turns its group's colour tile by tile
 * and flies into the band, which swells once as it lands. Each part plays once, when it
 * mounts, off one native-driven clock; the board mounts them only when motion is allowed.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { SETTLE_MS } from '../model';

/** link.js THE SETTLE: each tile turns 80 ms after the last; the flight starts 300 ms after the third. */
export const FLIP_STEP_MS = 80;
export const FLIGHT_AT_MS = 80 * 3 + 300;
export const FLIGHT_MS = SETTLE_MS - FLIGHT_AT_MS;
/** .tile.miss stays red this long; the wobble itself takes 520 ms. */
export const MISS_MS = 760;
const WOBBLE_MS = 520;
const PIP_MS = 620;

/** A clock in milliseconds from 0 to `ms`, started when the part mounts. */
function useClock(ms: number, easing: (t: number) => number = Easing.linear) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.timing(t, { toValue: ms, duration: ms, easing, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [t, ms, easing]);
  return t;
}

/** A wrong four: red for 760 ms while it wobbles (.tile.miss, @keyframes wobble). */
export function Wobble({
  children,
  red,
}: {
  children: (red: boolean) => ReactNode;
  /** Draws the red state; the wobble alone if not given. */
  red?: boolean;
}) {
  const t = useClock(WOBBLE_MS, Easing.bezier(0.36, 0.07, 0.19, 0.97));
  const [on, setOn] = useState(true);
  useEffect(() => {
    const h = setTimeout(() => setOn(false), MISS_MS);
    return () => clearTimeout(h);
  }, []);
  const at = [0, 0.15, 0.3, 0.45, 0.6, 0.78, 1].map((f) => f * WOBBLE_MS);
  const translateX = t.interpolate({ inputRange: at, outputRange: [0, -7, 7, -5, 5, -2, 0] });
  const rotate = t.interpolate({
    inputRange: at,
    outputRange: ['0deg', '-1.6deg', '1.6deg', '-1.1deg', '1.1deg', '-0.4deg', '0deg'],
  });
  const scale = t.interpolate({
    inputRange: [0, 1, WOBBLE_MS - 1, WOBBLE_MS],
    outputRange: [0.955, 0.955, 0.955, 1],
  });
  return (
    <Animated.View
      testID="link-wobble"
      style={[styles.fill, { transform: [{ translateX }, { rotate }, { scale }] }]}>
      {children(red !== false && on)}
    </Animated.View>
  );
}

/** The pip just spent (.pip.lost): it flashes red and large, then shrinks to an empty ring. */
export function LostPip({
  red,
  ring,
  style,
}: {
  red: string;
  ring: string;
  style: StyleProp<ViewStyle>;
}) {
  const t = useClock(PIP_MS);
  const k = [0, 0.45 * PIP_MS, PIP_MS];
  return (
    <Animated.View
      testID="pip-gone"
      style={[
        style,
        { borderColor: ring, borderWidth: 1.5 },
        { transform: [{ scale: t.interpolate({ inputRange: k, outputRange: [1.65, 0.7, 0.8] }) }] },
      ]}>
      <Animated.View
        testID="pip-lost"
        style={[
          StyleSheet.absoluteFill,
          styles.round,
          {
            backgroundColor: red,
            opacity: t.interpolate({ inputRange: k, outputRange: [1, 1, 0] }),
          },
        ]}
      />
    </Animated.View>
  );
}

/**
 * A tile of the right four, settling: its group colour comes in at its turn (80 ms apart in
 * board order), then it flies to the band's row, narrowing and fading as the four fuse.
 */
export function SettleTile({
  k,
  rise,
  shift,
  plain,
  turned,
}: {
  /** Its place among the four, in board order. */
  k: number;
  /** Points up to the band's row, and across to the row's middle. */
  rise: number;
  shift: number;
  plain: ReactNode;
  turned: ReactNode;
}) {
  const t = useClock(SETTLE_MS);
  const flip = k * FLIP_STEP_MS;
  const end = FLIGHT_AT_MS + FLIGHT_MS;
  const fly = (to: number) =>
    t.interpolate({
      inputRange: [0, FLIGHT_AT_MS, end],
      outputRange: [0, 0, to],
      extrapolate: 'clamp',
    });
  return (
    <Animated.View
      testID="link-settle"
      style={[
        styles.fill,
        {
          zIndex: 2,
          opacity: t.interpolate({
            inputRange: [0, end - 120, end],
            outputRange: [1, 1, 0],
            extrapolate: 'clamp',
          }),
          transform: [
            { translateY: fly(-rise) },
            { translateX: fly(shift) },
            {
              scaleX: t.interpolate({
                inputRange: [0, FLIGHT_AT_MS, end],
                outputRange: [1, 1, 0.55],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}>
      {plain}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: t.interpolate({
              inputRange: [0, flip, flip + 120],
              outputRange: [0, 0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}>
        {turned}
      </Animated.View>
    </Animated.View>
  );
}

/** The band just found (.band.landed, bandText): it swells once, its words rising in. */
export function Landing({ children, style }: { children: ReactNode; style: StyleProp<ViewStyle> }) {
  const t = useClock(460);
  return (
    <Animated.View
      testID="link-landing"
      style={[
        style,
        {
          opacity: t.interpolate({
            inputRange: [0, 120],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              scale: t.interpolate({
                inputRange: [0, 120, 256, 460],
                outputRange: [1, 1, 1.025, 1],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}>
      <Animated.View
        style={[
          styles.centre,
          {
            opacity: t.interpolate({
              inputRange: [0, 120, 440],
              outputRange: [0, 0, 1],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                translateY: t.interpolate({
                  inputRange: [0, 120, 440],
                  outputRange: [5, 5, 0],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  round: { borderRadius: 5 },
  centre: { alignItems: 'center', justifyContent: 'center' },
});
