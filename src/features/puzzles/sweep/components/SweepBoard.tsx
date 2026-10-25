import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePuzzleTokens, type PuzzleTokens } from '@/shared/theme';

import { LONG_PRESS_MS, N, overCount, recapCell, type SweepState } from '../model';
import { sweepColors, type SweepColors } from './colors';

interface SweepBoardProps {
  state: SweepState;
  side: number;
  dark: boolean;
  onTap: (i: number) => void;
  onPress: (i: number) => void;
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
export function SweepBoard({ state, side, dark, onTap, onPress }: SweepBoardProps) {
  const pt = usePuzzleTokens();
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
              <Pressable
                key={c}
                testID={`sq-${i}`}
                accessibilityRole="button"
                accessibilityLabel={label(state, i)}
                delayLongPress={LONG_PRESS_MS}
                onPress={() => onTap(i)}
                onLongPress={() => onPress(i)}
                style={[styles.cell, { width: cell, height: cell }, look(state, i, pt, sc)]}>
                <Face state={state} i={i} size={cell} pt={pt} sc={sc} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function look(s: SweepState, i: number, pt: PuzzleTokens, sc: SweepColors) {
  const ring = s.why.includes(i) ? { borderWidth: 3, borderColor: sc.why } : null;
  const marked = s.mark && s.mark.i === i;
  let bg: string;
  if (s.boomed.has(i)) bg = pt.bad;
  else if (s.revealed.has(i)) bg = pt.card;
  else if (s.flagged.has(i)) bg = pt.active;
  else if (!s.startDug) bg = i === s.p.start ? pt.active : sc.locked;
  else bg = sc.hidden;
  if (marked && !s.revealed.has(i)) bg = pt.active;
  return [{ backgroundColor: bg, borderColor: pt.cellEdge }, ring];
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
    return <Text style={[styles.glyph, { fontSize: fs, color: '#fff' }]}>{MINE}</Text>;
  if (s.revealed.has(i)) {
    const n = s.p.NUM[i]!;
    if (n <= 0) return null;
    const over = overCount(s, i);
    return (
      <Text
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
    return <Text style={[styles.glyph, { fontSize: fs, color: sc.flag }]}>{FLAG}</Text>;
  return null;
}

/** The finish sheet's board: every mine flagged (or the one hit), every number. */
export function SweepRecap({ state }: { state: SweepState }) {
  const pt = usePuzzleTokens();
  const sc = sweepColors(false);
  return (
    <View style={[styles.recap, { backgroundColor: pt.line }]} testID="sweep-recap">
      {Array.from({ length: N }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: N }, (_, c) => {
            const k = recapCell(state, r * N + c);
            return (
              <View
                key={c}
                style={[
                  styles.small,
                  { backgroundColor: k === 'boom' ? pt.bad : pt.card, borderColor: pt.cellEdge },
                ]}>
                <Text
                  style={[
                    styles.smallText,
                    { color: k === 'flag' ? sc.flag : k === 'boom' ? '#fff' : sc.n[k] || pt.ink },
                  ]}>
                  {k === 'flag' ? FLAG : k === 'boom' ? '✕' : k || ''}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The start card's picture: the board, the start square marigold (house.js art). */
export function SweepArt({ start }: { start: [number, number] }) {
  const pt = usePuzzleTokens();
  const sc = sweepColors(false);
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
  cell: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  num: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  over: { textDecorationLine: 'line-through' },
  glyph: { fontWeight: '700' },
  recap: { alignSelf: 'flex-start', padding: 2, borderRadius: 8 },
  small: {
    width: 40,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallText: { fontSize: 17, fontWeight: '700' },
  art: { width: 120, height: 120, borderRadius: 8, padding: 4, gap: 2 },
  artRow: { flexDirection: 'row', gap: 2 },
  artSq: { width: 16.5, height: 16.5, borderRadius: 2 },
});
