import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePuzzleTokens } from '@/shared/theme';

import { endMark, lines, N, type Cell, type PathState } from '../model';

const COBALT = '#2E5BFF';
const DEEP = '#1B3B9E';
const GREEN = '#1F9E6B';

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
}

/**
 * The 6×6 board as the page paints it: the numbers placed, the givens shaded, the
 * active end marigold and the other end ringed, the thread from 1 in cobalt and the
 * thread from 36 in deep blue, one green thread once it is complete.
 */
export function PathBoard({ state, side, onCell }: PathBoardProps) {
  const pt = usePuzzleTokens();
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
              return (
                <Pressable
                  key={c}
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
                      backgroundColor: m === 'active' ? pt.active : given ? pt.lineSoft : pt.card,
                    },
                    m === 'endsel' ? { borderWidth: 2, borderColor: pt.active } : null,
                  ]}
                />
              );
            })}
          </View>
        ))}
        {l.solved ? (
          <Thread cells={l.low} color={GREEN} cs={cs} w={cs * 0.07} />
        ) : (
          <>
            <Thread cells={l.low} color={COBALT} cs={cs} w={cs * 0.06} />
            <Thread cells={l.high} color={DEEP} cs={cs} w={cs * 0.06} />
          </>
        )}
        {Array.from({ length: N }, (_, r) =>
          Array.from({ length: N }, (_, c) => {
            const v = state.cellValue[r]![c];
            if (v === null || v === undefined) return null;
            const given = state.p.lockedSet.has(`${r},${c}`);
            const m = endMark(state, r, c);
            return (
              <View
                key={`${r}-${c}`}
                pointerEvents="none"
                style={[styles.numBox, { left: c * cs, top: r * cs, width: cs, height: cs }]}>
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
              </View>
            );
          }),
        )}
      </View>
    </View>
  );
}

/** The finish sheet's thread: every number, the givens shaded. */
export function PathRecap({ state }: { state: PathState }) {
  const pt = usePuzzleTokens();
  return (
    <View style={[styles.recap, { backgroundColor: pt.line }]} testID="path-recap">
      {state.p.solution.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((v, c) => (
            <View
              key={c}
              style={[
                styles.small,
                {
                  backgroundColor: state.p.lockedSet.has(`${r},${c}`) ? pt.lineSoft : pt.card,
                  borderColor: pt.cellEdge,
                },
              ]}>
              <Text maxFontSizeMultiplier={1.2} style={[styles.smallText, { color: pt.ink }]}>
                {v}
              </Text>
            </View>
          ))}
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
  num: { fontWeight: '700', borderRadius: 4, paddingHorizontal: 3, overflow: 'hidden' },
  recap: { alignSelf: 'flex-start', padding: 2, borderRadius: 8 },
  small: {
    width: 40,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallText: { fontSize: 15, fontWeight: '700' },
  art: { width: 120, height: 120, borderRadius: 8, padding: 4, gap: 2 },
  artRow: { flexDirection: 'row', gap: 2 },
  artSq: { width: 16.5, height: 16.5, borderRadius: 2 },
});
