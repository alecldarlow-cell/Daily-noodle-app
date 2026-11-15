import { LAB_LABEL, type LabType } from '@noodle/core';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LabFeedItem } from '@/shared/feed';
import { Entrance } from '@/shared/motion';
import { FONT, usePuzzleTokens, useTokens } from '@/shared/theme';
import { relDay, useLondonDay } from '@/shared/time';
import { Chevron, pressable, PuzzleTile, ShareGlyph } from '@/shared/ui';

import { LabVoteBlock } from './LabVoteBlock';
import { useLabVotes } from './vote';

/** The footer's line: what a Lab puzzle is, and isn't. */
export const LAB_FOOT = 'A Lab trial: it isn’t in your streaks or leagues.';

export interface LabFinishSheetProps {
  type: LabType;
  n: number | string;
  /** The puzzle's day, YYYY-MM-DD. */
  date: string;
  /** Its page (reports/….html): a Lab type has no short link, so a share carries the page. */
  path: string;
  title: string;
  /** The big number: the time. */
  hero: string;
  note?: string;
  share: string;
  recap?: { title: string; sub?: string; node: ReactNode };
  /** The next running trial not yet played, or null. */
  next: LabFeedItem | null;
  celebrate?: boolean;
  onBack: () => void;
  onNext: (item: LabFeedItem) => void;
}

/**
 * A Lab puzzle's finish (11 Nov 2026; mock "Finish sheet · Rating a Lab puzzle"): the Lab
 * badge, the result, the one-tap "Should <Name> go daily?", the next trial, the recap, and
 * a footer saying it's a trial. Share stays at the top, as on every finish.
 */
export function LabFinishSheet(props: LabFinishSheetProps) {
  const { type, n, date, path, title, hero, note, share, recap, next } = props;
  const { celebrate = false, onBack, onNext } = props;
  const t = useTokens();
  const pt = usePuzzleTokens();
  const day = useLondonDay();
  const { votes, vote } = useLabVotes();
  const name = LAB_LABEL[type];
  const when = date < day ? relDay(date, day) : '';
  const soft = pt.sheetSoft;
  const titleRef = useRef<ComponentRef<typeof Text>>(null);
  useEffect(() => {
    if (!celebrate) return;
    const h = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(`${name} ${n}, ${title}, ${hero}`);
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }, 300);
    return () => clearTimeout(h);
  }, [celebrate, name, n, title, hero]);
  const [sharing, setSharing] = useState(false);
  const onShare = () => {
    if (sharing) return;
    setSharing(true);
    const done = () => setSharing(false);
    Share.share({ message: `${share}\ndailynoodle.co.uk/${path}` }).then(done, done);
  };
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="lab-finish">
      <ScrollView contentContainerStyle={styles.in}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Back to Puzzles"
            onPress={onBack}
            hitSlop={8}
            style={pressable(styles.back)}>
            <Text style={[styles.backText, { color: soft }]}>← Puzzles</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share result"
            accessibilityState={{ busy: sharing }}
            onPress={onShare}
            style={pressable(styles.shareTap)}
            testID="lab-share">
            <View style={[styles.pill, { borderColor: `${t.accent}88` }]}>
              <ShareGlyph color={t.accent} />
              <Text style={[styles.pillText, { color: t.accent }]}>Share</Text>
            </View>
          </Pressable>
        </View>

        <Entrance play={celebrate}>
          <View style={styles.kickRow}>
            <View style={[styles.badge, { backgroundColor: t.labSoft }]}>
              <Text style={[styles.badgeText, { color: t.labInk }]}>FROM THE LAB</Text>
            </View>
            <Text style={[styles.kicker, { color: t.faint }]} testID="lab-kicker">
              {`${name} ${n}${when ? ` · ${when}` : ''}`.toUpperCase()}
            </Text>
          </View>
        </Entrance>
        <Entrance play={celebrate} delay={90} from={0.9}>
          <Text
            testID="lab-hero"
            maxFontSizeMultiplier={1.3}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.hero, { color: pt.ink }]}>
            {hero}
          </Text>
        </Entrance>
        <Entrance play={celebrate} delay={180}>
          <Text
            ref={titleRef}
            accessibilityRole="header"
            style={[styles.outcome, { color: t.accent }]}
            testID="lab-title">
            {title}
          </Text>
          {note ? (
            <Text style={[styles.note, { color: soft }]} testID="lab-note">
              {note}
            </Text>
          ) : null}
        </Entrance>

        <LabVoteBlock type={type} vote={votes[type]?.v} onVote={(v) => vote(type, v)} />

        {next ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next trial: ${LAB_LABEL[next.type]}`}
            onPress={() => onNext(next)}
            style={pressable([styles.next, { borderColor: pt.inkSoft }])}
            testID="lab-next">
            <View pointerEvents="none">
              <PuzzleTile type={next.type} size={26} />
            </View>
            <Text style={[styles.nextText, { color: pt.ink }]}>
              Next trial: {LAB_LABEL[next.type]}
            </Text>
            <Chevron color={soft} size={8} />
          </Pressable>
        ) : null}

        {recap ? (
          <View style={styles.recap} testID="lab-recap">
            <Text accessibilityRole="header" style={[styles.label, { color: t.faint }]}>
              {recap.title.toUpperCase()}
            </Text>
            {recap.sub ? <Text style={[styles.recapSub, { color: soft }]}>{recap.sub}</Text> : null}
            <View style={styles.recapNode}>{recap.node}</View>
          </View>
        ) : null}

        <View style={[styles.foot, { borderColor: pt.hair }]}>
          <Text style={[styles.footText, { color: soft }]} testID="lab-foot">
            {LAB_FOOT}
          </Text>
        </View>
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  back: { minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: 15, fontFamily: FONT.sans },
  shareTap: { minHeight: 48, justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillText: { fontSize: 14, fontFamily: FONT.sansSemi },
  kickRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, letterSpacing: 1, fontFamily: FONT.sansSemi },
  kicker: { fontSize: 13, letterSpacing: 1.2, fontFamily: FONT.sansSemi },
  hero: {
    fontSize: 72,
    lineHeight: 80,
    fontFamily: FONT.displayHeavy,
    letterSpacing: -2,
    fontVariant: ['lining-nums', 'tabular-nums'],
    marginTop: 4,
  },
  outcome: { fontSize: 18, lineHeight: 24, fontFamily: FONT.sansSemi, marginTop: 6 },
  note: { fontSize: 14, lineHeight: 20, marginTop: 4, fontFamily: FONT.sans },
  next: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextText: { flex: 1, fontSize: 16, fontFamily: FONT.sansSemi },
  label: { fontSize: 11, lineHeight: 15, letterSpacing: 1.2, fontFamily: FONT.sansSemi },
  recap: { marginTop: 30, gap: 8 },
  recapSub: { fontSize: 14, lineHeight: 20, fontFamily: FONT.sans },
  recapNode: { marginTop: 4 },
  foot: { marginTop: 24, paddingTop: 12, borderTopWidth: 1 },
  footText: { fontSize: 14, lineHeight: 21, fontFamily: FONT.sans },
});
