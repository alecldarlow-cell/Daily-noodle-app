import type { PlayedState, PuzzleType } from '@noodle/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';

import { PuzzleTile } from '../PuzzleTile/PuzzleTile';

interface PuzzleRowProps {
  type: PuzzleType;
  title: string;
  /** The card's standfirst, up to three lines. */
  detail?: string;
  /** The tile's grid (feed-lite `mask`); picture types and older cards have none. */
  mask?: string;
  /** "Today", "Yesterday" or a short date: the meta line's first word. */
  when?: string;
  /** Reading time ("~3 min"), shown until the puzzle is played. */
  read?: string;
  played: PlayedState | null;
  onPress: () => void;
  /** "How to play", a sibling of the card so it never opens the puzzle. */
  onHowTo?: () => void;
  testID?: string;
}

/**
 * One puzzle as the site's front-page card (front.css `.card`, front.js `card`): the
 * 96 pt preview tile with a played mark on its corner, the headline, the standfirst, and
 * a meta line of when · result (or reading time), with "How to play" at its end.
 */
export function PuzzleRow({
  type,
  title,
  detail,
  mask,
  when,
  read,
  played,
  onPress,
  onHowTo,
  testID,
}: PuzzleRowProps) {
  const t = useTokens();
  const result = played?.done ? played.text : played ? 'In progress' : null;
  const label = [title, result ?? when].filter(Boolean).join(', ');
  const meta = [when, result ?? read].filter((s): s is string => !!s);
  const resultColour = played?.done
    ? played.lost
      ? t.muted
      : t.accent
    : played
      ? t.startedInk
      : t.faint;

  return (
    <View style={[styles.card, { borderBottomColor: t.hair }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.press, { opacity: pressed ? 0.7 : 1 }]}>
        <View>
          <PuzzleTile type={type} mask={mask} testID={testID ? `${testID}-tile` : undefined} />
          {played ? (
            <View
              testID={testID ? `${testID}-mark` : undefined}
              style={[
                styles.mark,
                { borderColor: t.canvas, backgroundColor: played.done ? t.accent : t.play },
              ]}>
              {played.done ? (
                <Text style={[styles.tick, { color: t.onAccent }]}>✓</Text>
              ) : (
                <View style={[styles.dot, { backgroundColor: t.onPlay }]} />
              )}
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
          {detail ? (
            <Text numberOfLines={3} style={[styles.detail, { color: t.muted }]}>
              {detail}
            </Text>
          ) : null}
          <View style={[styles.meta, onHowTo ? styles.metaRoom : null]}>
            {/* One line: "Yesterday · Solved in 1:20" shrinks a touch to fit beside How to play
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
                  <Text
                    style={[
                      { color: m === result ? resultColour : t.faint },
                      m === result && !(played?.done && played.lost) ? styles.resultText : null,
                    ]}>
                    {m}
                  </Text>
                </Text>
              ))}
            </Text>
          </View>
        </View>
      </Pressable>
      {onHowTo ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`How to play ${title.replace(/\s*\d+$/, '')}`}
          onPress={onHowTo}
          hitSlop={10}
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
  press: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 18 },
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
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  body: { flex: 1 },
  title: { fontFamily: FONT.display, fontSize: 19, lineHeight: 23, letterSpacing: -0.19 },
  detail: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20, marginTop: 7 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 9, minHeight: 24 },
  metaRoom: { paddingRight: 88 },
  metaItem: { flexShrink: 1, fontFamily: FONT.bodySemi, fontSize: 12 },
  resultText: { fontFamily: FONT.bodyBold },
  howTo: {
    position: 'absolute',
    right: 0,
    bottom: 18,
    minHeight: 24,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  howToText: { fontFamily: FONT.bodySemi, fontSize: 12 },
});
