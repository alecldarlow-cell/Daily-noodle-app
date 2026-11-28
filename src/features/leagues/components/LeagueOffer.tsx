/**
 * The finish sheet's board slot for a player in no league (28 Nov 2026, Alec's go-ahead after
 * the mocks on the canvas "League offer — mocks"; rules in ../hooks/leagueOffer.ts, the same
 * as the site's dn-board.js section 4):
 *   on a fresh finish, when an ask is due, a card: "Play with your family?" (3–6 days played)
 *     or "<N> days of puzzles. Bring your people in?" (7+), with Start a league, Not now and
 *     "Got a league link from someone? Join instead ›";
 *   otherwise, and after Not now, one quiet line "Start a league with friends ›" (Alec: as the
 *     website's), opening Leagues on Start a league.
 * Sent (appRecorder, anonymous): league_offer_view, league_offer_tap {act: start|join},
 * league_offer_dismiss, each with {days: 3-6|7+, n}.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BoardSlotProps } from '@/shared/finish-sheet';
import { appStorage } from '@/shared/storage';
import { FONT, usePuzzleTokens, useTokens } from '@/shared/theme';
import { appRecorder } from '@/shared/track';
import { Button, pressable } from '@/shared/ui';

import { leaguesParams } from '../hooks/useLeaguesFlow';
import {
  offerCopy,
  offerDue,
  playDays,
  readOffer,
  recordAsk,
  recordTap,
} from '../hooks/leagueOffer';
import { LEAD_ICON, LINK_SLOP } from './BoardLink';

type Record = (ev: string, props: { [k: string]: unknown }, path: string) => void;

export function LeagueOffer({
  path,
  celebrate = false,
  lead,
  now = Date.now,
  record = appRecorder.event,
}: Pick<BoardSlotProps, 'path' | 'celebrate' | 'lead'> & {
  /** The clock, for tests. */
  now?: () => number;
  /** Where events go, for tests. */
  record?: Record;
}) {
  // Decided once, when the sheet first draws: a fresh finish with an ask due.
  const [ask] = useState(() => {
    if (!celebrate) return null;
    const days = playDays(appStorage);
    return offerDue(readOffer(appStorage), days, now(), false) ? days : null;
  });
  const [shown, setShown] = useState(ask !== null);
  const props = useRef<{ days: string; n: number } | null>(null);
  useEffect(() => {
    if (ask === null || props.current) return;
    props.current = recordAsk(appStorage, ask, now());
    record('league_offer_view', props.current, path);
  }, [ask, now, path, record]);

  const go = (where: 'start' | 'code') => {
    recordTap(appStorage, now());
    if (props.current)
      record(
        'league_offer_tap',
        { act: where === 'start' ? 'start' : 'join', ...props.current },
        path,
      );
    router.dismissTo({
      pathname: '/leagues',
      params: leaguesParams(where === 'start' ? { go: 'start', from: 'offer' } : { go: 'code' }),
    });
  };

  if (shown && ask !== null) {
    return (
      <OfferCard
        days={ask}
        onStart={() => go('start')}
        onJoin={() => go('code')}
        onNotNow={() => {
          if (props.current) record('league_offer_dismiss', props.current, path);
          setShown(false);
        }}
      />
    );
  }
  return (
    <StartLine
      lead={!!lead}
      onPress={() =>
        router.dismissTo({
          pathname: '/leagues',
          params: leaguesParams({ go: 'start', from: 'result' }),
        })
      }
    />
  );
}

/** The Leagues tab's own noodle-line cup (white on clear), tinted: the app has no SVG library. */
const CUP = require('../../../../assets/images/tabs/leagues.png') as number;
function Trophy({ color }: { color: string }) {
  return (
    <Image
      source={CUP}
      accessible={false}
      style={[styles.cup, { tintColor: color }]}
      testID="league-offer-cup"
    />
  );
}

function OfferCard({
  days,
  onStart,
  onJoin,
  onNotNow,
}: {
  days: number;
  onStart: () => void;
  onJoin: () => void;
  onNotNow: () => void;
}) {
  const t = useTokens();
  const { title, body } = offerCopy(days);
  return (
    <View
      style={[styles.card, { backgroundColor: t.accentSoft }]}
      accessibilityRole="summary"
      accessibilityLabel="Start a league"
      testID="league-offer">
      <View style={styles.head}>
        <Trophy color={t.accent} />
        <Text
          style={[styles.title, { color: t.ink }]}
          accessibilityRole="header"
          testID="league-offer-title">
          {title}
        </Text>
      </View>
      <Text style={[styles.body, { color: t.ink }]} testID="league-offer-body">
        {body}
      </Text>
      <View style={styles.acts}>
        <Button
          variant="filled"
          label="Start a league"
          onPress={onStart}
          testID="league-offer-start"
        />
        <Button variant="text" label="Not now" onPress={onNotNow} testID="league-offer-no" />
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={onJoin}
        hitSlop={LINK_SLOP}
        style={pressable(styles.join)}
        testID="league-offer-join">
        <Text style={[styles.joinText, { color: t.accent }]}>
          Got a league link from someone? Join instead ›
        </Text>
      </Pressable>
    </View>
  );
}

function StartLine({ lead, onPress }: { lead: boolean; onPress: () => void }) {
  const pt = usePuzzleTokens();
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Start a league with friends"
      onPress={onPress}
      hitSlop={LINK_SLOP}
      style={pressable(styles.line)}
      testID="board-slot">
      {lead ? <View style={styles.blank} /> : null}
      <Text
        style={[styles.lineText, lead && styles.leadText, { color: pt.sheetSoft }]}
        testID="board-line">
        Start a league with friends <Text style={[styles.see, { color: t.accent }]}>›</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, gap: 10, alignSelf: 'stretch' },
  cup: { width: 24, height: 24 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 18, lineHeight: 23, fontFamily: FONT.display },
  body: { fontSize: 14, lineHeight: 20, fontFamily: FONT.sans },
  acts: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  join: { alignSelf: 'flex-start', paddingVertical: 2 },
  joinText: { fontSize: 13, lineHeight: 18, fontFamily: FONT.sansSemi },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  lineText: { fontSize: 14, lineHeight: 20, fontFamily: FONT.sans, flexShrink: 1 },
  leadText: { fontSize: 16, lineHeight: 21 },
  see: { fontFamily: FONT.sansSemi },
  blank: { width: LEAD_ICON, height: 1 },
});
