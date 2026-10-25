import { StyleSheet, View } from 'react-native';

/**
 * The few line icons the players draw (finish.js CHEVRON and SHARE_ICON, house.css's
 * How to play caret), built from bordered views: the app has no SVG library, and a text
 * glyph (›, ▾) sits at a different height in every font.
 */
export function Chevron({
  color,
  dir = 'right',
  size = 9,
}: {
  color: string;
  dir?: 'right' | 'down' | 'up' | 'left';
  size?: number;
}) {
  const turn = { right: '-45deg', down: '45deg', left: '135deg', up: '-135deg' }[dir];
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        borderRadius: 1,
        transform: [{ rotate: turn }],
        marginTop: dir === 'down' ? -size / 3 : dir === 'up' ? size / 3 : 0,
      }}
    />
  );
}

/** An arrow up out of a tray: the Share pill's icon. */
export function ShareGlyph({ color }: { color: string }) {
  return (
    <View style={styles.share} accessible={false} importantForAccessibility="no">
      <View style={[styles.tray, { borderColor: color }]} />
      <View style={[styles.stem, { backgroundColor: color }]} />
      <View style={[styles.head, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  share: { width: 18, height: 18 },
  tray: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 8,
    bottom: 0,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  stem: { position: 'absolute', left: 8, top: 1, width: 2, height: 11, borderRadius: 1 },
  head: {
    position: 'absolute',
    left: 5,
    top: 1.5,
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
});
