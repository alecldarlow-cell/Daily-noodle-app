import { StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';

/** The start card's picture: the day's block pattern, the top row lit (house.js art). */
export function MiniArt({ grid }: { grid: string[][] }) {
  const pt = usePuzzleTokens();
  return (
    <View style={[styles.art, { backgroundColor: pt.block }]} accessible={false}>
      {grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((ch, c) => {
            const blk = ch === '#';
            const lit = r === 0 && !blk && c > 0 && c < 4;
            return (
              <View
                key={c}
                style={[
                  styles.sq,
                  {
                    backgroundColor: blk
                      ? pt.block
                      : lit
                        ? c === 1
                          ? '#FFD54A'
                          : '#FFF0B8'
                        : pt.card,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The finish sheet's recap: the solved grid with its numbers. */
export function SolvedGrid({ grid, nums }: { grid: string[][]; nums: number[][] }) {
  const pt = usePuzzleTokens();
  return (
    <View style={[styles.solved, { backgroundColor: pt.line }]} testID="solved-grid">
      {grid.map((row, r) => (
        <View key={r} style={styles.solvedRow}>
          {row.map((ch, c) => (
            <View
              key={c}
              style={[
                styles.cell,
                { backgroundColor: ch === '#' ? pt.block : pt.card, borderColor: pt.cellEdge },
              ]}>
              {ch !== '#' && nums[r]![c] ? (
                <Text style={[styles.num, { color: pt.inkSoft }]}>{nums[r]![c]}</Text>
              ) : null}
              {ch !== '#' ? <Text style={[styles.ltr, { color: pt.ink }]}>{ch}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { width: 132, height: 132, borderRadius: 8, padding: 5, gap: 2 },
  row: { flexDirection: 'row', gap: 2 },
  sq: { width: 22, height: 22, borderRadius: 2 },
  solved: { alignSelf: 'flex-start', padding: 2, borderRadius: 8 },
  solvedRow: { flexDirection: 'row' },
  cell: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { position: 'absolute', top: 1, left: 3, fontFamily: FONT.sans, fontSize: 9 },
  ltr: { fontSize: 20, fontFamily: FONT.display },
});
