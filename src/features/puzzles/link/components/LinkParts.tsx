import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { FinishLink, Mark } from '@/shared/finish-sheet';

import { FONT, usePuzzleTokens } from '@/shared/theme';

import type { LinkGroup } from '../model';

/**
 * The finish sheet's group colours (finish.css --f-g1…--f-g4 and .fin-g*): the sheet's own
 * green, and group 4 turned light in dark mode so it shows on the dark sheet; the text and
 * marks on each in the colour that reads on it.
 */
export function useSheetGroups() {
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#11131A' : '#EDEEF2';
  const fill: Record<number, string> = {
    1: '#157A52',
    2: '#2E5BFF',
    3: '#FFD54A',
    4: dark ? '#ECEEF4' : '#141726',
  };
  const on: Record<number, string> = { 1: '#FFFFFF', 2: '#FFFFFF', 3: '#141726', 4: bg };
  return { fill, on };
}

/**
 * The board's colours: the groups as the sheet has them (house.css --g1…--g4: the hardest
 * group turns light in dark mode, its text the paper), and a wrong four's tiles (.tile.miss:
 * a pale red slab on light paper, a soft red tint in dark, house.css:134).
 */
export function useBoardColors() {
  const dark = useColorScheme() === 'dark';
  return { ...useSheetGroups(), missBg: dark ? 'rgba(255,122,110,0.16)' : '#FBE3E0' };
}

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

/**
 * The sheet's hero (finish.css .fin-guess): one 44 pt square per guess, the group's colour
 * with a drawn tick, or a miss as a red ring with a red cross.
 */
export function GuessSquares({ squares, names }: { squares: number[]; names: string[] }) {
  const pt = usePuzzleTokens();
  const g = useSheetGroups();
  return (
    <View
      style={styles.squares}
      accessibilityRole="image"
      accessibilityLabel={names.join(', ')}
      testID="guess-squares">
      {squares.map((r, i) => (
        <View
          key={i}
          style={[
            styles.square,
            r
              ? { backgroundColor: g.fill[r] }
              : { borderWidth: 2, borderColor: pt.sheetBad, backgroundColor: 'transparent' },
          ]}
          testID={r ? `guess-g${r}` : 'guess-x'}>
          <Mark kind={r ? 'tick' : 'cross'} color={r ? g.on[r]! : pt.sheetBad} />
        </View>
      ))}
    </View>
  );
}

/** The sheet's recap (finish.css .fin-bands): every group, easiest to hardest; the members lead. */
export function GroupBands({ groups }: { groups: LinkGroup[] }) {
  const g = useSheetGroups();
  return (
    <View style={styles.bands} testID="link-recap">
      {groups.map((x) => (
        <View
          key={x.rank}
          style={[styles.recapBand, { backgroundColor: g.fill[x.rank] }]}
          testID={`band-recap-${x.rank}`}>
          <Text style={[styles.recapName, { color: g.on[x.rank] }]}>{x.name}</Text>
          <Text style={[styles.recapMembers, { color: g.on[x.rank] }]}>{x.members.join(', ')}</Text>
        </View>
      ))}
    </View>
  );
}

/** "Play again (not recorded)" under a lost result. */
export function PlayAgain({ onPress }: { onPress: () => void }) {
  return <FinishLink label="Play again (not recorded)" onPress={onPress} />;
}

const styles = StyleSheet.create({
  art: { width: 132, height: 132, gap: 4, padding: 6 },
  artRow: { flexDirection: 'row', gap: 4 },
  artTile: { width: 26, height: 26, borderRadius: 5, borderWidth: 2 },
  squares: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  square: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bands: { gap: 6 },
  recapBand: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  recapName: { fontSize: 13, fontFamily: FONT.sansSemi },
  recapMembers: { fontSize: 15, fontFamily: FONT.display, letterSpacing: 0.3, marginTop: 2 },
});
