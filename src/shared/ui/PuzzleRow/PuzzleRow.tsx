import type { AnyType, PlayedState } from '@noodle/core';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';

import { PuzzleTile } from '../PuzzleTile/PuzzleTile';
import { Standfirst } from './Standfirst';

/** The gold coin (assets/images/gold-coin.png, the site's coin SVG): one design everywhere. */
const GOLD_COIN = require('../../../../assets/images/gold-coin.png') as number;

interface PuzzleRowProps {
  type: AnyType;
  title: string;
  /** The card's standfirst, up to three lines. */
  detail?: string;
  /** The tile's grid (feed-lite `mask`); picture types and older cards have none. */
  mask?: string;
  /** "Today", "Yesterday" or a short date: the callout row's left side. */
  when?: string;
  played: PlayedState | null;
  /** The time a round left part-way shows beside Continue ("4:05", "1:12 left"). */
  roundTime?: string;
  /** Offline, and this puzzle is downloaded (opened before), so it still plays. */
  kept?: boolean;
  onPress: () => void;
  /** "How to play", a sibling of the card so it never opens the puzzle. */
  onHowTo?: () => void;
  /** The hairline under the card; off for the last daily when the Lab panel follows (15 Nov 2026). */
  rule?: boolean;
  /** A Lab trial's puzzle: a small pink "Lab trial" label on its tile (Alec, 20 Nov 2026, the Archive). */
  lab?: boolean;
  testID?: string;
}

/** The tile's size, and so the text column's height. */
export const TILE = 96;
/** Space above and below each card. */
export const CARD_PAD = 20;

/** Space kept between the meta line and "How to play". */
const HOWTO_GAP = 8;
/** Narrower than this beside "How to play", the meta line drops onto its own line instead. */
export const META_MIN_WIDTH = 120;

/**
 * Where "How to play" goes (it is the card's sibling, laid over its corner, so it never opens
 * the puzzle): beside the meta line with exactly its own width kept clear, or, when that
 * would leave the meta line too narrow (large text), on a line of its own under it. Before
 * the first layout, a fixed 88 pt is kept, as before.
 */
export function howToRoom(bodyWidth: number, howToWidth: number, howToHeight: number) {
  if (!bodyWidth || !howToWidth) return { paddingRight: 88 };
  const room = howToWidth + HOWTO_GAP;
  if (bodyWidth - room >= META_MIN_WIDTH) return { paddingRight: room };
  return { paddingBottom: Math.max(24, howToHeight) + 4 };
}

/**
 * One puzzle as the site's front-page card (front.css `.card`, front.js `card`): the
 * 96 pt preview tile with a played mark on its corner, and beside it a column the tile's
 * height (Alec, 7 Nov 2026): the headline, the standfirst in two lines, and at the bottom
 * a callout row: when on the left ("Today", "Yesterday", a date), and on the right exactly
 * one thing, the result once there is one, else "How to play" (then also on the finish
 * sheet). No reading time. At large text the column grows rather than clips.
 */
