import { LAB_LABEL, type LabType, type LabVote } from '@noodle/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens, useTokens } from '@/shared/theme';
import { pressable } from '@/shared/ui';

/** What the line under the buttons says before and after an answer. */
export const VOTE_ASK = 'YOUR VOTE HELPS DECIDE IF IT STAYS';
export const VOTE_THANKS = 'THANKS: YOU CAN CHANGE IT ANY TIME';

interface Props {
  type: LabType;
  /** The answer already given on this phone, if any. */
  vote: LabVote | undefined;
  onVote: (v: LabVote) => void;
}

/**
 * The Lab's one question (Alec, 11 Nov 2026: "one click really"): "Should <Name> go daily?",
 * two big buttons, and the tap is the answer. No submit, no free text.
 */
export function LabVoteBlock({ type, vote, onVote }: Props) {
  const t = useTokens();
  const pt = usePuzzleTokens();
  const name = LAB_LABEL[type];
  const button = (v: LabVote, label: string) => {
    const on = vote === v;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${name} should ${v === 'yes' ? '' : 'not '}go daily`}
        accessibilityState={{ selected: on }}
        onPress={() => onVote(v)}
        style={pressable([
          styles.btn,
          {
            borderColor: on ? t.accent : pt.inkSoft,
            borderWidth: on ? 2 : 1.5,
            backgroundColor: on ? t.accentSoft : pt.paper,
          },
        ])}
        testID={`lab-vote-${v}`}>
        <Text style={[styles.btnText, { color: on ? t.accent : pt.ink }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.wrap} testID="lab-vote">
      <Text accessibilityRole="header" style={[styles.q, { color: pt.ink }]}>
        Should {name} go daily?
      </Text>
      <View style={styles.row}>
        {button('yes', 'Yes')}
        {button('no', 'No')}
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.note, { color: t.faint }]}
        testID="lab-vote-note">
        {vote ? VOTE_THANKS : VOTE_ASK}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24 },
  q: { fontSize: 18, lineHeight: 24, fontFamily: FONT.sansSemi, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontFamily: FONT.sansSemi },
  note: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1,
    fontFamily: FONT.sansSemi,
    textAlign: 'center',
  },
});
