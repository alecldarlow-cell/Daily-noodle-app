import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/shared/theme';

interface NoteProps {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}

/** A quiet message in place of a list: nearly ready, offline, nothing yet. */
export function Note({ title, body, action, testID }: NoteProps) {
  const t = useTokens();
  return (
    <View style={[styles.note, { backgroundColor: t.accentSoft }]} testID={testID}>
      <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: t.muted }]}>{body}</Text> : null}
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={[styles.btn, { borderColor: t.ink }]}>
          <Text style={[styles.btnText, { color: t.ink }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { padding: 16, borderRadius: 12, marginBottom: 16, gap: 6 },
  title: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  btn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  btnText: { fontSize: 15, fontWeight: '700' },
});
