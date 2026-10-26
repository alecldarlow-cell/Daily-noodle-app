import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';

interface NoteAction {
  label: string;
  onPress: () => void;
}

interface NoteProps {
  title: string;
  body?: string;
  action?: NoteAction;
  /** A quieter second way out ("Go to Today"), beside the main action. */
  alt?: NoteAction;
  testID?: string;
}

/**
 * A quiet message in place of a list: nearly ready, offline, nothing yet. The site's
 * `.note` (front.css): paper with a hairline and an accent rule down its left edge, never a
 * coloured wash, so "No connection" can't read as "all good". Announced to screen readers
 * when it appears, as the site's `role="alert"` note is.
 */
export function Note({ title, body, action, alt, testID }: NoteProps) {
  const t = useTokens();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.note,
        { backgroundColor: t.paper, borderColor: t.hair, borderLeftColor: t.accent },
      ]}
      testID={testID}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
        {title}
      </Text>
      {body ? <Text style={[styles.body, { color: t.muted }]}>{body}</Text> : null}
      {action || alt ? (
        <View style={styles.actions}>
          {action ? (
            <Pressable
              accessibilityRole="button"
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.btn,
                styles.main,
                { borderColor: t.accent, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text style={[styles.btnText, { color: t.accent }]}>{action.label}</Text>
            </Pressable>
          ) : null}
          {alt ? (
            <Pressable
              accessibilityRole="button"
              onPress={alt.onPress}
              style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.btnText, { color: t.muted }]}>{alt.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 4,
  },
  title: { fontFamily: FONT.bodyBold, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  // 44 pt tall at the least (it is the one action on an error screen); the pill is the site's
  // .retry, accent outline and accent text.
  btn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  main: { borderWidth: 1, borderRadius: 999 },
  btnText: { fontFamily: FONT.bodySemi, fontSize: 14 },
});
