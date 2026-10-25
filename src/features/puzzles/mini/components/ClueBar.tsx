import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';
import { Chevron } from '@/shared/ui';

interface ClueBarProps {
  bar: { label: string; clue: string } | null;
  onPrev: () => void;
  onNext: () => void;
  /** Tap the bar: switch across/down. */
  onToggle: () => void;
}

/** ‹ the active clue › (tap the clue to switch between across and down). */
export function ClueBar({ bar, onPrev, onNext, onToggle }: ClueBarProps) {
  const pt = usePuzzleTokens();
  const box = { borderColor: pt.ink, backgroundColor: pt.card };
  return (
    <View style={styles.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous clue"
        onPress={onPrev}
        style={[styles.arrow, box]}>
        <Chevron color={pt.ink} dir="left" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${bar ? `${bar.label}, ${bar.clue}. ` : ''}Tap to switch across and down`}
        onPress={onToggle}
        style={[styles.bar, box]}
        testID="clue-bar">
        <Text style={[styles.text, { color: pt.ink }]}>
          {bar ? <Text style={[styles.label, { color: pt.brand }]}>{`${bar.label} `}</Text> : null}
          {bar?.clue ?? ''}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next clue"
        onPress={onNext}
        style={[styles.arrow, box]}>
        <Chevron color={pt.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  arrow: {
    width: 42,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 22, fontFamily: FONT.display },
  bar: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  text: { fontFamily: FONT.sans, fontSize: 15 },
  label: { fontFamily: FONT.display },
});
