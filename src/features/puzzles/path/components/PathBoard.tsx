import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useRecapWidth } from '@/shared/finish-sheet';
import { useReduceMotion, useWinWave, WaveFlash, WaveScale } from '@/shared/motion';
import { FONT, usePuzzleTokens } from '@/shared/theme';

import { endMark, lines, N, type Cell, type PathState } from '../model';
import { pathColors } from './colors';

/** How long a rejected square shakes (path.css .cell.shake, 0.3 s). */
export const SHAKE_MS = 300;

/**
 * The rejected square's shake (path.css @keyframes shake: 4 px left, 4 px right), run
 * each time the model counts another rejection. Still under Reduce motion.
 */
function useShake(n: number | undefined) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  const last = useRef(n);
  useEffect(() => {
    if (n === last.current) return;
    last.current = n;
    if (reduce !== false) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: SHAKE_MS, useNativeDriver: true }).start();
  }, [n, reduce, v]);
  const dx = useMemo(
    () => v.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [0, -4, 4, 0] }),
    [v],
  );
  return reduce === false ? dx : null;
}

/** A thread drawn as one rounded bar per step (every step is to a touching square). */
function Thread({ cells, color, cs, w }: { cells: Cell[]; color: string; cs: number; w: number }) {
  const bars = [];
  for (let k = 1; k < cells.length; k++) {
    const [r0, c0] = cells[k - 1]!;
    const [r1, c1] = cells[k]!;
    const x = Math.min(c0, c1) * cs + cs / 2 - w / 2;
    const y = Math.min(r0, r1) * cs + cs / 2 - w / 2;
    bars.push(
      <View
        key={k}
        pointerEvents="none"
        testID="thread-bar"
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: Math.abs(c1 - c0) * cs + w,
          height: Math.abs(r1 - r0) * cs + w,
          borderRadius: w / 2,
          backgroundColor: color,
        }}
      />,
    );
  }
  return <>{bars}</>;
}

interface PathBoardProps {
  state: PathState;
  side: number;
  onCell: (r: number, c: number) => void;
  /** A fresh solve: every open square pulses at once, as path.css does. */
  celebrating?: boolean;
}

/**
 * The 6×6 board as the page paints it: the numbers placed, the givens shaded, the
 * active end marigold and the other end ringed, the thread from 1 in cobalt and the
 * thread from 36 in deep blue, one green thread once it is complete.
 */
export function PathBoard({ state, side, onCell, celebrating = false }: PathBoardProps) {
  const pt = usePuzzleTokens();
  const pc = pathColors(useColorScheme() === 'dark');
  const wave = useWinWave(celebrating, 0);
  const dx = useShake(state.shake?.n);
  const shook = (r: number, c: number) =>
    !!dx && !!state.shake && state.shake.r === r && state.shake.c === c;
  const cs = side / N;
  const l = lines(state);
  return (
    <View
      style={[
        styles.grid,
        { width: side + 6, height: side + 6, borderColor: pt.line, backgroundColor: pt.line },
      ]}
      testID="path-board">
      <View style={{ width: side, height: side }}>
        {Array.from({ length: N }, (_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: N }, (_, c) => {
              const v = state.cellValue[r]![c];
              const given = state.p.lockedSet.has(`${r},${c}`);
              const m = endMark(state, r, c);
              const w = given ? null : wave;
              return (
                <WaveScale key={c} wave={w} at={0}>
                  <Animated.View
                    testID={shook(r, c) ? 'path-shake' : undefined}
                    style={shook(r, c) && dx ? { transform: [{ translateX: dx }] } : null}>
                    <Pressable
                      testID={`sq-${r}-${c}`}
                      accessibilityRole="button"
                      accessibilityLabel={`row ${r + 1}, column ${c + 1}, ${v ?? 'empty'}${given ? ', given' : ''}${m === 'active' ? ', active end' : ''}`}
                      onPress={() => onCell(r, c)}
                      style={[
                        styles.cell,
                        {
                          width: cs,
                          height: cs,
                          borderColor: pt.cellEdge,
                          backgroundColor:
                            m === 'active' ? pt.active : given ? pt.lineSoft : pt.card,
                        },
                        m === 'endsel' ? { borderWidth: 2, borderColor: pt.active } : null,
                      ]}>
                      <WaveFlash wave={w} at={0} active={pt.active} word={pt.activeWord} />
                    </Pressable>
                  </Animated.View>
                </WaveScale>
              );
            })}
          </View>
        ))}
        {l.solved ? (
          <Thread cells={l.low} color={pc.done} cs={cs} w={cs * 0.07} />
        ) : (
          <>
            <Thread cells={l.low} color={pc.low} cs={cs} w={cs * 0.06} />
            <Thread cells={l.high} color={pc.high} cs={cs} w={cs * 0.06} />
          </>
        )}
        {Array.from({ length: N }, (_, r) =>
          Array.from({ length: N }, (_, c) => {
            const v = state.cellValue[r]![c];
            if (v === null || v === undefined) return null;
            const given = state.p.lockedSet.has(`${r},${c}`);
            const m = endMark(state, r, c);
            return (
              <Animated.View
                key={`${r}-${c}`}
                pointerEvents="none"
                style={[
                  styles.numBox,
                  { left: c * cs, top: r * cs, width: cs, height: cs },
                  shook(r, c) && dx ? { transform: [{ translateX: dx }] } : null,
                ]}>
                <Text
                  maxFontSizeMultiplier={1.2}
                  style={[
                    styles.num,
                    {
                      fontSize: cs * 0.36,
                      color: m === 'active' ? '#141726' : given ? pt.inkSoft : pt.ink,
                      backgroundColor: m === 'active' ? pt.active : given ? pt.lineSoft : pt.card,
                    },
                  ]}>
                  {v}
                </Text>
              </Animated.View>
            );
          }),
        )}
      </View>
    </View>
  );
}

