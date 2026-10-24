import { shortLink, TYPE_LABEL, type PuzzleType, type TodayItem } from '@noodle/core';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePuzzleTokens, useTokens } from '@/shared/theme';
import { longDate } from '@/shared/time';

import { clockLine } from './rules';
import { useFinishData } from './useFinishData';

export interface FinishSheetProps {
  type: PuzzleType;
  /** The player number ("105"). */
  n: number | string;
  /** The puzzle's day, YYYY-MM-DD. */
  date: string;
  /** The outcome: "Solved". */
  title: string;
  /** The result that gets shared: "1:27". */
  hero: string;
  /** One line of comment ("No checks, no reveals."); none on a reopened puzzle. */
  note?: string;
  /** The share line, without the short link. */
  share: string;
  stats: { value: string | number; label: string }[];
  /** The type's own section (the Mini's solved grid). */
  recap?: { title: string; node: ReactNode };
  /** Where leagues put "See today's board". */
  boardSlot?: ReactNode;
  onBack: () => void;
  /** Open the Next row's puzzle, or today's list when it names none. */
  onNext: (item: TodayItem | null) => void;
}

/**
 * The finish sheet every native player shows (engines/finish.js, approved 18 Oct 2026):
 * kicker, outcome, the shared result, one line, the share line with Share, three stats,
 * the next puzzle you haven't played today, the board slot, the countdown and your
 * overall run, then the type's recap. Share sends the line, a newline and the short
 * link (dailynoodle.co.uk/<type>) to the phone's share sheet.
 */
export function FinishSheet(props: FinishSheetProps) {
  const { type, n, date, title, hero, note, share, stats, recap, boardSlot, onBack, onNext } =
    props;
  const t = useTokens();
  const pt = usePuzzleTokens();
  const { next, secs, run } = useFinishData(type);
  const url = shortLink(type);
  const line = clockLine(TYPE_LABEL[type], secs, run);
  const onShare = () => {
    void Share.share({ message: `${share}\n${url}` }).catch(() => undefined);
  };
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="finish-sheet">
      <ScrollView contentContainerStyle={styles.in}>
        <Pressable accessibilityRole="link" onPress={onBack} hitSlop={8} style={styles.back}>
          <Text style={[styles.backText, { color: pt.inkSoft }]}>← Puzzles</Text>
        </Pressable>
        <Text style={[styles.kick, { color: pt.inkSoft }]}>
          {`${TYPE_LABEL[type]} ${n}, ${longDate(date)}`}
        </Text>
        <Text accessibilityRole="header" style={[styles.title, { color: pt.ink }]}>
          {title}
        </Text>
        <Text style={[styles.hero, { color: pt.ink }]} testID="finish-hero">
          {hero}
        </Text>
        {note ? <Text style={[styles.note, { color: pt.inkSoft }]}>{note}</Text> : null}

        <View style={[styles.shareCard, { backgroundColor: pt.card }]}>
          <View style={styles.shareBody}>
            <Text style={[styles.shareText, { color: pt.ink }]} testID="finish-share-text">
              {share}
            </Text>
            <Text style={[styles.shareUrl, { color: pt.inkSoft }]}>{url}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onShare}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: t.play, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={[styles.pillText, { color: t.onPlay }]}>Share</Text>
          </Pressable>
        </View>

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={[styles.statVal, { color: pt.ink }]}>{String(s.value)}</Text>
              <Text style={[styles.small, { color: pt.inkSoft }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={next.main}
          onPress={() => onNext(next.item)}
          style={[styles.next, { backgroundColor: pt.card }]}
          testID="finish-next">
          <View style={styles.fill}>
            <Text style={[styles.nextMain, { color: pt.ink }]}>{next.main}</Text>
            <Text style={[styles.small, { color: pt.inkSoft }]}>{next.sub}</Text>
          </View>
          <Text style={[styles.chev, { color: pt.inkSoft }]}>›</Text>
        </Pressable>
        {boardSlot ? <View>{boardSlot}</View> : null}
        <Text style={[styles.clock, { color: pt.inkSoft }]} testID="finish-clock">
          {line.lead}
          {line.bold ? <Text style={styles.bold}>{line.bold}</Text> : null}
          {line.after}
          {line.run >= 2 ? (
            <>
              {' You’ve played every day for '}
              <Text style={styles.bold}>{`${line.run} days`}</Text>.
            </>
          ) : null}
        </Text>

        {recap ? (
          <View style={styles.recap}>
            <Text style={[styles.recapTitle, { color: pt.ink }]}>{recap.title}</Text>
            {recap.node}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  in: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 15 },
  kick: { fontSize: 15, marginTop: 10 },
  title: { fontSize: 44, fontFamily: 'Georgia', marginTop: 4 },
  hero: { fontSize: 64, fontFamily: 'Georgia', marginTop: 4, fontVariant: ['tabular-nums'] },
  note: { fontSize: 16, marginTop: 4 },
  shareCard: { marginTop: 20, borderRadius: 16, padding: 16, gap: 12 },
  shareBody: { gap: 4 },
  shareText: { fontSize: 17, fontWeight: '600' },
  shareUrl: { fontSize: 14 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
  pillText: { fontSize: 16, fontWeight: '800' },
  stats: { flexDirection: 'row', marginTop: 22, gap: 12 },
  stat: { flex: 1 },
  statVal: { fontSize: 28, fontFamily: 'Georgia' },
  small: { fontSize: 13 },
  next: {
    marginTop: 22,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextMain: { fontSize: 17, fontWeight: '600' },
  chev: { fontSize: 24 },
  clock: { fontSize: 15, lineHeight: 22, marginTop: 16 },
  bold: { fontWeight: '700' },
  recap: { marginTop: 26, gap: 10 },
  recapTitle: { fontSize: 18, fontWeight: '700' },
});
