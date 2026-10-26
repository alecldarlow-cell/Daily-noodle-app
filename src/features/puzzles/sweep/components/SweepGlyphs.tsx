/**
 * The board's flag and mine, drawn as the page draws them (engines/sweep.js FLAG_SVG and
 * MINE_SVG, a 24-unit box) out of plain Views, since the app has no SVG library: the
 * flag's ink pole and its two-tone blue pennant, the mine's white spikes and body with a
 * dark glint. Both are the page's fixed colours: a flag sits on marigold and a mine on
 * red in either theme.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';

const POLE = '#141726';
const PENNANT = '#2E5BFF';
const PENNANT_SHADE = '#1B3B9E';
const SPIKE = '#FFFFFF';
const GLINT = '#141726';

/** A bar `len` long and `w` thick centred on (cx, cy), turned `deg`, in units of `k`. */
function bar(k: number, cx: number, cy: number, len: number, w: number, deg = 0): ViewStyle {
  return {
    position: 'absolute',
    left: (cx - len / 2) * k,
    top: (cy - w / 2) * k,
    width: len * k,
    height: w * k,
    borderRadius: (w / 2) * k,
    transform: deg ? [{ rotate: `${deg}deg` }] : undefined,
  };
}

/** A pennant pointing right: its upright edge at x from y0 to y0 + h, its tip `len` along. */
function pennant(k: number, x: number, y0: number, h: number, len: number, color: string) {
  return {
    position: 'absolute' as const,
    left: x * k,
    top: y0 * k,
    width: 0,
    height: 0,
    borderTopWidth: (h / 2) * k,
    borderBottomWidth: (h / 2) * k,
    borderLeftWidth: len * k,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: color,
  };
}

function dot(k: number, cx: number, cy: number, r: number, color: string): ViewStyle {
  return {
    position: 'absolute',
    left: (cx - r) * k,
    top: (cy - r) * k,
    width: 2 * r * k,
    height: 2 * r * k,
    borderRadius: r * k,
    backgroundColor: color,
  };
}

/** The flag on a flagged square, `size` across. */
export function FlagGlyph({ size }: { size: number }) {
  const k = size / 24;
  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      testID="sweep-flag"
      accessible={false}>
      <View style={[bar(k, 7.6, 12, 17.2 + 2.6, 2.6, 90), { backgroundColor: POLE }]} />
      <View style={pennant(k, 9, 5.1, 7.6, 10.4, PENNANT_SHADE)} />
      <View style={pennant(k, 9, 3.8, 7.6, 10.4, PENNANT)} />
    </View>
  );
}

/** The mine on the square that was hit, `size` across. */
export function MineGlyph({ size }: { size: number }) {
  const k = size / 24;
  const spike = (deg: number) => [bar(k, 12, 12, 18.4, 2.1, deg), { backgroundColor: SPIKE }];
  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      testID="sweep-mine"
      accessible={false}>
      <View style={spike(0)} />
      <View style={spike(90)} />
      <View style={[bar(k, 12, 12, 13 * Math.SQRT2, 2.1, 45), { backgroundColor: SPIKE }]} />
      <View style={[bar(k, 12, 12, 13 * Math.SQRT2, 2.1, -45), { backgroundColor: SPIKE }]} />
      <View style={dot(k, 12, 12, 5.1, SPIKE)} />
      <View style={dot(k, 10.2, 10.2, 1.5, GLINT)} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { position: 'relative' } });
