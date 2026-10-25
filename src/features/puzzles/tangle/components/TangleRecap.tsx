import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePuzzleTokens } from '@/shared/theme';

import type { recap } from '../model';

const GOLD = '#E0A800';

/** The sheet's hero: the score and its word ("12 points"). */
export function TangleScore({ score, word }: { score: number; word: string }) {
  const pt = usePuzzleTokens();
  return (
    <Text style={[styles.big, { color: pt.ink }]}>
      {score}
      <Text style={[styles.bigWord, { color: pt.inkSoft }]}>{` ${word}`}</Text>
    </Text>
  );
}

/** The sheet's recap (recapNode): the meter, every common word by length, the rarer words. */
export function TangleRecap({ r }: { r: ReturnType<typeof recap> }) {
  const pt = usePuzzleTokens();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [rare, setRare] = useState(false);
  return (
    <View style={styles.wrap} testID="tangle-recap">
      <View style={styles.meter}>
        <Text style={[styles.small, { color: pt.inkSoft }]}>{r.meter}</Text>
        <Text style={[styles.small, { color: pt.inkSoft }]}>{r.points}</Text>
      </View>
      <View style={[styles.bar, { backgroundColor: pt.lineSoft }]}>
        <View style={[styles.fill, { width: `${r.pct}%`, backgroundColor: pt.brand }]} />
      </View>
      {r.lists.map((g) => {
        const all = !!open[g.len];
        return (
          <View key={g.len} style={styles.wl}>
            <View style={styles.meter}>
              <Text style={[styles.h4, { color: pt.ink }]}>{g.label}</Text>
              <Text style={[styles.small, { color: pt.inkSoft }]}>{g.count}</Text>
            </View>
            <View style={styles.ws}>
              {(all ? g.words : g.words.slice(0, 12)).map((w) => (
                <Text
                  key={w.w}
                  style={[
                    styles.w,
                    {
                      color: w.got ? pt.ink : pt.inkSoft,
                      backgroundColor: w.star ? GOLD : w.got ? pt.card : 'transparent',
                      borderColor: pt.lineSoft,
                    },
                    !w.got && styles.miss,
                  ]}>
                  {w.w}
                  <Text style={styles.sup}>{` ${w.pts}`}</Text>
                </Text>
              ))}
            </View>
            {g.words.length > 12 && !all ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen((o) => ({ ...o, [g.len]: true }))}
                hitSlop={6}>
                <Text
                  style={[
                    styles.more,
                    { color: pt.brand },
                  ]}>{`Show ${g.words.length - 12} more`}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: rare }}
        onPress={() => setRare((x) => !x)}>
        <Text style={[styles.h4, { color: pt.ink }]}>{r.rare}</Text>
      </Pressable>
      {rare ? <Text style={[styles.small, { color: pt.inkSoft }]}>{r.rareList}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 64, fontFamily: 'Georgia' },
  bigWord: { fontSize: 22 },
  wrap: { gap: 10 },
  meter: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { fontSize: 13, lineHeight: 19 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
  wl: { gap: 6 },
  h4: { fontSize: 14, fontWeight: '600' },
  ws: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  w: {
    fontSize: 14,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  miss: { borderStyle: 'dotted' },
  sup: { fontSize: 10 },
  more: { fontSize: 14, fontWeight: '600' },
});
