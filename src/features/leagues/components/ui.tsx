/* The board page's pieces (board.html .bcard, .field, .btn, .msg, .lnk) in the house tokens. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputProps } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { Button, TextField, type ButtonKind } from '@/shared/ui';

export function Card({
  icon,
  title,
  children,
  testID,
}: {
  icon?: string;
  title?: string;
  children?: ReactNode;
  testID?: string;
}) {
  const t = useTokens();
  return (
    <View style={[styles.card, { backgroundColor: t.paper, borderColor: t.hair }]} testID={testID}>
      {icon ? (
        <Text style={styles.icon} accessible={false}>
          {icon}
        </Text>
      ) : null}
      {title ? (
        <Text accessibilityRole="header" style={[styles.h2, { color: t.ink }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function P({ children, tip, fine }: { children: ReactNode; tip?: boolean; fine?: boolean }) {
  const t = useTokens();
  return (
    <Text
      style={[
        styles.p,
        { color: t.muted },
        tip && { backgroundColor: t.accentSoft, color: t.ink, padding: 10, borderRadius: 10 },
        fine && { fontSize: 13, color: t.faint },
      ]}>
      {children}
    </Text>
  );
}

export function B({ children }: { children: ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

/** A labelled text box: the house field (`TextField`), as SyncCard's. */
export function Field(props: { label: string; hint?: string; testID?: string } & TextInputProps) {
  return <TextField {...props} />;
}

export function PinField(props: {
  label?: string;
  hint?: string;
  value: string;
  onChangeText: (s: string) => void;
}) {
  return (
    <Field
      label={props.label ?? 'PIN'}
      hint={props.hint}
      value={props.value}
      onChangeText={props.onChangeText}
      keyboardType="number-pad"
      maxLength={4}
      autoComplete="off"
      placeholder="4 numbers"
      secureTextEntry={false}
    />
  );
}

/** The house button, sharing the row's width as board.html's .acts buttons do. */
export function Btn(props: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  testID?: string;
}) {
  return <Button grow {...props} />;
}

export function Acts({ children }: { children: ReactNode }) {
  return <View style={styles.acts}>{children}</View>;
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.lnkWrap}>
      <Text style={[styles.lnk, { color: t.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function Msg({ text, ok }: { text: string; ok?: boolean }) {
  const t = useTokens();
  if (!text) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.msg, { color: ok ? t.accent : t.bad }]}>
      {text}
    </Text>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  const t = useTokens();
  return <Text style={[styles.sub, { color: t.faint }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { marginTop: 4, marginBottom: 16, padding: 16, borderWidth: 1, borderRadius: 12, gap: 8 },
  icon: { fontSize: 30 },
  h2: { fontFamily: FONT.displayHeavy, fontSize: 21, letterSpacing: -0.2, lineHeight: 26 },
  p: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22 },
  bold: { fontFamily: FONT.bodyBold },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  lnkWrap: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  lnk: {
    fontFamily: FONT.bodySemi,
    fontSize: 14.5,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  msg: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20, marginTop: 6 },
  sub: {
    fontFamily: FONT.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 18,
  },
});
