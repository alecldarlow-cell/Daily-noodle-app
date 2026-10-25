import type { PuzzleType } from '@noodle/core';
import { Image, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { FONT, useTokens, type Tokens } from '@/shared/theme';

/** Cell kinds in a preview grid: block, pre-set, the start square, open. */
export type TileCell = 'b' | 'l' | 'a' | '';

/**
 * A card's grid preview from feed-lite's `mask`, as the site's front.js `puzzleTile`:
 * 16 = Link's 4×4 of chips, 25 = 5×5 Mini/Doku, 36 = 6×6 Sweep/Path. `#` block, `L`
 * pre-set, `o` Sweep's free opening, `.` open. The marigold start square is the opening
 * if there is one, otherwise the first open cell; Link has none. Null for any other length.
 */
export function tileCells(mask: string | undefined): { size: number; cells: TileCell[] } | null {
  if (!mask || ![16, 25, 36].includes(mask.length)) return null;
  const size = Math.sqrt(mask.length);
  const open = mask.indexOf('o');
  const start = mask.length === 16 ? -1 : open >= 0 ? open : mask.indexOf('.');
  const cells = [...mask].map(
    (c, i): TileCell => (c === '#' ? 'b' : c === 'L' ? 'l' : i === start ? 'a' : ''),
  );
  return { size, cells };
}

/** The site's picture tiles (assets/*-thumb.svg), drawn to PNG in light and dark. */
const PICTURES: Partial<Record<PuzzleType, { light: number; dark: number }>> = {
  borders: {
    light: require('../../../../assets/images/tiles/borders-light.png') as number,
    dark: require('../../../../assets/images/tiles/borders-dark.png') as number,
  },
  reckon: {
    light: require('../../../../assets/images/tiles/reckon-light.png') as number,
    dark: require('../../../../assets/images/tiles/reckon-dark.png') as number,
  },
  tangle: {
    light: require('../../../../assets/images/tiles/tangle-light.png') as number,
    dark: require('../../../../assets/images/tiles/tangle-dark.png') as number,
  },
};

const SIZE = 96;

function cellColour(t: Tokens, c: TileCell): string {
  return c === 'b' ? t.tileFrame : c === 'l' ? t.tileLock : c === 'a' ? t.play : t.tileCell;
}

interface PuzzleTileProps {
  type: PuzzleType;
  mask?: string;
  testID?: string;
}

/** A card's 96 pt preview: the puzzle's grid, the type's picture, or a plain "Play" tile. */
export function PuzzleTile({ type, mask, testID }: PuzzleTileProps) {
  const t = useTokens();
  const scheme = useColorScheme();
  const grid = tileCells(mask);
  const picture = PICTURES[type];

  if (grid) {
    const gap = grid.size === 4 ? 2.5 : 1.5;
    const rows = Array.from({ length: grid.size }, (_, r) =>
      grid.cells.slice(r * grid.size, (r + 1) * grid.size),
    );
    return (
      <View
        testID={testID}
        accessible={false}
        style={[styles.tile, styles.grid, { backgroundColor: t.tileFrame, gap }]}>
        {rows.map((row, r) => (
          <View key={r} style={[styles.row, { gap }]}>
            {row.map((c, i) => (
              <View
                key={i}
                testID={c === 'a' ? `${testID ?? 'tile'}-start` : undefined}
                style={[styles.cell, { backgroundColor: cellColour(t, c) }]}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (picture) {
    return (
      <Image
        testID={testID}
        accessible={false}
        source={scheme === 'dark' ? picture.dark : picture.light}
        style={[styles.tile, { borderColor: t.hair }]}
      />
    );
  }

  return (
    <View
      testID={testID}
      accessible={false}
      style={[styles.tile, styles.glyph, { backgroundColor: t.accentSoft, borderColor: t.hair }]}>
      <Text style={[styles.glyphText, { color: t.accent }]}>Play</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: SIZE,
    height: SIZE,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  grid: { padding: 9, borderWidth: 0 },
  row: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1 },
  glyph: { alignItems: 'center', justifyContent: 'center' },
  glyphText: {
    fontFamily: FONT.displayHeavy,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
