/* The house button and text field for forms (board.html .btn and .field, the site's .synccard). */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { FONT, useTokens, type Tokens } from '@/shared/theme';

/**
 * The app-wide button rule (tracker AF-019): one `filled` accent button per screen for the
 * most likely action, a `tonal` (soft tint) one of the same height for the second, and
 * `text` for minor actions.
 */
export type ButtonVariant = 'filled' | 'tonal' | 'text';

/**
 * The old names, still accepted so nothing breaks: go = filled, alt and plain = tonal,
 * warn = destructive tonal. New code passes `variant`.
 */
export type ButtonKind = 'go' | 'alt' | 'plain' | 'warn';

/** Every button is at least this tall and wide: a 48 × 48 tap area (Android 48 dp, over Apple's 44 pt). */
export const TAP = 48;
/** The space between two targets, side by side or stacked. */
export const TAP_GAP = 8;

function fromKind(kind: ButtonKind | undefined): {
  variant?: ButtonVariant;
  destructive?: boolean;
} {
  if (kind === 'go') return { variant: 'filled' };
  if (kind === 'warn') return { variant: 'tonal', destructive: true };
  if (kind) return { variant: 'tonal' };
  return {};
}

/** Fill and label colours for a variant. A destructive button is never filled (AF-019). */
export function buttonColors(
  t: Tokens,
  variant: ButtonVariant,
  destructive = false,
): { bg: string; fg: string; variant: ButtonVariant } {
  const v = destructive && variant === 'filled' ? 'tonal' : variant;
  if (v === 'filled') return { bg: t.accent, fg: t.onAccent, variant: v };
  if (v === 'tonal')
    return destructive
      ? { bg: t.badSoft, fg: t.bad, variant: v }
      : { bg: t.accentSoft, fg: t.accent, variant: v };
  return { bg: 'transparent', fg: destructive ? t.bad : t.accent, variant: v };
}

/** The pressed look: filled and tonal dim; a text button takes the soft tint behind it. */
export function pressedLook(t: Tokens, variant: ButtonVariant, destructive = false) {
  if (variant === 'text') return { backgroundColor: destructive ? t.badSoft : t.accentSoft };
  return { opacity: 0.75 };
}

/** A button's whole style for one moment: its variant's fill, held or not, dimmed when disabled. */
export function buttonStyle(
  t: Tokens,
  c: { bg: string; variant: ButtonVariant },
  o: { grow?: boolean; destructive?: boolean; pressed?: boolean; dim?: boolean },
): StyleProp<ViewStyle> {
  return [
    styles.btn,
    c.variant === 'text' ? styles.text : null,
    o.grow ? styles.grow : styles.fit,
    { backgroundColor: c.bg },
    o.pressed ? pressedLook(t, c.variant, o.destructive) : null,
    o.dim ? styles.disabled : null,
  ];
}

function isThenable(x: unknown): x is PromiseLike<unknown> {
  return !!x && typeof (x as { then?: unknown }).then === 'function';
}

/**
 * One button for every form: 48 tall with at least a 48 × 48 tap area, a pressed look on
 * every variant, and a spinner while `loading`. When `onPress` returns a promise (a share
 * sheet opening), the button shows the spinner and ignores taps until it settles.
 */
export function Button({
  label,
  onPress,
  variant: variantProp,
  kind,
  destructive: destructiveProp,
  loading: loadingProp,
  disabled,
  grow,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: {
  /** Starts with a verb: "Share result", "Join with a code". */
  label: string;
  onPress: () => unknown;
  variant?: ButtonVariant;
  /** @deprecated pass `variant` (and `destructive`). */
  kind?: ButtonKind;
  destructive?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Share a row's width with its neighbours (board.html's .acts), else as wide as its label. */
  grow?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const t = useTokens();
  const old = fromKind(kind);
  const destructive = destructiveProp ?? old.destructive ?? false;
  const c = buttonColors(t, variantProp ?? old.variant ?? 'tonal', destructive);
  const [pending, setPending] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const loading = !!loadingProp || pending;
  const off = !!disabled || loading;

  const press = () => {
    const r = onPress();
    if (!isThenable(r)) return;
    setPending(true);
    const done = () => {
      if (live.current) setPending(false);
    };
    r.then(done, done);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={press}
      testID={testID}
      style={({ pressed }) =>
        buttonStyle(t, c, { grow, destructive, pressed: pressed && !off, dim: !!disabled })
      }>
      {loading ? (
        <ActivityIndicator
          color={c.fg}
          size="small"
          testID={testID ? `${testID}-spinner` : 'button-spinner'}
        />
      ) : (
        <Text style={[styles.btnText, { color: c.fg }]}>{label}</Text>
      )}
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
 * A labelled text box, as tall as a button. Its edge is the muted ink at 1.5 pt, so it
 * stands out from the card at better than 3:1 in both schemes (the hairline doesn't).
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
    minHeight: TAP,
    minWidth: TAP,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { paddingHorizontal: 12 },
  disabled: { opacity: 0.5 },
  grow: { flexGrow: 1 },
  fit: { alignSelf: 'flex-start' },
  btnText: { fontFamily: FONT.display, fontSize: 15, textAlign: 'center' },
  field: { marginTop: 6 },
  label: { fontFamily: FONT.bodySemi, fontSize: 14, marginBottom: 6 },
  input: {
    fontFamily: FONT.body,
    fontSize: 16,
    minHeight: TAP,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  hint: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, marginTop: 5 },
});
