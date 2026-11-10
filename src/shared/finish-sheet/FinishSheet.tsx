import { shortLink, TYPE_LABEL, type PuzzleType, type TodayItem } from '@noodle/core';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Entrance } from '@/shared/motion';
import { askForReview, REVIEW_DELAY_MS } from '@/shared/review';
import { play } from '@/shared/sound';
import { FONT, usePuzzleTokens, useTokens } from '@/shared/theme';
import { relDay } from '@/shared/time';
import { Chevron, pressable, PuzzleTile, ShareGlyph } from '@/shared/ui';

import { tagged, useBoardSlot } from './boardSlot';
import type { NoteParts } from './FinishParts';
import {
  announcement,
  clockLine,
  dayStreak,
  NOTE_TYPES,
  personalBest,
  playsJingle,
  recapLabel,
  resultValue,
  rewardLine,
  splitHero,
  type RewardKind,
} from './rules';
import { useFinishData } from './useFinishData';

/** How long after a fresh finish the screen reader is told the result (the entrance has begun). */
export const ANNOUNCE_MS = 300;

export interface FinishSheetProps {
  type: PuzzleType;
  /** The player number ("105"). */
  n: number | string;
  /** The puzzle's day, YYYY-MM-DD. */
  date: string;
  /** The outcome: "Solved" (in green under the result; coral on a lost round). */
  title: string;
  /** The result that gets shared: "1:27". */
  hero: string;
  /** Drawn in place of `hero` when the result is a picture (Link's guess squares, Tangle's score). */
  heroNode?: ReactNode;
  /**
   * One line of comment; none on a reopened puzzle. Shown (small, under the outcome) only for
   * the types in `NOTE_TYPES`, whose note says something nothing else shows. With a bold run
   * where the site's note has <strong> (Tangle's longest word, Reckon's bullseyes).
   */
  note?: string | NoteParts;
  /** The share line, without the short link. It goes to the share sheet, not on screen. */
  share: string;
  /** The type's stats: only its "day streak" is used, for the reward line. */
  stats: { value: string | number; label: string }[];
  /**
   * Whether the round was solved (default true). When it wasn't (Link out of mistakes,
   * Sweep's mine), the answer comes straight after the result (AF-015), and no jingle plays.
   */
  solved?: boolean;
  /**
   * The type's own section (the Mini's solved grid). Its `title` is no longer drawn: a small
   * label stands over it (`RECAP_LABEL`, or "THE ANSWER" on a lost round); `sub` stays.
   */
  recap?: { title: string; sub?: string; node: ReactNode };
  /** Placed at the very end (Link's "Play again (not recorded)"). */
  after?: ReactNode;
  /** "reports/<file>.html": the page's path, for the provided board slot (leagues). */
  path?: string;
  /** Drawn in the board slot instead of the provided one. */
  boardSlot?: ReactNode;
  /**
   * A fresh solve or finish: the outcome and result arrive with a short entrance (still
   * when the phone asks for reduced motion), and Mini, Doku, Sweep, Path and Link play the
   * celebration jingle on a win (AF-013). Off for a finished puzzle reopened.
   */
  celebrate?: boolean;
  onBack: () => void;
  /** Open the Next puzzle, or today's list when it names none. */
  onNext: (item: TodayItem | null) => void;
}

/** Back down to the tabs, on the Archive (the "All 9 done" / "Try the archive" button). */
function openArchive() {
  router.dismissTo('/archive');
}

/** The held look of the Share pill and Next, as the shared Button's filled and tonal dim. */
const HELD = { opacity: 0.75 };

/** Gold, for a personal best and a streak milestone (the podium's first-place metal). */
const GOLD = { face: '#E8B931', rim: '#B88A12', ink: '#5A4300' };
/** The streak's disc: an ember face with a rim, so it reads at the coin's size (Alec, 8 Nov 2026). */
export const EMBER = { face: '#4A2414', rim: '#C2702E' };

