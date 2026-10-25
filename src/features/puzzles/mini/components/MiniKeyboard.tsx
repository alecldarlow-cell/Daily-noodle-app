import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';

/** The page's on-screen keyboard (#kb): three rows, ⌫ at the end of the last. */
export const KB_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

interface MiniKeyboardProps {
  onKey: (ch: string) => void;
  onDelete: () => void;
}

export function MiniKeyboard({ onKey, onDelete }: MiniKeyboardProps) {
  const pt = usePuzzleTokens();
  const key = { backgroundColor: pt.card, borderColor: pt.lineSoft };
  return (
    <View style={styles.kb} testID="mini-keyboard">
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
                styles.wide,
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
  row: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  key: {
    flex: 1,
    maxWidth: 40,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wide: { maxWidth: 64, flex: 1.5 },
  text: { fontSize: 16, fontFamily: FONT.sansSemi },
});
