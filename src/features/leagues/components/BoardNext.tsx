/* "Play next" under a league board (#200, review of 27 Nov 2026): today's next unplayed puzzle. */
import { BOARD_TYPES, type PuzzleType } from '@noodle/core';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pushPuzzle, usePlayed } from '@/shared/played';
import { FONT, useTokens } from '@/shared/theme';
import { Chevron, PuzzleTile, TAP } from '@/shared/ui';

import type { PuzzleCard } from '../types';

/** Today's puzzles in the daily order (BOARD_TYPES), one card each. */
export function todaysCards(cards: readonly PuzzleCard[] | undefined, today: string): PuzzleCard[] {
  const out: PuzzleCard[] = [];
  for (const b of BOARD_TYPES) {
    const c = (cards || []).find((x) => x.type === b.id && x.date === today);
    if (c) out.push(c);
  }
  return out;
}

/**
 * The first of today's puzzles you haven't finished, skipping `skip` (the board's own puzzle,
 * which has its own "You haven't played this one yet" line). Nothing once all are done.
 */
export function PlayNext({
  cards,
  today,
  skip,
}: {
  cards: readonly PuzzleCard[] | undefined;
  today: string;
  skip?: string;
}) {
  const t = useTokens();
  const todays = useMemo(() => todaysCards(cards, today), [cards, today]);
  const { byId } = usePlayed(todays as unknown as { type: PuzzleType; id: string }[], today);
  const next = todays.find((c) => c.type !== skip && !byId[c.id]?.done);
  if (!next) return null;
  const file = next.path.replace(/^reports\//, '').replace(/\.html$/, '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play next: ${next.headline}`}
      testID="play-next"
      onPress={() =>
        pushPuzzle({
          pathname: '/play/[type]/[file]',
          params: { type: next.type as PuzzleType, file },
        })
      }
      style={({ pressed }) => [
        styles.card,
        { borderColor: t.hair, backgroundColor: pressed ? t.accentSoft : t.paper },
      ]}>
      <View style={styles.tile}>
        <PuzzleTile type={next.type as PuzzleType} size={40} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.kicker, { color: t.faint }]}>PLAY NEXT</Text>
        <Text numberOfLines={1} style={[styles.title, { color: t.ink }]}>
          {next.headline}
        </Text>
      </View>
      <Chevron color={t.muted} dir="right" size={8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: TAP + 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  tile: { width: 40, height: 40, borderRadius: 7, overflow: 'hidden' },
  text: { flex: 1, minWidth: 0 },
  kicker: { fontFamily: FONT.bodyBold, fontSize: 11, letterSpacing: 0.8 },
  title: { fontFamily: FONT.displayHeavy, fontSize: 17, lineHeight: 22 },
});
