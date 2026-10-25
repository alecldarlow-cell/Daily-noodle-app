import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePuzzleTokens } from '@/shared/theme';
import { Chevron } from '@/shared/ui';

import type { recap } from '../model';

/**
 * The sheet's recap (finish.css's Tangle word bank): the meter, a key, every common word
 * by length as chips (found filled, missed outlined, the longest ringed in gold), and the
 * rarer words behind a fold.
 */
export function TangleRecap({ r }: { r: ReturnType<typeof recap> }) {
  const pt = usePuzzleTokens();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [rare, setRare] = useState(false);
  return (
    <View style={styles.wrap} testID="tangle-recap">
      <View>
        <View style={styles.meter}>
          <Text style={[styles.small, { color: pt.inkSoft }]}>{r.meter}</Text>
          <Text style={[styles.small, { color: pt.inkSoft }]}>{r.points}</Text>
        </View>
        <View style={[styles.bar, { backgroundColor: pt.hair }]}>
          <View style={[styles.fill, { width: `${r.pct}%`, backgroundColor: pt.brand }]} />
        </View>
      </View>
      <View style={styles.key}>
        <View style={styles.keyItem}>
          <View style={[styles.swatch, { backgroundColor: pt.brandTint }]} />
          <Text style={[styles.keyText, { color: pt.inkSoft }]}>Found</Text>
        </View>
        <View style={styles.keyItem}>
          <View style={[styles.swatch, { borderWidth: 1.5, borderColor: pt.rule }]} />
          <Text style={[styles.keyText, { color: pt.inkSoft }]}>Missed</Text>
        </View>
        <View style={styles.keyItem}>
          <View style={[styles.swatch, { borderWidth: 2, borderColor: pt.gold }]} />
          <Text style={[styles.keyText, { color: pt.inkSoft }]}>Longest word, double points</Text>
        </View>
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
                <View
                  key={w.w}
                  accessible
                  accessibilityLabel={`${w.w}, ${w.pts} points, ${w.got ? 'found' : 'missed'}`}
                  style={[
                    styles.w,
                    w.got && { backgroundColor: w.star ? pt.goldTint : pt.brandTint },
                    !w.got && { borderWidth: 1.5, borderColor: pt.rule },
                    w.star && { borderWidth: 2, borderColor: pt.gold },
                  ]}>
                  {w.star ? <Text style={[styles.star, { color: pt.gold }]}>★</Text> : null}
                  <Text
                    style={[
                      styles.wText,
                      { color: w.star ? pt.goldInk : w.got ? pt.ink : pt.inkSoft },
                      !w.got && styles.wMiss,
                    ]}>
                    {w.w.toUpperCase()}
                  </Text>
                  <Text style={[styles.sup, { color: w.star ? pt.goldInk : pt.actInk }]}>
                    {String(w.pts)}
                  </Text>
                </View>
              ))}
            </View>
            {g.words.length > 12 && !all ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen((o) => ({ ...o, [g.len]: true }))}
                style={styles.moreBtn}>
                <Text style={[styles.more, { color: pt.actInk }]}>
                  {`Show ${g.words.length - 12} more`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <View style={[styles.rare, { borderColor: pt.hair }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: rare }}
          onPress={() => setRare((x) => !x)}
          style={styles.rareBar}>
          <Text style={[styles.rareTitle, { color: pt.ink }]}>{r.rare}</Text>
          <Chevron color={pt.inkSoft} dir={rare ? 'up' : 'down'} />
        </Pressable>
        {rare ? (
          <Text style={[styles.rareList, { color: pt.inkSoft }]}>{r.rareList.toUpperCase()}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  meter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  small: { fontSize: 14, fontFamily: FONT.sans },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  fill: { height: 6, borderRadius: 3 },
  key: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, height: 14, borderRadius: 4 },
  keyText: { fontSize: 13, fontFamily: FONT.sans },
  wl: { gap: 8 },
  h4: { fontSize: 14, fontFamily: FONT.sansSemi },
  ws: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  w: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  wText: { fontSize: 15, lineHeight: 17, fontFamily: FONT.sansSemi, letterSpacing: 0.5 },
  wMiss: { fontFamily: FONT.sansMedium },
  star: { fontSize: 12, lineHeight: 15 },
  sup: { fontSize: 11, lineHeight: 13, fontFamily: FONT.sansSemi, alignSelf: 'flex-start' },
  moreBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  more: { fontSize: 14, fontFamily: FONT.sansSemi },
  rare: { borderTopWidth: 1, marginTop: 2 },
  rareBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  rareTitle: { fontSize: 15, fontFamily: FONT.sansSemi },
  rareList: {
    fontSize: 14,
    lineHeight: 24,
    letterSpacing: 0.3,
    fontFamily: FONT.sans,
    marginBottom: 12,
  },
});
