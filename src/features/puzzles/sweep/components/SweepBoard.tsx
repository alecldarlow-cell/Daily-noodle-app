import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Flag, Mark, RecapCell, RecapGrid, RecapText } from '@/shared/finish-sheet';
import { useReduceMotion, useWinWave, WaveFlash, WaveScale } from '@/shared/motion';
import { FONT, usePuzzleTokens, type PuzzleTokens } from '@/shared/theme';

import { LONG_PRESS_MS, N, overCount, recapCell, type SweepState } from '../model';
import { sweepColors, type SweepColors } from './colors';

interface SweepBoardProps {
  state: SweepState;
  side: number;
  dark: boolean;
  onTap: (i: number) => void;
  onPress: (i: number) => void;
  /** A fresh win: play the win's wave across the squares. */
  celebrating?: boolean;
}

const FLAG = '⚑';
const MINE = '✹';

function label(s: SweepState, i: number): string {
  const base = squareLabel(s, i);
  return s.mark && s.mark.i === i ? `${base}, marked by Hint` : base;
}

function squareLabel(s: SweepState, i: number): string {
  const r = Math.floor(i / N) + 1;
  const c = (i % N) + 1;
  const at = `row ${r}, column ${c}`;
  if (s.boomed.has(i)) return `${at}, the mine you hit`;
  if (s.revealed.has(i)) return `${at}, ${s.p.NUM[i] || 'clear'}`;
  if (s.flagged.has(i)) return `${at}, flagged`;
  if (!s.startDug)
    return i === s.p.start ? `${at}, the safe start: dig here first` : `${at}, locked`;
  return `${at}, hidden`;
}

/**
 * The 6×6 board as the page paints it: raised hidden squares (dimmed while locked,
 * the start pulsing marigold), open squares with their coloured numbers (struck
 * through when they touch too many flags), flags, the mine hit, Hint's marked square
 * and the numbers its line talks about, ringed. Tap digs (or flags in Flag mode);
 * a long press flags.
 */
