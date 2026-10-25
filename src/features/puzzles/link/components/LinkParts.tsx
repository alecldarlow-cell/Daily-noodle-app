import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';

import type { LinkGroup } from '../model';

/** The four group colours, easiest to hardest (engines/link.css --g1…--g4). */
export const GROUP = { 1: '#1F9E6B', 2: '#2E5BFF', 3: '#FFD54A', 4: '#141726' } as Record<
  number,
  string
>;
/** Text on a group's colour: ink on marigold, white on the rest. */
export const ON_GROUP = { 1: '#FFFFFF', 2: '#FFFFFF', 3: '#141726', 4: '#FFFFFF' } as Record<
  number,
  string
>;

/** The start card's picture: four rows of tiles, three of the second row held (house.js art). */
export function LinkArt() {
  const pt = usePuzzleTokens();
  return (
    <View style={styles.art} accessible={false}>
      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={styles.artRow}>
          {[0, 1, 2, 3].map((col) => {
            const k = row * 4 + col;
            const sel = (row === 1 && col < 3) || k === 9;
            return (
              <View
                key={col}
                style={[
                  styles.artTile,
                  {
                    backgroundColor: sel ? '#FFF0B8' : pt.card,
                    borderColor: sel ? '#FFD54A' : pt.lineSoft,
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

/** The sheet's hero: one square per guess, the group's colour with a tick, or a cross. */
export function GuessSquares({ squares, names }: { squares: number[]; names: string[] }) {
  const pt = usePuzzleTokens();
  return (
    <View
      style={styles.squares}
      accessibilityRole="image"
      accessibilityLabel={names.join(', ')}
      testID="guess-squares">
      {squares.map((r, i) => (
        <View
          key={i}
          style={[styles.square, { backgroundColor: r ? GROUP[r] : pt.bad }]}
          testID={r ? `guess-g${r}` : 'guess-x'}>
          <Text style={[styles.mark, { color: r ? ON_GROUP[r] : '#FFFFFF' }]}>{r ? '✓' : '✕'}</Text>
        </View>
      ))}
    </View>
  );
}

/** The sheet's recap: every group, easiest to hardest. */
export function GroupBands({ groups }: { groups: LinkGroup[] }) {
  return (
    <View style={styles.bands} testID="link-recap">
      {groups.map((g) => (
        <View key={g.rank} style={[styles.recapBand, { backgroundColor: GROUP[g.rank] }]}>
          <Text style={[styles.recapName, { color: ON_GROUP[g.rank] }]}>{g.name}</Text>
          <Text style={[styles.recapMembers, { color: ON_GROUP[g.rank] }]}>
            {g.members.join(', ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** "Play again (not recorded)" under a lost result. */
export function PlayAgain({ onPress }: { onPress: () => void }) {
  const pt = usePuzzleTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={styles.again}>
      <Text style={[styles.againText, { color: pt.brand }]}>Play again (not recorded)</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  art: { width: 132, height: 132, gap: 4, padding: 6 },
  artRow: { flexDirection: 'row', gap: 4 },
  artTile: { width: 26, height: 26, borderRadius: 5, borderWidth: 2 },
  squares: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  square: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { fontSize: 20, fontFamily: FONT.displayHeavy },
  bands: { gap: 8 },
  recapBand: { borderRadius: 11, padding: 12, gap: 2 },
  recapName: { fontSize: 15, fontFamily: FONT.display },
  recapMembers: { fontFamily: FONT.sans, fontSize: 14 },
  again: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  againText: { fontSize: 16, fontFamily: FONT.sansSemi, textDecorationLine: 'underline' },
});
