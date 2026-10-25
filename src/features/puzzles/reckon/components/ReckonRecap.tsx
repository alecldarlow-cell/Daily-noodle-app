import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FinishInfo } from '../finishing';
import type { ReckonColors } from './colors';

export const BALLPARK = 'https://dailynoodle.co.uk/reports/2026-10-15-quiz-ballpark.html';

/** "Today's ten": each question, your guess and the answer, its points; a tap reviews it. */
export function ReckonRecap({
  info,
  c,
  onRow,
}: {
  info: FinishInfo;
  c: ReckonColors;
  onRow: (k: number) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.sub, { color: c.ink2 }]}>Tap one to see it on the scale.</Text>
      {info.rows.map((r, k) => (
        <Pressable
          key={r.q}
          accessibilityRole="button"
          testID={`reckon-row-${k}`}
          onPress={() => onRow(k)}
          style={[styles.row, { borderColor: c.line }]}>
          <View style={styles.text}>
            <Text style={[styles.rq, { color: c.ink }]}>{r.q}</Text>
            <Text style={[styles.ra, { color: c.ink2 }]}>{r.line}</Text>
          </View>
          <Text style={[styles.rp, { backgroundColor: c.zones[r.z], color: c.onZ }]}>{r.pts}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(BALLPARK)}
        style={styles.link}>
        <Text style={[styles.linkText, { color: c.ink }]}>Play more in Ballpark</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  sub: { fontSize: 14, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  text: { flex: 1, gap: 3 },
  rq: { fontSize: 15, lineHeight: 20 },
  ra: { fontSize: 13 },
  rp: {
    minWidth: 44,
    textAlign: 'center',
    borderRadius: 999,
    paddingVertical: 4,
    fontWeight: '800',
    overflow: 'hidden',
  },
  link: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  linkText: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
