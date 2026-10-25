import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT, usePuzzleTokens } from '@/shared/theme';
import { Chevron } from '@/shared/ui';

/** The colours a type can bring (Borders and Reckon keep their own pages' palettes). */
export interface StartColors {
  bg: string;
  card: string;
  ink: string;
  inkSoft: string;
  line: string;
  pill: string;
  onPill: string;
}

export interface StartLayoutProps {
  testID: string;
  /** The type's name, drawn large: "Mini". */
  title: string;
  /** Drawn under the name (Borders' map scale bar). */
  titleAccent?: ReactNode;
  /** "No. 105, Saturday 24 October". */
  dateLine: string;
  /** "4-day streak", top right; none before the first day. */
  streak?: string;
  /** A small picture of the board. */
  art?: ReactNode;
  /** The card's heading: "Today’s Mini", "Round paused". */
  head: string;
  status: string;
  statusTestID?: string;
  button: { label: string; onPress: () => void; testID?: string };
  stats: readonly (readonly [string | number, string])[];
  how: readonly string[];
  colors?: StartColors;
  onBack: () => void;
}

/**
 * The page before a puzzle (engines/house.js's start card, approved 18 Oct 2026), shared by
 * all eight: back and streak, the name in Instrument Serif with its number and date in
 * italic, a card with the board's picture, the day's line and one pill, three numbers
 * between hairlines, and How to play folded away.
 */
export function StartLayout(props: StartLayoutProps) {
  const { testID, title, titleAccent, dateLine, streak, art, head, status, statusTestID } = props;
  const { button, stats, how: paras, onBack } = props;
  const pt = usePuzzleTokens();
  const c: StartColors = props.colors ?? {
    bg: pt.paper,
    card: pt.sheet,
    ink: pt.ink,
    inkSoft: pt.inkSoft,
    line: pt.lineSoft,
    pill: pt.brand,
    onPill: pt.onBrand,
  };
  const [how, setHow] = useState(false);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]} testID={testID}>
      <ScrollView contentContainerStyle={styles.in}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Back to Puzzles"
            onPress={onBack}
            hitSlop={8}
            style={styles.back}>
            <Text style={[styles.backText, { color: c.inkSoft }]}>← Puzzles</Text>
          </Pressable>
          {streak ? <Text style={[styles.streak, { color: c.inkSoft }]}>{streak}</Text> : null}
        </View>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[styles.title, { color: c.ink }]}>
          {title}
        </Text>
        {titleAccent}
        <Text style={[styles.date, { color: c.inkSoft }]}>{dateLine}</Text>
        <View style={[styles.card, { backgroundColor: c.card }]}>
          {art ? <View style={styles.art}>{art}</View> : null}
          <View>
            <Text maxFontSizeMultiplier={1.4} style={[styles.h2, { color: c.ink }]}>
              {head}
            </Text>
            <Text style={[styles.rule, { color: c.inkSoft }]} testID={statusTestID}>
              {status}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={button.onPress}
            testID={button.testID}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: c.pill, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Text style={[styles.pillText, { color: c.onPill }]}>{button.label}</Text>
          </Pressable>
        </View>
        <View style={[styles.stats, { borderColor: c.line }]}>
          {stats.map(([v, label], i) => (
            <View
              key={label}
              style={[styles.stat, i > 0 && [styles.statNext, { borderColor: c.line }]]}
              accessible
              accessibilityLabel={`${v} ${label}`}>
              <Text maxFontSizeMultiplier={1.5} style={[styles.statVal, { color: c.ink }]}>
                {String(v)}
              </Text>
              <Text style={[styles.small, { color: c.inkSoft }]}>{label}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: how }}
          onPress={() => setHow((x) => !x)}
          style={styles.howBar}>
          <Text style={[styles.howTitle, { color: c.ink }]}>How to play</Text>
          <Chevron color={c.inkSoft} dir={how ? 'up' : 'down'} />
        </Pressable>
        <View style={[styles.howBody, { borderColor: c.line }]}>
          {how
            ? paras.map((p) => (
                <Text key={p} style={[styles.howText, { color: c.inkSoft }]}>
                  {p}
                </Text>
              ))
            : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// house.css, value for value.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  in: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
  },
  back: { minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: 15, fontFamily: FONT.sans },
  streak: { fontSize: 14, fontFamily: FONT.sans },
  small: { fontSize: 13, fontFamily: FONT.sans, marginTop: 4 },
  title: {
    fontSize: 72,
    lineHeight: 76,
    fontFamily: FONT.serif,
    letterSpacing: -1.4,
    marginTop: 14,
  },
  date: { fontSize: 20, lineHeight: 26, fontFamily: FONT.serifItalic, marginTop: 2 },
  card: {
    marginTop: 22,
    borderRadius: 18,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  art: { alignItems: 'center', paddingVertical: 6 },
  h2: { fontSize: 32, lineHeight: 36, fontFamily: FONT.serif },
  rule: { fontSize: 16, lineHeight: 23, marginTop: 6, fontFamily: FONT.sans },
  pill: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 24,
    paddingHorizontal: 22,
  },
  pillText: { fontSize: 16, fontFamily: FONT.sansSemi },
  stats: { flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1 },
  stat: { flex: 1, minWidth: 0, paddingVertical: 10 },
  statNext: { borderLeftWidth: 1, paddingLeft: 14 },
  statVal: { fontSize: 28, lineHeight: 32, fontFamily: FONT.serif },
  howBar: {
    marginTop: 6,
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 4,
  },
  howTitle: { fontSize: 16, fontFamily: FONT.sansSemi },
  howBody: { borderBottomWidth: 1 },
  howText: { fontSize: 15, lineHeight: 22, marginBottom: 12, fontFamily: FONT.sans },
});