export function PuzzleRow({
  type,
  title,
  detail,
  mask,
  when,
  played,
  roundTime,
  kept,
  onPress,
  onHowTo,
  rule = true,
  lab = false,
  testID,
}: PuzzleRowProps) {
  const t = useTokens();
  const [bodyW, setBodyW] = useState(0);
  const [howTo, setHowTo] = useState({ w: 0, h: 0 });
  const onBody = (e: LayoutChangeEvent) => setBodyW(e.nativeEvent.layout.width);
  const onHowToLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setHowTo((o) => (o.w === w && o.h === h ? o : { w, h }));
  };
  // A round left part-way says Continue, with its time when known (AF-020).
  const result = played?.done ? played.text : played ? 'Continue' : null;
  const time = played && !played.done ? roundTime : undefined;
  const offline = kept ? 'Downloaded' : undefined;
  const gold = played?.done && played.gold ? played.gold : '';
  const label = [
    title,
    lab ? 'Lab trial' : null,
    result ?? when,
    gold ? 'gold star' : null,
    time,
    offline?.toLowerCase(),
  ]
    .filter(Boolean)
    .join(', ');
  const meta = [when, offline].filter((s): s is string => !!s);
  const right = result ? [result, time].filter(Boolean).join(' · ') : null;
  const howToShown = !!onHowTo && !result;
  const resultColour = played?.done
    ? played.lost
      ? t.muted
      : t.accent
    : played
      ? t.startedInk
      : t.faint;

  return (
    <View
      style={[styles.card, rule ? { borderBottomColor: t.hair } : styles.noRule]}
      testID={testID ? `${testID}-card` : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.press, { opacity: pressed ? 0.7 : 1 }]}>
        <View>
          <PuzzleTile type={type} mask={mask} testID={testID ? `${testID}-tile` : undefined} />
          {lab ? (
            <View
              testID={testID ? `${testID}-lab` : undefined}
              style={[styles.lab, { backgroundColor: t.labSoft, borderColor: t.canvas }]}>
              <Text maxFontSizeMultiplier={1} style={[styles.labText, { color: t.labInk }]}>
                LAB TRIAL
              </Text>
            </View>
          ) : null}
          {gold ? (
            // a gold result's coin replaces the tick (21 Nov 2026), in the tick's own ring, a touch
            // larger; the result words stay green for every finish (gold words read as yellow)
            <View
              testID={testID ? `${testID}-gold` : undefined}
              style={[styles.gold, { borderColor: t.canvas, backgroundColor: t.canvas }]}>
              <Image source={GOLD_COIN} accessible={false} style={styles.goldCoin} />
            </View>
          ) : played ? (
            <View
              testID={testID ? `${testID}-mark` : undefined}
              style={[
                styles.mark,
                { borderColor: t.canvas, backgroundColor: played.done ? t.accent : t.play },
              ]}>
              {played.done ? (
                <Text maxFontSizeMultiplier={1} style={[styles.tick, { color: t.onAccent }]}>
                  ✓
                </Text>
              ) : (
                <View style={[styles.dot, { backgroundColor: t.onPlay }]} />
              )}
            </View>
          ) : null}
        </View>
        <View style={styles.body} onLayout={onBody} testID={testID ? `${testID}-body` : undefined}>
          <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
          {detail ? (
            <Standfirst
              text={detail}
              max={2}
              style={[styles.detail, { color: t.muted }]}
              testID={testID ? `${testID}-detail` : undefined}
            />
          ) : null}
          <View
            style={[styles.meta, howToShown ? howToRoom(bodyW, howTo.w, howTo.h) : null]}
            testID={testID ? `${testID}-metarow` : undefined}>
            {/* One line: "Yesterday · Downloaded" shrinks a touch to fit beside How to play
                rather than breaking in two (seen at a large text size on a Pixel). */}
            <Text
              style={styles.metaItem}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              testID={testID ? `${testID}-meta` : undefined}>
              {meta.map((m, i) => (
                <Text key={i}>
                  {i > 0 ? <Text style={{ color: t.hair }}>{'  ·  '}</Text> : null}
                  <Text style={{ color: t.faint }}>{m}</Text>
                </Text>
              ))}
            </Text>
            {right ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.result,
                  { color: resultColour },
                  !(played?.done && played.lost) ? styles.resultText : null,
                ]}
                testID={testID ? `${testID}-result` : undefined}>
                {right}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      {howToShown ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`How to play ${title.replace(/\s*\d+$/, '')}`}
          onPress={onHowTo}
          hitSlop={10}
          onLayout={onHowToLayout}
          testID={testID ? `${testID}-howto` : undefined}
          style={styles.howTo}>
          <Text style={[styles.howToText, { color: t.muted }]}>How to play</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth, position: 'relative' },
  noRule: { borderBottomWidth: 0 },
  // 20 pt above and below every card, so the tiles (and the text beside them) stream evenly.
  press: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: CARD_PAD },
  mark: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontFamily: FONT.bodyBold, fontSize: 13, lineHeight: 15 },
  gold: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldCoin: { width: 23, height: 23 },
  // The Lab label sits on the tile's foot, as the played mark sits on its corner.
  lab: {
    position: 'absolute',
    left: 6,
    bottom: -7,
    borderRadius: 7,
    borderWidth: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  labText: { fontFamily: FONT.bodyBold, fontSize: 9, letterSpacing: 0.6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  // The tile's height, with the callout row pinned to its foot.
  body: { flex: 1, minHeight: TILE },
  title: { fontFamily: FONT.display, fontSize: 19, lineHeight: 23, letterSpacing: -0.19 },
  detail: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20, marginTop: 4 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 4,
    minHeight: 24,
  },
  metaItem: { flexShrink: 1, fontFamily: FONT.bodySemi, fontSize: 12 },
  resultText: { fontFamily: FONT.bodyBold },
  // The result, right-aligned where How to play sits on an unplayed card.
  result: { marginLeft: 'auto', paddingLeft: 8, fontFamily: FONT.bodySemi, fontSize: 12 },
  howTo: {
    position: 'absolute',
    right: 0,
    bottom: CARD_PAD,
    minHeight: 24,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  howToText: { fontFamily: FONT.bodySemi, fontSize: 12 },
});