/** Each number's square, 1 to 36, from the solution grid. */
export function threadCells(solution: number[][]): Cell[] {
  const at: Cell[] = [];
  solution.forEach((row, r) => row.forEach((v, c) => (at[v - 1] = [r, c])));
  return at.filter(Boolean);
}

/**
 * The finish sheet's thread (.fin-path): every number in a round pill, the givens tinted,
 * and the blue line through 1 to 36 beneath them, at the site's size.
 */
export function PathRecap({ state }: { state: PathState }) {
  const pt = usePuzzleTokens();
  const w = useRecapWidth();
  const cs = (w - 4) / N;
  const sol = state.p.solution;
  return (
    <View
      style={[styles.recap, { width: w, borderColor: pt.line, backgroundColor: pt.card }]}
      testID="path-recap">
      <View style={StyleSheet.absoluteFill} testID="path-recap-thread">
        <View style={styles.threadLayer}>
          <Thread cells={threadCells(sol)} color={pt.brand} cs={cs} w={5} />
        </View>
      </View>
      {sol.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((v, c) => {
            const given = state.p.lockedSet.has(`${r},${c}`);
            return (
              <View
                key={c}
                style={[styles.recapCell, { width: cs, height: cs, borderColor: pt.rule }]}>
                <View
                  testID={given ? `path-given-${v}` : undefined}
                  style={[styles.pill, { backgroundColor: given ? pt.brandTint : pt.card }]}>
                  <Text maxFontSizeMultiplier={1.2} style={[styles.pillText, { color: pt.ink }]}>
                    {v}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The start card's picture: the board with the marigold 1 (house.js art). */
export function PathArt({ one }: { one: Cell | null }) {
  const pt = usePuzzleTokens();
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
                  backgroundColor: one && one[0] === r && one[1] === c ? '#FFD54A' : pt.card,
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
  cell: { borderWidth: StyleSheet.hairlineWidth },
  numBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: FONT.display, borderRadius: 4, paddingHorizontal: 3, overflow: 'hidden' },
  recap: { alignSelf: 'flex-start', borderWidth: 2, borderRadius: 6, overflow: 'hidden' },
  threadLayer: { flex: 1, opacity: 0.5 },
  recapCell: { borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  pill: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 15, fontFamily: FONT.display },
  art: { width: 120, height: 120, borderRadius: 8, padding: 4, gap: 2 },
  artRow: { flexDirection: 'row', gap: 2 },
  artSq: { width: 16.5, height: 16.5, borderRadius: 2 },
});