/** The reward line's 30 pt round lead: ★ or 🔥 on gold, or 🔥 on an ember disc; all rimmed. */
function RewardIcon({ kind }: { kind: RewardKind }) {
  const gold = kind !== 'streak';
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={`finish-reward-icon-${kind}`}
      style={[
        styles.icon,
        gold
          ? { backgroundColor: GOLD.face, borderColor: GOLD.rim, borderWidth: 2.5 }
          : { backgroundColor: EMBER.face, borderColor: EMBER.rim, borderWidth: 2.5 },
      ]}>
      <Text
        maxFontSizeMultiplier={1}
        style={[
          styles.iconText,
          kind === 'pb' && { color: GOLD.ink, fontFamily: FONT.displayHeavy },
        ]}>
        {kind === 'pb' ? '★' : '🔥'}
      </Text>
    </View>
  );
}

/**
 * The finish sheet every native player shows: Alec's design B3 (approved 8 Nov 2026,
 * mock-ups FinishB3*.dc.html), one left-aligned column on the puzzle's paper:
 *   top bar: "← Puzzles", and a Share pill (the line, a newline and the short link
 *     dailynoodle.co.uk/<type> go to the phone's share sheet);
 *   kicker "SWEEP 115" (with "· 3D AGO" when it isn't today's), the result in Archivo heavy,
 *     the outcome word under it (green, or coral on a lost round);
 *   the reward block on a solved round: the first of personal best, streak milestone and
 *     streak as its main line, the league line (the board slot) as its second;
 *     a lost round has only the quiet league line;
 *   one Next button ("Next: Path 113" / "1 of 9 done today", or "All 9 done");
 *   a small label and the type's recap (straight after the button on a lost round, AF-015);
 *   footer: "New Sweep in 17h 29m" and How to play.
 */
