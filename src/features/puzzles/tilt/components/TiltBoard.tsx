import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { FONT } from '@/shared/theme';

import {
  ballAt,
  CS,
  DIRS,
  OUT_MS,
  PAD,
  rollMs,
  routePoints,
  size,
  TURN_MS,
  wallSegments,
  xy,
  type TiltData,
  type TiltState,
} from '../model';

/** engines/tilt.css: the maze's own palette, light and dark. */
export function tiltColors(dark: boolean) {
  return dark
    ? {
        floor: '#1E2230',
        trail: '#2A3250',
        exit: '#4A4220',
        exitMark: '#E0A92E',
        wall: '#ECEEF4',
        ball: '#2E5BFF',
        route: '#2E5BFF',
      }
    : {
        floor: '#FFFFFF',
        trail: '#E8EDFF',
        exit: '#FFF0B8',
        exitMark: '#9A6B00',
        wall: '#141726',
        ball: '#2E5BFF',
        route: '#2E5BFF',
      };
}
export type TiltColors = ReturnType<typeof tiltColors>;

/** A line segment in drawing units, as a thin view (every wall and route leg is straight). */
function Seg({ seg, k, w, color }: { seg: number[]; k: number; w: number; color: string }) {
  const [x1, y1, x2, y2] = seg as [number, number, number, number];
  const horiz = y1 === y2;
  const left = Math.min(x1, x2) * k - w / 2;
  const top = Math.min(y1, y2) * k - w / 2;
  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width: horiz ? Math.abs(x2 - x1) * k + w : w,
        height: horiz ? w : Math.abs(y2 - y1) * k + w,
        borderRadius: w / 2,
        backgroundColor: color,
      }}
    />
  );
}

/** The floor, trail, exit mat and mark, and walls: everything but the ball. */
function Maze({
  p,
  side,
  colors,
  trail,
}: {
  p: TiltData;
  side: number;
  colors: TiltColors;
  trail: ReadonlySet<string>;
}) {
  const k = side / size(p);
  const { inner, rim } = wallSegments(p);
  const [er, ec, eg] = p.exit;
  const [ax, ay] = xy(er, ec);
  const [dr, dc] = DIRS[eg]!;
  const mark = [ax + dc * (CS / 2 + 10), ay + dr * (CS / 2 + 10)];
  const cell = (r: number, c: number, color: string, key: string) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: (PAD + c * CS) * k,
        top: (PAD + r * CS) * k,
        width: CS * k,
        height: CS * k,
        backgroundColor: color,
      }}
    />
  );
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: PAD * k,
          top: PAD * k,
          width: p.n * CS * k,
          height: p.n * CS * k,
          borderRadius: 4 * k,
          backgroundColor: colors.floor,
        }}
      />
      {[...trail].map((key) => {
        const [r, c] = key.split(',').map(Number);
        return cell(r!, c!, colors.trail, `t${key}`);
      })}
      {cell(er, ec, colors.exit, 'exit')}
      {inner.map((s, i) => (
        <Seg key={`w${i}`} seg={s} k={k} w={3 * k} color={colors.wall} />
      ))}
      {rim.map((s, i) => (
        <Seg key={`r${i}`} seg={s} k={k} w={4.4 * k} color={colors.wall} />
      ))}
      <Text
        testID="tilt-exit-mark"
        style={[
          styles.mark,
          {
            left: mark[0]! * k - 10,
            top: mark[1]! * k - 14,
            color: colors.exitMark,
            transform: [{ rotate: `${[90, 180, 270, 0][eg]}deg` }],
          },
        ]}>
        ›
      </Text>
    </>
  );
}

interface BoardProps {
  state: TiltState;
  side: number;
  colors: TiltColors;
  /** Motion kept down: the maze and ball jump to where they end. */
  reduced: boolean;
}

/**
 * The maze, turned a quarter at a time (0.28 s, as tilt.css), and the ball, which drops after
 * the turn and speeds up as it falls (the page's rollTo), then rolls out through the gap.
 * The model is the truth: the drawing only catches up with it.
 */
