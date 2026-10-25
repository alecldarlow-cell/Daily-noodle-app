import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';

interface MiniControlsProps {
  onCheckWord: () => void;
  onCheckAll: () => void;
  onRevealWord: () => void;
}

/** Check word, Check all, Reveal word: the page's controls on a phone. */
export function MiniControls({ onCheckWord, onCheckAll, onRevealWord }: MiniControlsProps) {
  const pt = usePuzzleTokens();
  const b = [styles.btn, { borderColor: pt.ink, backgroundColor: pt.card }];
  const label = [styles.text, { color: pt.ink }];
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onCheckWord} style={b}>
        <Text maxFontSizeMultiplier={1.3} style={label}>
          Check word
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onCheckAll} style={b}>
        <Text maxFontSizeMultiplier={1.3} style={label}>
          Check all
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onRevealWord} style={[b, styles.reveal]}>
        <Text maxFontSizeMultiplier={1.3} style={label}>
          Reveal word
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  reveal: { marginLeft: 6 },
  text: { fontSize: 13, fontFamily: FONT.sansMedium },
});
