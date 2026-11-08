import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';
import { pressable, TAP } from '@/shared/ui';

/** "6A" → "6 Across", for the Help rows' small print. */
export function wordName(label: string | undefined): string {
  if (!label) return 'This word';
  const dir = label.slice(-1);
  const name = dir === 'A' ? 'Across' : dir === 'D' ? 'Down' : '';
  return name ? `${label.slice(0, -1)} ${name}` : label;
}

interface MiniHelpProps {
  open: boolean;
  /** The active clue's label ("6A"), for the word rows. */
  word: string | undefined;
  onClose: () => void;
  onCheckCell: () => void;
  onCheckWord: () => void;
  onCheckAll: () => void;
  onRevealWord: () => void;
}

/**
 * Help: the Mini's checks and its reveal, in a sheet from the keyboard's Help key
 * (Alec, 8 Nov 2026). Each row does its move and closes the sheet.
 */
export function MiniHelp({
  open,
  word,
  onClose,
  onCheckCell,
  onCheckWord,
  onCheckAll,
  onRevealWord,
}: MiniHelpProps) {
  const pt = usePuzzleTokens();
  const name = wordName(word);
  const row = (label: string, note: string, run: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={note}
      onPress={() => {
        run();
        onClose();
      }}
      style={pressable([styles.row, { backgroundColor: pt.card, borderColor: pt.lineSoft }])}>
      <Text maxFontSizeMultiplier={1.3} style={[styles.label, { color: pt.ink }]}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={1.3} style={[styles.note, { color: pt.inkSoft }]}>
        {note}
      </Text>
    </Pressable>
  );
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Close"
        testID="mini-help-scrim"
        onPress={onClose}
      />
      <View style={[styles.sheet, { backgroundColor: pt.paper }]} testID="mini-help">
        <View style={[styles.grab, { backgroundColor: pt.lineSoft }]} />
        <View style={styles.head}>
          <Text accessibilityRole="header" style={[styles.title, { color: pt.ink }]}>
            Help
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close help"
            onPress={onClose}
            style={pressable([styles.close, { backgroundColor: pt.card }])}>
            <Text style={[styles.closeText, { color: pt.ink }]}>✕</Text>
          </Pressable>
        </View>
        {row('Check square', 'This square', onCheckCell)}
        {row('Check word', name, onCheckWord)}
        {row('Check all', 'Whole grid', onCheckAll)}
        <View style={[styles.rule, { backgroundColor: pt.lineSoft }]} />
        {row('Reveal word', name, onRevealWord)}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(5,6,8,0.6)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 10,
  },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: FONT.sansSemi, fontSize: 18 },
  close: {
    width: TAP,
    height: TAP,
    borderRadius: TAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 16, fontFamily: FONT.sansSemi },
  row: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { fontFamily: FONT.sansSemi, fontSize: 16 },
  note: { fontFamily: FONT.sans, fontSize: 13 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
});
