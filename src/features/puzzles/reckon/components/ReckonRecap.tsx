import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { FinishLink } from '@/shared/finish-sheet';
import { FONT, usePuzzleTokens } from '@/shared/theme';

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
  const pt = usePuzzleTokens();
  return (
    <View style={styles.wrap}>
      {info.rows.map((r, k) => (
        <Pressable
          key={r.q}
          accessibilityRole="button"
          testID={`reckon-row-${k}`}
          onPress={() => onRow(k)}
          style={[styles.row, { borderColor: pt.hair }]}>
          <View style={styles.text}>
            <Text style={[styles.rq, { color: pt.ink }]}>{r.q}</Text>
            <Text style={[styles.ra, { color: pt.sheetSoft }]}>{r.line}</Text>
          </View>
          <Text
            testID={`reckon-pts-${k}`}
            style={[styles.rp, { backgroundColor: c.zones[r.z], color: c.onZ }]}>
            {r.pts}
          </Text>
        </Pressable>
      ))}
      <FinishLink
        role="link"
        label="Play more in Ballpark"
        onPress={() => void Linking.openURL(BALLPARK)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  text: { flex: 1, gap: 3 },
  rq: { fontFamily: FONT.sansSemi, fontSize: 15, lineHeight: 20 },
  ra: { fontFamily: FONT.sans, fontSize: 13.5 },
  rp: {
    minWidth: 50,
    textAlign: 'center',
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 15,
    fontFamily: FONT.display,
    overflow: 'hidden',
  },
});
