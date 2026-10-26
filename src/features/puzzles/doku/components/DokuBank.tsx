import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';

import { bankTiles, type DokuState } from '../model';

interface DokuBankProps {
  state: DokuState;
  onTile: (id: string) => void;
}

/**
 * A bank tile's side, in points, for a window: close to a grid square (the board's fifth
 * when it fills the width, up to its 420 pt cap), at 80% of that so a 13-tile bank wraps to
 * three rows at most, between 40 and 56 pt. A short phone (under 700 pt tall) keeps 44 pt
 * tiles, so the board keeps its room there.
 */
export function bankTileSize(win: { width: number; height: number }): number {
  const square = Math.min(win.width - 24, 420) / 5;
  const size = Math.round(Math.min(56, Math.max(40, square * 0.8)));
  return win.height < 700 ? Math.min(size, 44) : size;
}

/** The letter bank: the free tiles in order, the chosen one marigold; "bank empty" once all are down. */
export function DokuBank({ state, onTile }: DokuBankProps) {
  const pt = usePuzzleTokens();
  const free = bankTiles(state);
  const side = bankTileSize(useWindowDimensions());
  const tile = { width: side, height: side };
  const ch = { fontSize: Math.round(side * 0.42) };
  return (
    <View
      style={[styles.bank, { backgroundColor: pt.card, borderColor: pt.lineSoft }]}
      accessibilityLabel="Letter bank"
      testID="doku-bank">
      {free.length ? (
        free.map((t) => {
          const sel = state.selTile === t.id;
          return (
            <Pressable
              key={t.id}
              testID={`tile-${t.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Tile ${t.ch}`}
              accessibilityState={{ selected: sel }}
              onPress={() => onTile(t.id)}
              style={[
                styles.tile,
                tile,
                { borderColor: pt.line, backgroundColor: sel ? pt.active : pt.card },
              ]}>
              <Text
                maxFontSizeMultiplier={1.3}
                style={[styles.ch, ch, { color: sel ? pt.onActive : pt.ink }]}>
                {t.ch}
              </Text>
            </Pressable>
          );
        })
      ) : (
        <Text maxFontSizeMultiplier={1.3} style={[styles.empty, { color: pt.inkSoft }]}>
          bank empty
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
    padding: 6,
    minHeight: 58,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  tile: {
    borderWidth: 1.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ch: { fontFamily: FONT.display },
  empty: { alignSelf: 'center', fontFamily: FONT.sans, fontSize: 11, letterSpacing: 1.1 },
});
