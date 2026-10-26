import type { ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';

/** The recap grids' width (finish.css .fin-grid: min(100%, 300px)). */
export const RECAP_MAX = 300;

/** As wide as the site draws it, or the column on a narrow phone (the sheet has 20 pt sides). */
export function useRecapWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(RECAP_MAX, Math.max(160, width - 40));
}

/** One square of a recap grid: the cell, its number top-left, its letter or figure. */
export function RecapCell({
  size,
  bg,
  num,
  children,
  testID,
  label,
}: {
  size: number;
  bg?: string;
  num?: number | null;
  children?: ReactNode;
  testID?: string;
  label?: string;
}) {
  const pt = usePuzzleTokens();
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={[
        styles.cell,
        { width: size, height: size, backgroundColor: bg ?? pt.card, borderColor: pt.rule },
      ]}>
      {num ? (
        <Text maxFontSizeMultiplier={1.2} style={[styles.num, { color: pt.sheetSoft }]}>
          {num}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** A recap's letter or figure, 22 bold as .fin-grid i (18 on Sweep's). */
export function RecapText({
  children,
  color,
  size = 22,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
}) {
  const pt = usePuzzleTokens();
  return (
    <Text
      maxFontSizeMultiplier={1.2}
      style={[styles.ltr, { color: color ?? pt.ink, fontSize: size }]}>
      {children}
    </Text>
  );
}

/**
 * The frame round a recap grid (.fin-grid): 2 pt in the frame colour, radius 6, the blocks'
 * colour behind; `n` squares a side, sized to fill the width.
 */
export function RecapGrid({
  n,
  testID,
  cell,
}: {
  n: number;
  testID?: string;
  cell: (r: number, c: number, size: number) => ReactNode;
}) {
  const pt = usePuzzleTokens();
  const w = useRecapWidth();
  const size = (w - 4) / n;
  return (
    <View
      testID={testID}
      style={[styles.frame, { width: w, borderColor: pt.line, backgroundColor: pt.block }]}>
      {Array.from({ length: n }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: n }, (_, c) => (
            <View key={c}>{cell(r, c, size)}</View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Sweep's flag (sweep.js FLAG: a pole and a pennant), drawn, at 44% of the square. */
export function Flag({ size, color }: { size: number; color: string }) {
  const s = size * 0.44;
  const k = s / 16;
  return (
    <View style={{ width: s, height: s }} testID="recap-flag" accessible={false}>
      <View
        style={{
          position: 'absolute',
          left: 3.2 * k,
          top: 1.2 * k,
          width: 1.6 * k,
          height: 13.6 * k,
          borderRadius: 0.8 * k,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 4 * k,
          top: 1.7 * k,
          width: 0,
          height: 0,
          borderTopWidth: 2.85 * k,
          borderBottomWidth: 2.85 * k,
          borderLeftWidth: 8.8 * k,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'flex-start', borderWidth: 2, borderRadius: 6, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  cell: { borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  num: { position: 'absolute', left: 4, top: 3, fontSize: 10, fontFamily: FONT.sansSemi },
  ltr: { fontFamily: FONT.display },
});