export function TiltBoard({ state, side, colors, reduced }: BoardProps) {
  const k = side / size(state.p);
  const [rot] = useState(() => new Animated.Value(state.rot * 90));
  const [bx, by] = ballAt(state, true);
  const [ball] = useState(() => new Animated.ValueXY({ x: bx * k, y: by * k }));
  const prevTurns = useRef(state.turns);

  useEffect(() => {
    const target = state.rot * 90;
    const [x, y] = ballAt(state, true);
    const [sx, sy] = xy(state.pos[0], state.pos[1]);
    const turned = state.turns > prevTurns.current && !!state.last;
    prevTurns.current = state.turns;
    if (reduced || !turned) {
      rot.setValue(target);
      ball.setValue({ x: x * k, y: y * k });
      return;
    }
    const last = state.last!;
    const legs: Animated.CompositeAnimation[] = [
      Animated.timing(rot, {
        toValue: target,
        duration: 280,
        easing: Easing.bezier(0.3, 0.7, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.delay(TURN_MS - 280),
    ];
    if (last.path.length)
      legs.push(
        Animated.timing(ball, {
          toValue: { x: sx * k, y: sy * k },
          duration: rollMs(last.path.length),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      );
    if (last.out)
      legs.push(
        Animated.timing(ball, {
          toValue: { x: x * k, y: y * k },
          duration: OUT_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      );
    const a = Animated.sequence(legs);
    a.start();
    return () => a.stop();
  }, [state, k, reduced, rot, ball]);

  const r = 14.5 * k;
  return (
    <View
      style={{ width: side, height: side }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Tilt maze, ${state.turns} turns`}
      testID="tilt-board">
      <Animated.View
        style={[
          styles.fill,
          {
            transform: [
              {
                rotate: rot.interpolate({
                  inputRange: [-36000, 36000],
                  outputRange: ['-36000deg', '36000deg'],
                }),
              },
            ],
          },
        ]}
        testID="tilt-maze">
        <Maze p={state.p} side={side} colors={colors} trail={new Set(state.trail)} />
        <Animated.View
          testID="tilt-ball"
          style={[
            styles.ball,
            {
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: colors.ball,
              transform: [
                { translateX: Animated.subtract(ball.x, r) },
                { translateY: Animated.subtract(ball.y, r) },
              ],
            },
          ]}>
          <View
            style={{
              position: 'absolute',
              left: r - 5 * k - 4.2 * k,
              top: r - 5 * k - 4.2 * k,
              width: 8.4 * k,
              height: 8.4 * k,
              borderRadius: 4.2 * k,
              backgroundColor: 'rgba(255,255,255,0.7)',
            }}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** The finish's recap: the maze with the shortest way out drawn from the start to the gap. */
export function TiltRecap({
  p,
  colors,
  side = 280,
}: {
  p: TiltData;
  colors: TiltColors;
  side?: number;
}) {
  const k = side / size(p);
  const pts = routePoints(p);
  const [sx, sy] = pts[0]!;
  return (
    <View style={{ width: side, height: side }} testID="tilt-recap">
      <Maze p={p} side={side} colors={colors} trail={new Set()} />
      {pts.slice(1).map((q, i) => (
        <Seg
          key={i}
          seg={[pts[i]![0], pts[i]![1], q[0], q[1]]}
          k={k}
          w={5 * k}
          color={colors.route}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: sx * k - 11 * k,
          top: sy * k - 11 * k,
          width: 22 * k,
          height: 22 * k,
          borderRadius: 11 * k,
          backgroundColor: colors.ball,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill,
  ball: { position: 'absolute', left: 0, top: 0 },
  mark: {
    position: 'absolute',
    width: 20,
    height: 28,
    fontSize: 26,
    lineHeight: 28,
    textAlign: 'center',
    fontFamily: FONT.display,
  },
});