export function FinishSheet(props: FinishSheetProps) {
  const { type, n, date, title, hero, heroNode, note, share, stats, recap, after } = props;
  const { path, boardSlot, onBack, onNext, celebrate = false, solved = true } = props;
  const renderSlot = useBoardSlot();
  // A tag the board slot adds once the result is on the board (🏆 for a league record).
  const [tag, setTag] = useState('');
  const shareText = tagged(share, tag);
  const pt = usePuzzleTokens();
  const t = useTokens();
  const { next, secs, save, day } = useFinishData(type);
  const url = shortLink(type);
  const name = TYPE_LABEL[type];
  const line = clockLine(name, secs);
  const [heroVal, heroUnit] = splitHero(hero);
  const soft = pt.sheetSoft;
  const when = date < day ? relDay(date, day) : '';
  const kicker = `${name} ${n}${when ? ` · ${when}` : ''}`;
  const pb = solved ? personalBest(type, resultValue(type, hero, stats), name, save) : null;
  const main = solved ? rewardLine(pb, dayStreak(stats), name) : null;
  const shownNote = note && NOTE_TYPES.includes(type) ? note : null;
  // A fresh finish replaces the board in the same route, so a screen reader would be left on
  // a square that is gone: say the result, and move focus to the heading (finish.js focuses
  // .fin-title the same way). A finished puzzle reopened says nothing.
  const titleRef = useRef<ComponentRef<typeof Text>>(null);
  const said = announcement(title, hero, main?.text ?? null);
  useEffect(() => {
    if (!celebrate) return;
    const h = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(said);
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }, ANNOUNCE_MS);
    return () => clearTimeout(h);
  }, [celebrate, said]);
  // The celebration jingle (AF-013): once, as the sheet rises on a fresh win of one of the five
  // grid puzzles; never on a reopened puzzle or a loss. `play` obeys the Account Sound switch.
  const jingle = playsJingle(type, celebrate, solved);
  const sang = useRef(false);
  useEffect(() => {
    if (!jingle || sang.current) return;
    sang.current = true;
    play('jingle');
  }, [jingle]);
  // The store's rating sheet (ADR-010): at most once per app version, a moment after a fresh
  // win of today's puzzle on a five-day streak. `askForReview` checks all of that itself.
  const streak = dayStreak(stats);
  const isToday = date === day;
  useEffect(() => {
    if (!celebrate || !solved) return;
    const h = setTimeout(() => {
      void askForReview({ celebrate, solved, today: isToday, streak });
    }, REVIEW_DELAY_MS);
    return () => clearTimeout(h);
  }, [celebrate, solved, isToday, streak]);
  const [sharing, setSharing] = useState(false);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );
  const onShare = () => {
    if (sharing) return;
    setSharing(true);
    const done = () => {
      if (live.current) setSharing(false);
    };
    Share.share({ message: `${shareText}\n${url}` }).then(done, done);
  };
  const slot =
    boardSlot ??
    (renderSlot && path
      ? renderSlot({ path, type, date, onTag: setTag, solved, celebrate, lead: solved })
      : null);
  const answer = recap ? (
    <View style={[styles.recap, !solved && styles.recapFirst]} testID="finish-recap">
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        style={[styles.label, { color: t.faint }]}
        testID="finish-recap-label">
        {recapLabel(type, solved)}
      </Text>
      {recap.sub ? <Text style={[styles.recapSub, { color: soft }]}>{recap.sub}</Text> : null}
      <View style={styles.recapNode}>{recap.node}</View>
    </View>
  ) : null;
  const sub = next.sub.trim();
  const nextBtn = next.all ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${next.main}. ${next.sub}`}
      onPress={openArchive}
      style={pressable([styles.next, { backgroundColor: t.accentSoft }], HELD)}
      testID="finish-next">
      <View style={styles.nextText}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.nextMain, { color: t.accent }]}>
          {next.main}
        </Text>
        <Text maxFontSizeMultiplier={1.4} style={[styles.nextSub, { color: t.accent }]}>
          {next.sub}
        </Text>
      </View>
      <Chevron color={t.accent} size={8} />
    </Pressable>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={next.main}
      accessibilityHint={sub || undefined}
      onPress={() => onNext(next.item)}
      style={pressable([styles.next, { backgroundColor: t.accent }], HELD)}
      testID="finish-next">
      {next.item ? (
        <View pointerEvents="none">
          <PuzzleTile type={next.item.type} size={26} testID="finish-next-icon" />
        </View>
      ) : null}
      <View style={styles.nextText}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.nextMain, { color: t.onAccent }]}>
          {next.main}
        </Text>
        {sub ? (
          <Text
            maxFontSizeMultiplier={1.4}
            style={[styles.nextSub, { color: t.onAccent }]}
            testID="finish-next-sub">
            {next.sub}
          </Text>
        ) : null}
      </View>
      <Chevron color={t.onAccent} size={8} />
    </Pressable>
  );
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="finish-sheet">
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
            style={pressable(styles.shareTap, HELD)}
            testID="finish-share-button">
            <View style={[styles.pill, { borderColor: `${t.accent}88` }]}>
              {sharing ? (
                <ActivityIndicator
                  color={t.accent}
                  size="small"
                  testID="finish-share-button-spinner"
                />
              ) : (
                <ShareGlyph color={t.accent} />
              )}
              <Text
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                style={[styles.pillText, { color: t.accent }]}>
                Share
              </Text>
            </View>
          </Pressable>
        </View>

        <Entrance play={celebrate} testID="finish-entrance">
          <Text
            importantForAccessibility="no"
            accessibilityElementsHidden
            maxFontSizeMultiplier={1.4}
            style={[styles.kicker, { color: t.faint }]}
            testID="finish-kicker">
            {kicker.toUpperCase()}
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
                <Text style={[styles.heroUnit, { color: soft }]}>{` ${heroUnit}`}</Text>
              ) : null}
            </Text>
          )}
        </Entrance>
        <Entrance play={celebrate} delay={180}>
          <Text
            ref={titleRef}
            accessibilityRole="header"
            accessibilityLabel={`${name} ${n} · ${title}${when ? `, ${when}` : ''}`}
            maxFontSizeMultiplier={1.4}
            style={[styles.outcome, { color: solved ? t.accent : pt.sheetBad }]}
            testID="finish-title">
            {title}
          </Text>
          {shownNote ? (
            <Text style={[styles.note, { color: soft }]} testID="finish-note">
              {typeof shownNote === 'string' ? (
                shownNote
              ) : (
                <>
                  {shownNote.before}
                  <Text style={[styles.strong, { color: pt.ink }]}>{shownNote.bold}</Text>
                  {shownNote.after}
                </>
              )}
            </Text>
          ) : null}
        </Entrance>

        {solved ? (
          <Entrance play={celebrate} delay={260}>
            {/* Two rows, icons in one column at one size (Alec, 8 Nov 2026): the reward, then
                the league with its podium disc (or a blank of the same width). */}
            <View style={styles.reward} testID="finish-reward">
              {main ? (
                <View style={styles.rewardRow}>
                  <RewardIcon kind={main.kind} />
                  <Text style={[styles.rewardMain, { color: pt.ink }]} testID="finish-reward-main">
                    {main.text}
                  </Text>
                </View>
              ) : null}
              <View testID="finish-board-slot">{slot}</View>
            </View>
          </Entrance>
        ) : (
          <View style={styles.lostSlot} testID="finish-board-slot">
            {slot}
          </View>
        )}

        {nextBtn}

        {answer}
        {after ? <View style={styles.after}>{after}</View> : null}

        <View style={[styles.foot, { borderColor: pt.hair }]} testID="finish-foot">
          <Text style={[styles.clock, { color: soft }]} testID="finish-clock">
            {line.lead}
            {line.bold ? <Text style={[styles.bold, { color: pt.ink }]}>{line.bold}</Text> : null}
          </Text>
          {/* Alec, 7 Nov 2026: a played card shows its result where How to play was, so the
              rules live here, after the game, for every type. */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`How to play ${name}`}
            hitSlop={10}
            onPress={() => router.push({ pathname: '/how-to-play', params: { type } })}
            style={pressable(styles.howTo)}
            testID="finish-howto">
            <Text style={[styles.howToText, { color: pt.ink }]}>How to play</Text>
            <Chevron color={soft} size={7} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Design B3: Archivo heavy for the result, Archivo for everything else; one accent (the
// app's green), coral for a lost round, gold for a personal best or a milestone.
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontFamily: FONT.sans },
  shareTap: { minHeight: 48, justifyContent: 'center', flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillText: { fontSize: 14, fontFamily: FONT.sansSemi, flexShrink: 1 },
  kicker: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.2,
    fontFamily: FONT.sansSemi,
    marginTop: 22,
  },
  hero: {
    fontSize: 72,
    lineHeight: 80,
    fontFamily: FONT.displayHeavy,
    letterSpacing: -2,
    fontVariant: ['lining-nums', 'tabular-nums'],
    marginTop: 4,
  },
  heroUnit: { fontSize: 26, fontFamily: FONT.display, letterSpacing: 0 },
  heroNode: { marginTop: 14, marginBottom: 4 },
  outcome: { fontSize: 18, lineHeight: 24, fontFamily: FONT.sansSemi, marginTop: 6 },
  note: { fontSize: 14, lineHeight: 20, marginTop: 4, fontFamily: FONT.sans },
  strong: { fontFamily: FONT.sansSemi },
  reward: { gap: 12, marginTop: 18 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rewardMain: { flex: 1, fontSize: 16, lineHeight: 21, fontFamily: FONT.sansSemi },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 16, lineHeight: 20 },
  lostSlot: { marginTop: 18 },
  next: {
    minHeight: 58,
    borderRadius: 29,
    paddingHorizontal: 22,
    paddingVertical: 8,
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextText: { flex: 1 },
  nextMain: { fontSize: 16, lineHeight: 21, fontFamily: FONT.sansSemi },
  nextSub: { fontSize: 12, lineHeight: 16, fontFamily: FONT.sansMedium, opacity: 0.8 },
  label: { fontSize: 11, lineHeight: 15, letterSpacing: 1.2, fontFamily: FONT.sansSemi },
  recap: { marginTop: 30, gap: 8 },
  recapFirst: { marginTop: 26 },
  recapSub: { fontSize: 14, lineHeight: 20, fontFamily: FONT.sans },
  recapNode: { marginTop: 4 },
  after: { marginTop: 10 },
  foot: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  clock: { fontSize: 14, lineHeight: 21, fontFamily: FONT.sans, flexShrink: 1 },
  bold: { fontFamily: FONT.sansSemi },
  howTo: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  howToText: { fontSize: 14, fontFamily: FONT.sansSemi },
});
