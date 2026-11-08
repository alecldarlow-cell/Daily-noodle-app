/*
 * A podium place as a struck-metal disc (Alec, 7 Nov 2026: design P4 on the mock canvas).
 * Gold, silver or bronze with a darker rim, a small highlight and the number. The first
 * time you see a board each day on which you placed, your disc pops and a shine sweeps
 * across it, once. Reduced motion (the app's switch or the phone's) skips that.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useReduceMotion } from '@/shared/motion';
import { appStorage } from '@/shared/storage';
import { FONT } from '@/shared/theme';

export type Place = 1 | 2 | 3;

export const METAL: Record<Place, { face: string; rim: string; hi: string; ink: string }> = {
  1: { face: '#E8B931', rim: '#B88A12', hi: '#FFF1B8', ink: '#5A4300' },
  2: { face: '#C3CAD6', rim: '#8C95A6', hi: '#F4F6FA', ink: '#2B3140' },
  3: { face: '#C9874A', rim: '#94592A', hi: '#F2C9A0', ink: '#3D2310' },
};

/** Your row's tint when you place: the medal's colour, faintly. */
export const placeTint = (p: Place): string => `${METAL[p].face}22`;

export const isPlace = (n: number | null | undefined): n is Place => n === 1 || n === 2 || n === 3;

/** Which boards have already shone today: `{ day, keys }`. A cache, safe to lose. */
export const SHINE_KEY = 'noodle-board-medal-shine';

/**
 * True the first time `key` is asked for on `day`, and remembers it; false after that.
 * A new day starts the list again.
 */
export function claimShine(key: string, day: string): boolean {
  let seen: { day?: string; keys?: string[] } = {};
  try {
    seen = JSON.parse(appStorage.getItem(SHINE_KEY) ?? '{}') ?? {};
  } catch {
    seen = {};
  }
  const keys = seen.day === day && Array.isArray(seen.keys) ? seen.keys : [];
  if (keys.includes(key)) return false;
  appStorage.setItem(SHINE_KEY, JSON.stringify({ day, keys: [...keys, key] }));
  return true;
}

const SIZE = 28;

export function PlaceMedal({
  place,
  shine,
  testID,
  size = SIZE,
}: {
  place: Place;
  /** Diameter in pt: 28 on boards; smaller inline in a line of text. */
  size?: number;
  /** Play the pop and shine once for this board and day: `{ key, day }`. */
  shine?: { key: string; day: string };
  testID?: string;
}) {
  const m = METAL[place];
  const reduce = useReduceMotion();
  const [pop] = useState(() => new Animated.Value(1));
  const [sweep] = useState(() => new Animated.Value(0));
  const key = shine?.key;
  const day = shine?.day;
  useEffect(() => {
    // Wait for the phone's answer (null) rather than play and then learn we shouldn't.
    if (!key || !day || reduce !== false) return;
    if (!claimShine(key, day)) return;
    Animated.parallel([
      Animated.sequence([
        Animated.timing(pop, {
          toValue: 1.18,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(sweep, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [key, day, reduce, pop, sweep]);
  const x = sweep.interpolate({ inputRange: [0, 1], outputRange: [-size, size] });
  const k = size / SIZE;
  return (
    <Animated.View
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.disc,
        size !== SIZE && {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1.5, 2 * k),
        },
        { backgroundColor: m.face, borderColor: m.rim, transform: [{ scale: pop }] },
      ]}>
      <View
        style={[
          styles.hi,
          { backgroundColor: m.hi },
          size !== SIZE && { top: 3 * k, left: 5 * k, width: 9 * k, height: 5 * k },
        ]}
      />
      <Text
        maxFontSizeMultiplier={1}
        style={[
          styles.n,
          { color: m.ink },
          size !== SIZE && { fontSize: 14 * k, lineHeight: 17 * k },
        ]}>
        {place}
      </Text>
      <Animated.View
        pointerEvents="none"
        style={[styles.shine, { transform: [{ translateX: x }, { rotate: '20deg' }] }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hi: {
    position: 'absolute',
    top: 3,
    left: 5,
    width: 9,
    height: 5,
    borderRadius: 3,
    opacity: 0.85,
    transform: [{ rotate: '-30deg' }],
  },
  n: { fontFamily: FONT.displayHeavy, fontSize: 14, lineHeight: 17 },
  shine: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});
