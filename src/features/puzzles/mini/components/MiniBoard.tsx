import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePuzzleTokens } from '@/shared/theme';

import { status, type MiniState } from '../model';

interface MiniBoardProps {
  state: MiniState;
  /** The board's width and height in points. */
  side: number;
  onCell: (r: number, c: number) => void;
}

/** The 5×5 grid: blocks, numbers, letters, the marigold cursor, the highlighted word, check marks. */
export function MiniBoard({ state, side, onCell }: MiniBoardProps) {
  const pt = usePuzzleTokens();
  const { active } = status(state);
  const cell = side / 5;
  const inWord = (r: number, c: number) => !!active?.cells.some(([y, x]) => y === r && x === c);
  return (
    <View
      style={[
        styles.grid,
        { width: side + 6, height: side + 6, borderColor: pt.line, backgroundColor: pt.line },
      ]}
      testID="mini-board">
      {state.p.grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((ch, c) => {
            if (ch === '#')
              return (
                <View
                  key={c}
                  style={[
                    styles.cell,
                    { width: cell, height: cell, backgroundColor: pt.block, borderColor: pt.block },
                  ]}
                />
              );
            const here = state.sel.r === r && state.sel.c === c;
            const word = inWord(r, c);
            const mark = state.checked[r]![c];
            const letter = state.entries[r]![c] || '';
            const num = state.p.nums[r]![c];
            const ink = here ? pt.onActive : word ? pt.onWord : pt.ink;
            return (
              <Pressable
                key={c}
                testID={`cell-${r}-${c}`}
                accessibilityRole="button"
                accessibilityLabel={`${num ? `${num}, ` : ''}row ${r + 1}, column ${c + 1}, ${letter || 'empty'}${mark === 'bad' ? ', wrong' : ''}`}
                accessibilityState={{ selected: here }}
                onPress={() => onCell(r, c)}
                style={[
                  styles.cell,
                  {
                    width: cell,
                    height: cell,
                    borderColor: pt.cellEdge,
                    backgroundColor: here ? pt.active : word ? pt.activeWord : pt.card,
                  },
                ]}>
                {num ? (
                  <Text
                    style={[
                      styles.num,
                      { color: here ? pt.onActive : pt.inkSoft, fontSize: cell * 0.2 },
                    ]}>
                    {num}
                  </Text>
                ) : null}
                <Text
                  style={[
                    styles.ltr,
                    {
                      fontSize: cell * 0.46,
                      color: mark === 'good' ? pt.good : mark === 'bad' ? pt.bad : ink,
                    },
                  ]}>
                  {letter}
                </Text>
                {mark === 'bad' ? <View style={[styles.dot, { backgroundColor: pt.bad }]} /> : null}
              </Pressable>
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
  num: { position: 'absolute', top: 2, left: 4 },
  ltr: { fontWeight: '700' },
  dot: { position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3 },
});
