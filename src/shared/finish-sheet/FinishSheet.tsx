import { shortLink, TYPE_LABEL, type PuzzleType, type TodayItem } from '@noodle/core';
import { router } from 'expo-router';
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

import { Entrance } from '@/shared/motion';
import { play } from '@/shared/sound';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { longDate } from '@/shared/time';
import { Button, Chevron, pressable } from '@/shared/ui';

import { tagged, useBoardSlot } from './boardSlot';
import type { NoteParts } from './FinishParts';
import { clockLine, playsJingle, splitHero, streakLine } from './rules';
import { useFinishData } from './useFinishData';

/** How long after a fresh finish the screen reader is told the result (the entrance has begun). */
export const ANNOUNCE_MS = 300;

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
  /**
   * One line of comment ("No checks, no reveals."); none on a reopened puzzle. With a bold
   * run where the site's note has <strong> (Tangle's longest word, Reckon's bullseyes).
   */
  note?: string | NoteParts;
  /** The share line, without the short link. It goes to the share sheet, not on screen. */
  share: string;
  /** The type's stats: only its "day streak" is shown, as the line under the score. */
  stats: { value: string | number; label: string }[];
  /**
   * Whether the round was solved (default true). When it wasn't (Link out of mistakes,
   * Sweep's mine), the answer comes straight after the result (AF-015), and no jingle plays.
   */
  solved?: boolean;
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
   * when the phone asks for reduced motion), and Mini, Doku, Sweep, Path and Link play the
   * celebration jingle on a win (AF-013). Off for a finished puzzle reopened.
   */
  celebrate?: boolean;
  onBack: () => void;
  /** Open the Play more puzzle, or today's list when it names none. */
  onNext: (item: TodayItem | null) => void;
}

/** Back down to the tabs, on the Archive (the "All 8 done today. Try the archive ›" line). */
function openArchive() {
  router.dismissTo('/archive');
}

/**
 * The finish sheet every native player shows, in the website's order (engines/finish.js,
 * AF-019, Alec's design of 28 Oct 2026), one left-aligned column:
 *   1 RESULT: "Doku 107 · Solved", one big score, "🔥 5-day streak", the note;
 *   2 SHARE: one full-width filled "Share result" (the line, a newline and the short link
 *     dailynoodle.co.uk/<type> go to the phone's share sheet; the spinner shows until it opens);
 *   3 LEADERBOARD: the provided board slot's one line ("Currently 1st in Noodlers ›");
 *   4 PLAY MORE: a tonal "Play Borders 24" with "6 of 8 done today" under it;
 *   5 ANSWER: the type's recap, straight after the result when the round wasn't solved;
 * then a footer: "New Doku in 3h 38m" and the puzzle's day.
 */
