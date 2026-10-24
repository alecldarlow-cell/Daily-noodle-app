/* The board page's pieces (board.html .bcard, .field, .btn, .msg, .lnk) in the house tokens. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTokens } from '@/shared/theme';

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

export function Field({
  label,
  hint,
  testID,
  ...input
}: { label: string; hint?: string; testID?: string } & TextInputProps) {
  const t = useTokens();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.faint }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        placeholderTextColor={t.faint}
        style={[styles.input, { borderColor: t.hair, backgroundColor: t.paper, color: t.ink }]}
        {...input}
      />
      {hint ? <Text style={[styles.hint, { color: t.faint }]}>{hint}</Text> : null}
    </View>
  );
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

export function Btn({
  label,
  onPress,
  kind = 'plain',
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  kind?: 'go' | 'alt' | 'plain' | 'warn';
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTokens();
  const bg = kind === 'go' ? t.accent : kind === 'alt' ? t.accentSoft : t.paper;
  const fg = kind === 'go' ? t.paper : kind === 'alt' ? t.accent : kind === 'warn' ? t.bad : t.ink;
  const border = kind === 'go' || kind === 'alt' ? t.accent : t.hair;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}>
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
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
  h2: { fontSize: 21, fontWeight: '800', letterSpacing: -0.2, lineHeight: 26 },
  p: { fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: '700' },
  field: { marginTop: 6 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  hint: { fontSize: 12.5, marginTop: 5 },
  btn: {
    flexGrow: 1,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 14.5, fontWeight: '700' },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  lnkWrap: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 4 },
  lnk: { fontSize: 14.5, fontWeight: '600', textDecorationLine: 'underline', textAlign: 'center' },
  msg: { fontSize: 14, marginTop: 6 },
  sub: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 18,
  },
});
