import { StyleSheet, Text, View } from 'react-native';

import { usePuzzleTokens } from '@/shared/theme';

import { isLock, recapSub, type DokuPuzzle } from '../model';
import { useLockedColor } from './DokuBoard';

/** The finish sheet's recap: "The five given letters are shaded." and the solved grid. */
export function SolvedGrid({ p }: { p: DokuPuzzle }) {
  const pt = usePuzzleTokens();
  const locked = useLockedColor();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.sub, { color: pt.inkSoft }]}>{recapSub(p)}</Text>
      <View style={[styles.solved, { backgroundColor: pt.line }]} testID="solved-grid">
        {p.grid.map((row, r) => (
          <View key={r} style={styles.solvedRow}>
            {row.map((ch, c) => {
              const given = ch !== '#' && isLock(p, r, c);
              return (
                <View
                  key={c}
                  testID={given ? `given-${r}-${c}` : undefined}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: ch === '#' ? pt.block : given ? locked : pt.card,
                      borderColor: pt.cellEdge,
                    },
                  ]}>
                  {ch !== '#' && p.nums[r]![c] ? (
                    <Text style={[styles.num, { color: pt.inkSoft }]}>{p.nums[r]![c]}</Text>
                  ) : null}
                  {ch !== '#' ? <Text style={[styles.ltr, { color: pt.ink }]}>{ch}</Text> : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  sub: { fontSize: 14 },
  solved: { alignSelf: 'flex-start', padding: 2, borderRadius: 8 },
  solvedRow: { flexDirection: 'row' },
  cell: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { position: 'absolute', top: 1, left: 3, fontSize: 9 },
  ltr: { fontSize: 20, fontWeight: '700' },
});
