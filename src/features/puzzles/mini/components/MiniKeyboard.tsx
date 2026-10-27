import { useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';

/** The page's on-screen keyboard (#kb): three rows, ⌫ at the end of the last. */
export const KB_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

/** Space between keys, and the largest a letter key or ⌫ grows to. */
export const KEY_GAP = 4;
export const KEY_MAX = 40;
export const DEL_MAX = 64;

/** The Mini screen's side padding and widest content, for the first frame's estimate. */
const SCREEN_PAD = 12;
const SCREEN_MAX = 560;

/** The keyboard's width before it has been measured: the window less the screen's padding. */
export function estimateWidth(windowWidth: number): number {
  return Math.min(SCREEN_MAX, windowWidth) - 2 * SCREEN_PAD;
}

/**
 * Key widths for a keyboard `width` points wide: every letter key the same width, the
 * widest that lets the top row (ten keys) fit, up to KEY_MAX; ⌫ one and a half keys.
 *
 * Widths are set explicitly rather than left to flex: grow-to-a-maximum keys collapsed
 * the bottom row to bare borders when the slot was 367–372 pt (phones about 393 pt wide,
 * e.g. older Pixels), a layout-engine edge case where the row only just fits at its
 * maximum.
 */
export function keyWidths(width: number): { key: number; del: number } {
  const top = KB_ROWS[0].length;
  const fit = Math.floor((width - KEY_GAP * (top - 1)) / top);
  const key = Math.max(1, Math.min(KEY_MAX, fit));
  const room = width - KB_ROWS[2].length * (key + KEY_GAP);
  const del = Math.max(key, Math.min(DEL_MAX, Math.round(key * 1.5), Math.floor(room)));
  return { key, del };
}

interface MiniKeyboardProps {
  onKey: (ch: string) => void;
  onDelete: () => void;
}

export function MiniKeyboard({ onKey, onDelete }: MiniKeyboardProps) {
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? estimateWidth(win.width);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && (measured === null || Math.abs(w - measured) >= 0.5)) setMeasured(w);
  };
  const size = keyWidths(width);
  const key = { backgroundColor: pt.card, borderColor: pt.lineSoft };
  return (
    <View style={styles.kb} testID="mini-keyboard" onLayout={onLayout}>
      {KB_ROWS.map((row, i) => (
        <View key={row} style={styles.row}>
          {[...row].map((ch) => (
            <Pressable
              key={ch}
              testID={`key-${ch}`}
              accessibilityRole="button"
              accessibilityLabel={ch}
              onPress={() => onKey(ch)}
              style={({ pressed }) => [
                styles.key,
                { width: size.key },
                key,
                pressed && { backgroundColor: pt.activeWord },
              ]}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.text, { color: pt.ink }]}>
                {ch}
              </Text>
            </Pressable>
          ))}
          {i === 2 ? (
            <Pressable
              testID="key-del"
              accessibilityRole="button"
              accessibilityLabel="Delete"
              onPress={onDelete}
              style={({ pressed }) => [
                styles.key,
                { width: size.del },
                key,
                pressed && { backgroundColor: pt.activeWord },
              ]}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.text, { color: pt.ink }]}>
                ⌫
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kb: { gap: 6 },
  row: { flexDirection: 'row', gap: KEY_GAP, justifyContent: 'center' },
  key: {
    flexGrow: 0,
    flexShrink: 0,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 16, fontFamily: FONT.sansSemi },
});