export function FinishSheet(props: FinishSheetProps) {
  const { type, n, date, title, hero, heroNode, note, share, stats, recap, after } = props;
  const { path, boardSlot, onBack, onNext, celebrate = false, solved = true } = props;
  const renderSlot = useBoardSlot();
  // A tag the board slot adds once the result is on the board (🏆 for a league record).
  const [tag, setTag] = useState('');
  const shareText = tagged(share, tag);
  const pt = usePuzzleTokens();
  const { next, secs } = useFinishData(type);
  const url = shortLink(type);
  const line = clockLine(TYPE_LABEL[type], secs);
  const [heroVal, heroUnit] = splitHero(hero);
  const streak = streakLine(stats);
  const soft = pt.sheetSoft;
  const label = `${TYPE_LABEL[type]} ${n} · ${title}`;
  // A fresh finish replaces the board in the same route, so a screen reader would be left on
  // a square that is gone: say the result, and move focus to the outcome (finish.js focuses
  // .fin-title the same way). A finished puzzle reopened says nothing.
  const titleRef = useRef<ComponentRef<typeof Text>>(null);
  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(`${title}. ${hero}`);
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }, ANNOUNCE_MS);
    return () => clearTimeout(t);
  }, [celebrate, title, hero]);
  // The celebration jingle (AF-013): once, as the sheet rises on a fresh win of one of the five
  // grid puzzles; never on a reopened puzzle or a loss. `play` obeys the Account Sound switch.
  const jingle = playsJingle(type, celebrate, solved);
  const sang = useRef(false);
  useEffect(() => {
    if (!jingle || sang.current) return;
    sang.current = true;
    play('jingle');
  }, [jingle]);
  const onShare = () => Share.share({ message: `${shareText}\n${url}` }).catch(() => undefined);
  const answer = recap ? (
    <View
      style={[styles.recap, !solved && styles.recapFirst, { borderColor: pt.rule }]}
      testID="finish-recap">
      <View>
        <Text accessibilityRole="header" style={[styles.recapTitle, { color: pt.ink }]}>
          {recap.title}
        </Text>
        {recap.sub ? <Text style={[styles.recapSub, { color: soft }]}>{recap.sub}</Text> : null}
      </View>
      {recap.node}
    </View>
  ) : null;
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="finish-sheet">
      <ScrollView contentContainerStyle={styles.in}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Back to Puzzles"
          onPress={onBack}
          hitSlop={8}
          style={pressable(styles.back)}>
          <Text style={[styles.backText, { color: soft }]}>← Puzzles</Text>
        </Pressable>

        <Entrance play={celebrate} testID="finish-entrance">
          <Text
            ref={titleRef}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
            style={[styles.label, { color: soft }]}
            testID="finish-title">
            {label}
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
        {streak ? (
          <Text style={[styles.streak, { color: pt.ink }]} testID="finish-streak">
            {streak}
          </Text>
        ) : null}
        {note ? (
          <Entrance play={celebrate} delay={180}>
            <Text style={[styles.note, { color: soft }]} testID="finish-note">
              {typeof note === 'string' ? (
                note
              ) : (
                <>
                  {note.before}
                  <Text style={[styles.strong, { color: pt.ink }]}>{note.bold}</Text>
                  {note.after}
                </>
              )}
            </Text>
          </Entrance>
        ) : null}

        {solved ? null : answer}

        <View style={styles.share} testID="finish-share">
          <Button
            variant="filled"
            grow
            label="Share result"
            onPress={onShare}
            testID="finish-share-button"
          />
        </View>

        <View style={styles.slot} testID="finish-board-slot">
          {boardSlot ??
            (renderSlot && path ? renderSlot({ path, type, date, onTag: setTag }) : null)}
        </View>

        {next.all ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={next.main}
            onPress={openArchive}
            style={pressable(styles.doneLine)}
            testID="finish-next">
            <Text style={[styles.doneText, { color: pt.ink }]}>{next.main}</Text>
            <Chevron color={soft} size={7} />
          </Pressable>
        ) : (
          <View style={styles.more}>
            <View style={styles.row}>
              <Button
                variant="tonal"
                grow
                label={next.main}
                onPress={() => onNext(next.item)}
                testID="finish-next"
              />
            </View>
            {next.sub.trim() ? (
              <Text style={[styles.moreSub, { color: soft }]} testID="finish-next-sub">
                {next.sub}
              </Text>
            ) : null}
          </View>
        )}

        {solved ? answer : null}
        {after ? <View style={styles.after}>{after}</View> : null}

        <View style={[styles.foot, { borderColor: pt.hair }]} testID="finish-foot">
          <Text style={[styles.clock, { color: soft }]} testID="finish-clock">
            {line.lead}
            {line.bold ? <Text style={[styles.bold, { color: pt.ink }]}>{line.bold}</Text> : null}
          </Text>
          <Text style={[styles.day, { color: soft }]}>
            {`${TYPE_LABEL[type]} ${n}, ${longDate(date)}`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// finish.css (AF-019): Instrument Serif for the score and the recap heading, Archivo for
// everything else; one accent (the app's green), buttons stacked full width.
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
  label: { fontSize: 15, lineHeight: 20, fontFamily: FONT.sansSemi, marginTop: 8 },
  hero: {
    fontSize: 84,
    lineHeight: 88,
    fontFamily: FONT.serif,
    letterSpacing: -2.5,
    fontVariant: ['lining-nums'],
    marginTop: 4,
  },
  heroUnit: { fontSize: 26, fontFamily: FONT.serif, letterSpacing: 0 },
  heroNode: { marginTop: 14, marginBottom: 4 },
  streak: { fontSize: 16, lineHeight: 22, marginTop: 8, fontFamily: FONT.sans },
  note: { fontSize: 15, lineHeight: 22, marginTop: 6, fontFamily: FONT.sans },
  strong: { fontFamily: FONT.sansSemi },
  share: { flexDirection: 'row', marginTop: 22 },
  slot: { minHeight: 52, marginTop: 8 },
  row: { flexDirection: 'row' },
  more: { marginTop: 10 },
  moreSub: { fontSize: 13, fontFamily: FONT.sans, marginTop: 6, textAlign: 'center' },
  doneLine: {
    marginTop: 10,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  doneText: { fontSize: 15, fontFamily: FONT.sansSemi },
  recap: { marginTop: 26, paddingTop: 18, borderTopWidth: 1, gap: 14 },
  recapFirst: { marginTop: 18 },
  recapTitle: { fontSize: 28, lineHeight: 32, fontFamily: FONT.serif },
  recapSub: { fontSize: 14, fontFamily: FONT.sans, marginTop: 6 },
  after: { marginTop: 10 },
  foot: { marginTop: 30, paddingTop: 14, borderTopWidth: 1, gap: 4 },
  clock: { fontSize: 14, lineHeight: 21, fontFamily: FONT.sans },
  day: { fontSize: 13, lineHeight: 19, fontFamily: FONT.sans },
  bold: { fontFamily: FONT.sansSemi },
});
