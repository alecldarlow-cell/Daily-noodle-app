import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useWinWave, WaveFlash, WaveScale } from '@/shared/motion';
import { FONT, usePuzzleTokens } from '@/shared/theme';

import { activeWord, goodSquares, isLock, letterAt, type DokuState } from '../model';

/** Given squares' background (house.css --cell-locked, light and dark). */
export const useLockedColor = () => (useColorScheme() === 'dark' ? '#1E2230' : '#DFE3EC');

interface DokuBoardProps {
  state: DokuState;
  /** The board's width and height in points. */
  side: number;
  onCell: (r: number, c: number) => void;
  /** A fresh solve: play the win's wave across the squares. */
  celebrating?: boolean;
}

/**
 * The 5×5 grid as the page paints it: blocks, numbers, given squares shaded, placed
 * letters, the marigold cursor, the highlighted word, and words green once they match
 * the answer (with Hints on). A typed letter the bank doesn't hold shakes the square.
 */
export function DokuBoard({ state, side, onCell, celebrating = false }: DokuBoardProps) {
  const pt = usePuzzleTokens();
  const wave = useWinWave(celebrating, 8);
  const locked = useLockedColor();
  const active = activeWord(state);
  const good = goodSquares(state);
  const cell = side / 5;
  const [shake] = useState(() => new Animated.Value(0));
  const shakes = useRef(state.shakes);
  useEffect(() => {
    if (state.shakes === shakes.current) return;
    shakes.current = state.shakes;
    shake.setValue(0);
    Animated.timing(shake, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [state.shakes, shake]);
  const dx = useMemo(
    () =>
      shake.interpolate({
        inputRange: [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1],
        outputRange: [0, -1.5, 3, -3, 3, -1.5, 0],
      }),
    [shake],
  );
  const inWord = (r: number, c: number) => !!active?.cells.some(([y, x]) => y === r && x === c);
  return (
    <View
      style={[
        styles.grid,
        { width: side + 6, height: side + 6, borderColor: pt.line, backgroundColor: pt.line },
      ]}
      testID="doku-board">
      {state.p.grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((ch, c) => {
            if (ch === '#')
              return (
                <Pressable
                  key={c}
                  testID={`cell-${r}-${c}`}
                  accessible={false}
                  onPress={() => onCell(r, c)}
                  style={[
                    styles.cell,
                    { width: cell, height: cell, backgroundColor: pt.block, borderColor: pt.block },
                  ]}
                />
              );
            const here = state.view.r === r && state.view.c === c;
            const word = inWord(r, c);
            const given = isLock(state.p, r, c);
            const green = good.has(r + ',' + c);
            const letter = letterAt(state, r, c);
            const num = state.p.nums[r]![c];
            const shaking = state.sel.r === r && state.sel.c === c;
            const bg = given ? locked : here ? pt.active : word ? pt.activeWord : pt.card;
            // The cursor on a given square keeps the given's shade and ink, ringed in
            // marigold, so the letter stays readable and the cursor still shows.
            const ring = here && given;
            const ink =
              here && !given
                ? pt.onActive
                : green
                  ? pt.good
                  : given
                    ? pt.inkSoft
                    : word
                      ? pt.onWord
                      : pt.ink;
            return (
              <WaveScale key={c} wave={wave} at={r + c}>
                <Pressable
                  testID={`cell-${r}-${c}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${num ? `${num}, ` : ''}row ${r + 1}, column ${c + 1}, ${letter || 'empty'}${given ? ', given' : ''}${green ? ', right' : ''}`}
                  accessibilityState={{ selected: here }}
                  onPress={() => onCell(r, c)}
                  style={[
                    styles.cell,
                    { width: cell, height: cell, borderColor: pt.cellEdge, backgroundColor: bg },
                    ring ? { borderWidth: 3, borderColor: pt.active } : null,
                  ]}>
                  <WaveFlash wave={wave} at={r + c} active={pt.active} word={pt.activeWord} />
                  <Animated.View
                    style={[styles.fill, shaking ? { transform: [{ translateX: dx }] } : null]}>
                    {num ? (
                      <Text
                        maxFontSizeMultiplier={1.2}
                        style={[
                          styles.num,
                          {
                            color: here && !given ? pt.onActive : pt.inkSoft,
                            fontSize: cell * 0.17,
                          },
                        ]}>
                        {num}
                      </Text>
                    ) : null}
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[styles.ltr, { fontSize: cell * 0.46, color: ink }]}>
                      {letter}
                    </Text>
                  </Animated.View>
                </Pressable>
              </WaveScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderWidth: 3, borderRadius: 10, overflow: 'hidden', alignSelf: 'center' },
  row: { flexDirection: 'row' },
  cell: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  num: { position: 'absolute', top: 2, left: 4, fontFamily: FONT.sansMedium },
  ltr: { fontFamily: FONT.display },
});
