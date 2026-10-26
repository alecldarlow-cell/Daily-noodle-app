/* The house button and text field for forms (board.html .btn and .field, the site's .synccard). */
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';

export type ButtonKind = 'go' | 'alt' | 'plain' | 'warn';

/**
 * One pill button for every form: `go` the main action (accent fill), `alt` the second
 * (soft accent), `plain` the rest (ink outline) and `warn` a destructive one. At least
 * 44 pt tall, as both platforms ask for a touch target.
 */
export function Button({
  label,
  onPress,
  kind = 'plain',
  disabled,
  grow,
  testID,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  /** Share a row's width with its neighbours (board.html's .acts), else as wide as its label. */
  grow?: boolean;
  testID?: string;
}) {
  const t = useTokens();
  const bg = kind === 'go' ? t.accent : kind === 'alt' ? t.accentSoft : t.paper;
  const fg =
    kind === 'go' ? t.onAccent : kind === 'alt' ? t.accent : kind === 'warn' ? t.bad : t.ink;
  const border = kind === 'go' || kind === 'alt' ? t.accent : kind === 'warn' ? t.bad : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        grow ? styles.grow : styles.fit,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}>
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A field's label, for a field made of something other than a text box (name chips). */
export function FieldLabel({ children, nativeID }: { children: string; nativeID?: string }) {
  const t = useTokens();
  return (
    <Text nativeID={nativeID} style={[styles.label, { color: t.ink }]}>
      {children}
    </Text>
  );
}

/**
 * A labelled text box. Its edge is the muted ink at 1.5 pt, so it stands out from the
 * card at better than 3:1 in both schemes (the hairline doesn't).
 */
export function TextField({
  label,
  hint,
  testID,
  ...input
}: { label: string; hint?: string; testID?: string } & TextInputProps) {
  const t = useTokens();
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        accessibilityLabel={label}
        testID={testID}
        placeholderTextColor={t.faint}
        style={[styles.input, { borderColor: t.muted, backgroundColor: t.canvas, color: t.ink }]}
        {...input}
      />
      {hint ? <Text style={[styles.hint, { color: t.faint }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flexGrow: 1 },
  fit: { alignSelf: 'flex-start' },
  btnText: { fontFamily: FONT.display, fontSize: 15, textAlign: 'center' },
  field: { marginTop: 6 },
  label: { fontFamily: FONT.bodySemi, fontSize: 14, marginBottom: 6 },
  input: {
    fontFamily: FONT.body,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  hint: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, marginTop: 5 },
});
