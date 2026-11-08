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

/**
 * The on-screen keyboard: the phone's own staggered QWERTY, run edge to edge. The
 * bottom row is Help · Z–M · ⌫, Help sitting where Shift would (Alec, 8 Nov 2026).
 */
export const KB_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

/** Space between keys, and the largest a letter key or a side key (Help, ⌫) grows to. */
export const KEY_GAP = 5;
export const KEY_MAX = 48;
export const DEL_MAX = 72;

/** Key height: tall on most phones; the old height on short screens so the board keeps its room. */
export const KEY_TALL = 56;
export const KEY_SHORT = 46;
export const TALL_FROM = 700;
export function keyHeight(windowHeight: number): number {
  return windowHeight >= TALL_FROM ? KEY_TALL : KEY_SHORT;
}

/** The Mini screen's side padding, how far the keyboard reaches into it, and its widest content. */
const SCREEN_PAD = 12;
export const KB_BLEED = 8;
const SCREEN_MAX = 560;

/** The keyboard's width before it has been measured: the window less the screen's padding, plus the bleed. */
export function estimateWidth(windowWidth: number): number {
  return Math.min(SCREEN_MAX, windowWidth) - 2 * SCREEN_PAD + 2 * KB_BLEED;
}

/**
 * Key widths for a keyboard `width` points wide: every letter key the same width, the
 * widest that lets the top row (ten keys) fit, up to KEY_MAX; Help and ⌫ share what is
 * left of the bottom row, between one key and DEL_MAX.
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
  const n = KB_ROWS[2].length;
  const side = Math.floor((width - n * key - (n + 1) * KEY_GAP) / 2);
  const del = Math.max(key, Math.min(DEL_MAX, side));
  return { key, del };
}

interface MiniKeyboardProps {
  onKey: (ch: string) => void;
  onDelete: () => void;
  onHelp: () => void;
}

export function MiniKeyboard({ onKey, onDelete, onHelp }: MiniKeyboardProps) {
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? estimateWidth(win.width);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && (measured === null || Math.abs(w - measured) >= 0.5)) setMeasured(w);
  };
  const size = keyWidths(width);
  const height = keyHeight(win.height);
  const key = { backgroundColor: pt.card, borderColor: pt.lineSoft, height };
  const pressedKey = { backgroundColor: pt.activeWord };
  return (
    <View style={styles.kb} testID="mini-keyboard" onLayout={onLayout}>
      {KB_ROWS.map((row, i) => (
        <View key={row} style={styles.row}>
          {i === 2 ? (
            <Pressable
              testID="key-help"
              accessibilityRole="button"
              accessibilityLabel="Help"
              accessibilityHint="Check or reveal letters"
              onPress={onHelp}
              style={({ pressed }) => [
                styles.key,
                styles.help,
                { width: size.del, height, borderColor: pt.inkSoft },
                pressed && pressedKey,
              ]}>
              <Text maxFontSizeMultiplier={1.2} style={[styles.helpText, { color: pt.ink }]}>
                Help
              </Text>
            </Pressable>
          ) : null}
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
                pressed && pressedKey,
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
                pressed && pressedKey,
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
  kb: { gap: 10, marginHorizontal: -KB_BLEED },
  row: { flexDirection: 'row', gap: KEY_GAP, justifyContent: 'center' },
  key: {
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A quiet outlined key: it shouldn't pull the eye while typing.
  help: { borderWidth: 1.5, backgroundColor: 'transparent' },
  text: { fontSize: 20, fontFamily: FONT.sansSemi },
  helpText: { fontSize: 14, fontFamily: FONT.sansSemi },
});
