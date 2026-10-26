import { StyleSheet, View } from 'react-native';

import { RecapCell, RecapGrid, RecapText } from '@/shared/finish-sheet';
import { usePuzzleTokens } from '@/shared/theme';

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

/** The finish sheet's recap (.fin-grid g5): the solved grid with its numbers, at the site's size. */
export function SolvedGrid({ grid, nums }: { grid: string[][]; nums: number[][] }) {
  const pt = usePuzzleTokens();
  return (
    <RecapGrid
      n={5}
      testID="solved-grid"
      cell={(r, c, size) => {
        const ch = grid[r]![c]!;
        if (ch === '#')
          return <View style={{ width: size, height: size, backgroundColor: pt.block }} />;
        return (
          <RecapCell size={size} num={nums[r]![c]}>
            <RecapText>{ch}</RecapText>
          </RecapCell>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  art: { width: 132, height: 132, borderRadius: 8, padding: 5, gap: 2 },
  row: { flexDirection: 'row', gap: 2 },
  sq: { width: 22, height: 22, borderRadius: 2 },
});