export function SweepBoard({
  state,
  side,
  dark,
  onTap,
  onPress,
  celebrating = false,
}: SweepBoardProps) {
  const pt = usePuzzleTokens();
  const wave = useWinWave(celebrating, 2 * (N - 1));
  const sc = sweepColors(dark);
  const cell = side / N;
  return (
    <View
      style={[
        styles.grid,
        { width: side + 6, height: side + 6, borderColor: pt.line, backgroundColor: pt.line },
      ]}
      testID="sweep-board">
      {Array.from({ length: N }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: N }, (_, c) => {
            const i = r * N + c;
            return (
              <WaveScale key={c} wave={wave} at={r + c}>
                <Pressable
                  testID={`sq-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={label(state, i)}
                  delayLongPress={LONG_PRESS_MS}
                  onPress={() => onTap(i)}
                  onLongPress={() => onPress(i)}
                  style={[
                    styles.cell,
                    { width: cell, height: cell },
                    look(state, i, pt, sc, dark),
                  ]}>
                  <WaveFlash wave={wave} at={r + c} active={pt.active} word={pt.activeWord} />
                  {!state.startDug && i === state.p.start ? <StartPulse color={pt.active} /> : null}
                  {state.mark && state.mark.i === i && state.flagged.has(i) ? (
                    <HintPulse n={state.mark.n} color={sc.hidden} />
                  ) : null}
                  <Face state={state} i={i} size={cell} pt={pt} sc={sc} />
                </Pressable>
              </WaveScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * A square's paint. Hidden squares are raised as house.css draws them (a lit top edge, a
 * shaded 3 px foot); the safe start is ringed in marigold, not filled, so the pulse
 * under it reads; Hint's lines ring the squares they talk about.
 */
function look(s: SweepState, i: number, pt: PuzzleTokens, sc: SweepColors, dark: boolean) {
  const marked = s.mark && s.mark.i === i;
  const open = s.revealed.has(i) || s.boomed.has(i);
  const start = !s.startDug && i === s.p.start;
  let bg: string;
  if (s.boomed.has(i)) bg = pt.bad;
  else if (s.revealed.has(i)) bg = pt.card;
  else if (s.flagged.has(i)) bg = pt.active;
  else if (!s.startDug) bg = start ? sc.hidden : sc.locked;
  else bg = sc.hidden;
  if (marked && !s.revealed.has(i)) bg = pt.active;
  const raised =
    open || start
      ? null
      : {
          borderTopColor: dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.7)',
          borderBottomWidth: 3,
          borderBottomColor: dark ? 'rgba(0,0,0,0.22)' : 'rgba(20,23,38,0.12)',
        };
  // A flag Hint says is wrong is already marigold, so it gets a dark ring as well (sweep.css
  // .cell.flag.hint's outline) and HintPulse flashes it.
  const ring = s.why.includes(i)
    ? { borderWidth: 3, borderColor: sc.why }
    : start
      ? { borderWidth: 3, borderColor: pt.active }
      : marked && s.flagged.has(i)
        ? { borderWidth: 3, borderColor: pt.onActive }
        : null;
  return [{ backgroundColor: bg, borderColor: pt.cellEdge }, raised, ring];
}

/** The start square's slow marigold pulse (house.css dn-startpulse); still under Reduce motion. */
function StartPulse({ color }: { color: string }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce !== false) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="sweep-start-pulse"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] }),
        },
      ]}
    />
  );
}

/**
 * Hint's pulse on a flag it says is wrong (sweep.css hintpulse: twice over 1.1 s), so the
 * flag meant stands out from the others. Still under Reduce motion (the ring stays).
 */
function HintPulse({ n, color }: { n: number; color: string }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce !== false) return;
    v.setValue(0);
    const run = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
      { iterations: 2 },
    );
    run.start();
    return () => run.stop();
  }, [n, reduce, v]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="sweep-hint-pulse"
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: v }]}
    />
  );
}

function Face({
  state: s,
  i,
  size,
  pt,
  sc,
}: {
  state: SweepState;
  i: number;
  size: number;
  pt: PuzzleTokens;
  sc: SweepColors;
}) {
  const fs = size * 0.44;
  if (s.boomed.has(i))
    return (
      <Text maxFontSizeMultiplier={1.2} style={[styles.glyph, { fontSize: fs, color: '#fff' }]}>
        {MINE}
      </Text>
    );
  if (s.revealed.has(i)) {
    const n = s.p.NUM[i]!;
    if (n <= 0) return null;
    const over = overCount(s, i);
    return (
      <Text
        maxFontSizeMultiplier={1.2}
        style={[
          styles.num,
          { fontSize: fs, color: over ? pt.bad : sc.n[n] || pt.ink },
          over ? styles.over : null,
        ]}>
        {n}
      </Text>
    );
  }
  if (s.flagged.has(i))
    return (
      <Text maxFontSizeMultiplier={1.2} style={[styles.glyph, { fontSize: fs, color: sc.flag }]}>
        {FLAG}
      </Text>
    );
  return null;
}

/**
 * The finish sheet's board (.fin-grid g6 sw): every mine flagged on gold (or the one hit, pale
 * red with a cross), every number in the sheet's colours: 1 the link ink, 2 green, 3 up red.
 */
export function SweepRecap({ state }: { state: SweepState }) {
  const pt = usePuzzleTokens();
  const numColor = (v: number) => (v === 1 ? pt.actInk : v === 2 ? pt.good : pt.sheetBad);
  return (
    <RecapGrid
      n={N}
      testID="sweep-recap"
      cell={(r, c, size) => {
        const k = recapCell(state, r * N + c);
        if (k === 'flag')
          return (
            <RecapCell size={size} bg={pt.goldTint} testID="recap-mine" label="mine">
              <Flag size={size} color={pt.goldInk} />
            </RecapCell>
          );
        if (k === 'boom')
          return (
            <RecapCell size={size} bg="#FFD9D4" testID="recap-boom" label="the mine you hit">
              <Mark kind="cross" size={size * 0.4} color={pt.sheetBad} />
            </RecapCell>
          );
        return (
          <RecapCell size={size}>
            {k ? (
              <RecapText size={18} color={numColor(k)}>
                {k}
              </RecapText>
            ) : null}
          </RecapCell>
        );
      }}
    />
  );
}

/** The start card's picture: the board, the start square marigold (house.js art). */
export function SweepArt({ start }: { start: [number, number] }) {
  const pt = usePuzzleTokens();
  const sc = sweepColors(useColorScheme() === 'dark');
  return (
    <View style={[styles.art, { backgroundColor: pt.block }]} accessible={false}>
      {Array.from({ length: N }, (_, r) => (
        <View key={r} style={styles.artRow}>
          {Array.from({ length: N }, (_, c) => (
            <View
              key={c}
              style={[
                styles.artSq,
                {
                  backgroundColor: r === start[0] - 1 && c === start[1] - 1 ? '#FFD54A' : sc.hidden,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderWidth: 3, borderRadius: 10, overflow: 'hidden', alignSelf: 'center' },
  row: { flexDirection: 'row' },
  cell: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  num: { fontFamily: FONT.display, fontVariant: ['tabular-nums'] },
  over: { textDecorationLine: 'line-through' },
  glyph: { fontFamily: FONT.display },
  art: { width: 120, height: 120, borderRadius: 8, padding: 4, gap: 2 },
  artRow: { flexDirection: 'row', gap: 2 },
  artSq: { width: 16.5, height: 16.5, borderRadius: 2 },
});
