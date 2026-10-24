import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePuzzleTokens } from '@/shared/theme';

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
        <Text style={[styles.arrowText, { color: pt.ink }]}>‹</Text>
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
        <Text style={[styles.arrowText, { color: pt.ink }]}>›</Text>
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
  arrowText: { fontSize: 22, fontWeight: '700' },
  bar: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  text: { fontSize: 15 },
  label: { fontWeight: '700' },
});
