import { shortLink, TYPE_LABEL, type PuzzleType, type TodayItem } from '@noodle/core';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Entrance } from '@/shared/motion';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { longDate } from '@/shared/time';
import { Chevron, ShareGlyph } from '@/shared/ui';

import { tagged, useBoardSlot } from './boardSlot';
import { clockLine, splitHero } from './rules';
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
  /** Drawn in place of `hero` when the result is a picture (Link's guess squares, Tangle's score). */
  heroNode?: ReactNode;
  /** One line of comment ("No checks, no reveals."); none on a reopened puzzle. */
  note?: string;
  /** The share line, without the short link. */
  share: string;
  stats: { value: string | number; label: string }[];
  /** The type's own section (the Mini's solved grid). */
  recap?: { title: string; sub?: string; node: ReactNode };
  /** Placed at the very end (Link's "Play again (not recorded)"). */
  after?: ReactNode;
  /** "reports/<file>.html": the page's path, for the provided board slot (leagues). */
  path?: string;
  /** Drawn in the board slot instead of the provided one. */
  boardSlot?: ReactNode;
  /**
   * A fresh solve or finish: the outcome and result arrive with a short entrance (still
   * when the phone asks for reduced motion). Off for a finished puzzle reopened.
   */
  celebrate?: boolean;
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
  const { type, n, date, title, hero, heroNode, note, share, stats, recap, after } = props;
  const { path, boardSlot, onBack, onNext, celebrate = false } = props;
  const renderSlot = useBoardSlot();
  // A tag the board slot adds once the result is on the board (🏆 for a league record).
  const [tag, setTag] = useState('');
  const shareText = tagged(share, tag);
  const pt = usePuzzleTokens();
  const { next, secs, run } = useFinishData(type);
  const url = shortLink(type);
  const line = clockLine(TYPE_LABEL[type], secs, run);
  const [heroVal, heroUnit] = splitHero(hero);
  const onShare = () => {
    void Share.share({ message: `${shareText}\n${url}` }).catch(() => undefined);
  };
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="finish-sheet">
      <ScrollView contentContainerStyle={styles.in}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Back to Puzzles"
          onPress={onBack}
          hitSlop={8}
          style={styles.back}>
          <Text style={[styles.backText, { color: pt.inkSoft }]}>← Puzzles</Text>
        </Pressable>
        <Text style={[styles.kick, { color: pt.inkSoft }]}>
          {`${TYPE_LABEL[type]} ${n}, ${longDate(date)}`}
        </Text>
        <Entrance play={celebrate} testID="finish-entrance">
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
            style={[styles.title, { color: pt.ink }]}>
            {title}
          </Text>
        </Entrance>
        <Entrance play={celebrate} delay={90} from={0.9}>
          {heroNode ? (
            <View style={styles.heroNode} testID="finish-hero" accessibilityLabel={hero}>
              {heroNode}
            </View>
          ) : (
            <Text
              testID="finish-hero"
              maxFontSizeMultiplier={1.3}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[styles.hero, { color: pt.ink }]}>
              {heroVal}
              {heroUnit ? (
                <Text style={[styles.heroUnit, { color: pt.inkSoft }]}>{` ${heroUnit}`}</Text>
              ) : null}
            </Text>
          )}
        </Entrance>
        {note ? (
          <Entrance play={celebrate} delay={180}>
            <Text style={[styles.note, { color: pt.inkSoft }]}>{note}</Text>
          </Entrance>
        ) : null}

        <View style={[styles.shareCard, { backgroundColor: pt.sheet }]}>
          <View style={styles.shareBody}>
            <Text style={[styles.shareText, { color: pt.ink }]} testID="finish-share-text">
              {shareText}
            </Text>
            <Text style={[styles.shareUrl, { color: pt.inkSoft }]}>{url}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onShare}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: pt.brand, opacity: pressed ? 0.85 : 1 },
            ]}>
            <ShareGlyph color={pt.onBrand} />
            <Text style={[styles.pillText, { color: pt.onBrand }]}>Share</Text>
          </Pressable>
        </View>

        <View style={[styles.stats, { borderColor: pt.rule }]}>
          {stats.map((s, i) => (
            <View
              key={s.label}
              style={[styles.stat, i > 0 && [styles.statNext, { borderColor: pt.hair }]]}
              accessible
              accessibilityLabel={`${s.value} ${s.label}`}>
              <Text maxFontSizeMultiplier={1.5} style={[styles.statVal, { color: pt.ink }]}>
                {String(s.value)}
              </Text>
              <Text style={[styles.small, { color: pt.inkSoft }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={next.main}
          onPress={() => onNext(next.item)}
          style={({ pressed }) => [
            styles.next,
            { borderColor: pt.rule, opacity: pressed ? 0.7 : 1 },
          ]}
          testID="finish-next">
          <View style={styles.fill}>
            <Text style={[styles.nextMain, { color: pt.ink }]}>{next.main}</Text>
            <Text style={[styles.small, { color: pt.inkSoft }]}>{next.sub}</Text>
          </View>
          <Chevron color={pt.inkSoft} />
        </Pressable>
        {boardSlot ? (
          <View>{boardSlot}</View>
        ) : renderSlot && path ? (
          <View>{renderSlot({ path, type, date, onTag: setTag })}</View>
        ) : null}
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
          <View style={[styles.recap, { borderColor: pt.rule }]}>
            <View>
              <Text accessibilityRole="header" style={[styles.recapTitle, { color: pt.ink }]}>
                {recap.title}
              </Text>
              {recap.sub ? (
                <Text style={[styles.recapSub, { color: pt.inkSoft }]}>{recap.sub}</Text>
              ) : null}
            </View>
            {recap.node}
          </View>
        ) : null}
        {after ? <View style={styles.after}>{after}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// finish.css, value for value: Instrument Serif for the outcome, the result and the stats,
// Archivo for everything else, hairline rules rather than cards between the parts.
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
  backText: { fontSize: 15, fontFamily: FONT.sans },
  kick: { fontSize: 19, lineHeight: 25, fontFamily: FONT.serifItalic, marginTop: 6 },
  title: {
    fontSize: 44,
    lineHeight: 48,
    fontFamily: FONT.serif,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  hero: {
    fontSize: 112,
    lineHeight: 112,
    fontFamily: FONT.serif,
    letterSpacing: -3,
    fontVariant: ['lining-nums'],
  },
  heroUnit: { fontSize: 30, fontFamily: FONT.serif, letterSpacing: 0 },
  heroNode: { marginTop: 14, marginBottom: 4 },
  note: { fontSize: 16, lineHeight: 23, marginTop: 10, fontFamily: FONT.sans },
  shareCard: {
    marginTop: 22,
    borderRadius: 16,
    paddingVertical: 10,
    paddingRight: 10,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareBody: { flex: 1, minWidth: 0, gap: 2 },
  shareText: { fontSize: 17, lineHeight: 23, fontFamily: FONT.sansSemi },
  shareUrl: { fontSize: 13, fontFamily: FONT.sansMedium },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  pillText: { fontSize: 16, fontFamily: FONT.sansSemi },
  stats: { flexDirection: 'row', marginTop: 22, borderTopWidth: 1, borderBottomWidth: 1 },
  stat: { flex: 1, minWidth: 0, paddingVertical: 12 },
  statNext: { borderLeftWidth: 1, paddingLeft: 14 },
  statVal: { fontSize: 34, lineHeight: 38, fontFamily: FONT.serif, fontVariant: ['tabular-nums'] },
  small: { fontSize: 13, fontFamily: FONT.sans, marginTop: 3 },
  next: {
    marginTop: 14,
    minHeight: 60,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 4,
  },
  nextMain: { fontSize: 17, fontFamily: FONT.sansSemi },
  clock: { fontSize: 14, lineHeight: 21, marginTop: 12, fontFamily: FONT.sans },
  bold: { fontFamily: FONT.sansSemi },
  recap: { marginTop: 30, paddingTop: 18, borderTopWidth: 1, gap: 14 },
  recapTitle: { fontSize: 28, lineHeight: 32, fontFamily: FONT.serif },
  recapSub: { fontSize: 14, fontFamily: FONT.sans, marginTop: 6 },
  after: { marginTop: 22 },
});
