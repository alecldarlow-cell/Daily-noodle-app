import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReduceMotion } from '@/shared/motion';
import { FONT, usePuzzleTokens } from '@/shared/theme';

import { waveStep } from '../hooks/useRedactGame';
import { cellLabel, type RedactState } from '../model';

const GAP = 3;

interface Props {
  state: RedactState;
  side: number;
  /** The win beat is playing (the solved grid before the sheet). */
  celebrating?: boolean;
  onCell?: (i: number) => void;
}

/** One letter's square: a letter, or the black block when it's blacked out; green once solved. */
const Square = memo(function Square({
  letter,
  black,
  good,
  size,
  label,
  delay,
  pop,
  onPress,
  testID,
}: {
  letter: string;
  black: boolean;
  good: boolean;
  size: number;
  label: string;
  delay: number;
  pop: boolean;
  onPress?: () => void;
  testID: string;
}) {
  const pt = usePuzzleTokens();
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!pop) return;
    const a = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(scale, { toValue: 1.14, duration: 210, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 390, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [pop, delay, scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: black, disabled: !onPress }}
        disabled={!onPress}
        onPress={onPress}
        testID={testID}
        style={[
          styles.cell,
          {
            width: size,
            height: size,
            borderRadius: Math.max(4, size * 0.12),
            backgroundColor: black ? pt.block : pt.card,
            borderColor: black ? pt.block : pt.lineSoft,
          },
        ]}>
        {black ? null : (
          <Text
            allowFontScaling={false}
            style={[
              styles.letter,
              { fontSize: Math.round(size * 0.5), color: good ? pt.good : pt.ink },
            ]}>
            {letter}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
});

/** The board: n×n letters (engines/redact.js build/paint). A wrong full count shakes it. */
export function RedactBoard({ state, side, celebrating = false, onCell }: Props) {
  const { n } = state;
  const reduced = useReduceMotion() === true;
  const size = Math.floor((side - GAP * (n - 1)) / n);
  const off = new Set(state.black);
  const [shake] = useState(() => new Animated.Value(0));
  const shakes = useRef(state.shake);
  useEffect(() => {
    if (state.shake === shakes.current) return;
    shakes.current = state.shake;
    if (reduced) return;
    shake.setValue(0);
    Animated.sequence(
      [6, -6, 4, -4, 0].map((x) =>
        Animated.timing(shake, { toValue: x, duration: 60, useNativeDriver: true }),
      ),
    ).start();
  }, [state.shake, reduced, shake]);
  const step = waveStep(n);
  const pop = celebrating && !reduced;
  const rows = Array.from({ length: n }, (_, r) => r);
  return (
    <Animated.View
      testID="redact-board"
      accessibilityLabel="Redact board"
      style={[styles.board, { transform: [{ translateX: shake }] }]}>
      {rows.map((r) => (
        <View key={r} style={styles.row}>
          {rows.map((c) => {
            const i = r * n + c;
            return (
              <Square
                key={i}
                letter={state.p.letters[i]!}
                black={off.has(i)}
                good={state.solved && !off.has(i)}
                size={size}
                label={cellLabel(state, i)}
                delay={step * (r + c)}
                pop={pop && !off.has(i)}
                onPress={onCell && !state.solved ? () => onCell(i) : undefined}
                testID={`redact-cell-${i}`}
              />
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}

/** The finish sheet's crossword: the answer's blacks and letters, small. */
export function RedactRecap({ state, width }: { state: RedactState; width: number }) {
  const pt = usePuzzleTokens();
  const { n, p } = state;
  const size = Math.floor((Math.min(width, 300) - 2 * (n - 1)) / n);
  const off = new Set(p.black);
  return (
    <View testID="redact-recap">
      <View style={styles.recapGrid}>
        {Array.from({ length: n }, (_, r) => (
          <View key={r} style={[styles.row, { gap: 2 }]}>
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c;
              const b = off.has(i);
              return (
                <View
                  key={i}
                  style={[
                    styles.recapCell,
                    { width: size, height: size, backgroundColor: b ? pt.block : pt.card },
                  ]}>
                  {b ? null : (
                    <Text
                      allowFontScaling={false}
                      style={[styles.letter, { fontSize: Math.round(size * 0.5), color: pt.ink }]}>
                      {p.letters[i]}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={[styles.words, { color: pt.inkSoft }]} testID="redact-recap-words">
        {p.words.map((w) => w.toUpperCase()).join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { gap: GAP, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: GAP },
  cell: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: FONT.sansSemi },
  recapGrid: { gap: 2 },
  recapCell: { alignItems: 'center', justifyContent: 'center', borderRadius: 3 },
  words: { marginTop: 10, fontFamily: FONT.sans, fontSize: 13, lineHeight: 19 },
});
