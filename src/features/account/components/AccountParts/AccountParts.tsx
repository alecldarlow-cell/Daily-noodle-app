/* Account's building blocks: a section label, a card, and a plain tappable row. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { Chevron, TAP } from '@/shared/ui';

/** A small uppercase label over a section (SETTINGS, LEAGUES, PRIVACY & DATA). */
export function Section({ label, children }: { label: string; children: ReactNode }) {
  const t = useTokens();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.label, { color: t.faint }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  const t = useTokens();
  return (
    <View style={[styles.card, { backgroundColor: t.paper, borderColor: t.hair }]} testID={testID}>
      {children}
    </View>
  );
}

/**
 * A plain row that opens something: its label in ink, an optional line under it, and a
 * chevron. 48 tall at least, with the soft tint while pressed.
 */
export function Row({
  label,
  sub,
  onPress,
  role = 'button',
  testID,
  first,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  role?: 'button' | 'link';
  testID?: string;
  /** The first row in its card has no rule above it. */
  first?: boolean;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={sub}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        first ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hair },
        pressed ? { backgroundColor: t.accentSoft } : null,
      ]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: t.ink }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: t.faint }]}>{sub}</Text> : null}
      </View>
      <Chevron color={t.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22, gap: 8 },
  label: {
    fontFamily: FONT.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  card: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4 },
  row: {
    minHeight: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: FONT.bodySemi, fontSize: 15.5, lineHeight: 21 },
  rowSub: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
});
