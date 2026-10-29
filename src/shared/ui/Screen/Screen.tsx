import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT, useTokens, type Tokens } from '@/shared/theme';

interface ScreenProps {
  /** The page's name, set as the masthead's kicker ("Today", "Archive"). */
  title: string;
  /** A second kicker line under the title (Today's date). */
  subtitle?: string;
  /** Pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** False when the page brings its own list (a SectionList scrolls itself). */
  scroll?: boolean;
  children?: ReactNode;
  testID?: string;
}

/**
 * Largest text sizes for the masthead, which is a logo more than text: the monogram never
 * grows past its 30 pt box (at 2.0 the letters clipped in it), the wordmark grows a little, the
 * kicker a little more. If the row still doesn't fit (large text, a narrow phone) the kicker
 * wraps under the wordmark, right-aligned, rather than running off the screen.
 */
export const MAST_MAX_SCALE = { mono: 1, word: 1.2, kick: 1.5 } as const;

/** The pull-to-refresh spinner in the house colours (Android draws a white disc otherwise). */
export function refreshColors(t: Tokens) {
  return { colors: [t.accent], progressBackgroundColor: t.paper, tintColor: t.muted };
}

/**
 * The masthead: the Daily Noodle mark (the launcher icon's green DN tile, drawn in code) and
 * the Daily Noodle wordmark, with the page's name as the kicker on the right, over a 2 pt
 * ink rule (the site's front.css `.mast` layout).
 */
function Masthead({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = useTokens();
  return (
    <View style={[styles.mast, { borderBottomColor: t.ink }]} testID="masthead">
      <View style={styles.brand}>
        <View
          style={[styles.mono, { backgroundColor: t.brand }]}
          accessible={false}
          testID="masthead-mark">
          <Text
            maxFontSizeMultiplier={MAST_MAX_SCALE.mono}
            style={[styles.monoText, { color: t.onBrand }]}
            testID="masthead-mono">
            DN
          </Text>
        </View>
        <Text
          maxFontSizeMultiplier={MAST_MAX_SCALE.word}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.word, { color: t.ink }]}
          accessible={false}
          testID="masthead-word">
          Daily <Text style={{ color: t.accent }}>Noodle</Text>
        </Text>
      </View>
      <View style={styles.kick} testID="masthead-kicker">
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={MAST_MAX_SCALE.kick}
          style={[styles.kickText, { color: t.faint }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            maxFontSizeMultiplier={MAST_MAX_SCALE.kick}
            style={[styles.kickText, { color: t.faint }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** A page on the house canvas, inside the safe area, under the site's masthead. */
export function Screen({
  title,
  subtitle,
  onRefresh,
  refreshing = false,
  scroll = true,
  children,
  testID,
}: ScreenProps) {
  const t = useTokens();
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: t.canvas }]}
      edges={['top', 'left', 'right']}
      testID={testID}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          // A tap on a button while the keyboard is up acts at once, rather than only
          // closing the keyboard; on iOS the content moves up clear of the keyboard.
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                testID={testID ? `${testID}-refresh` : undefined}
                {...refreshColors(t)}
              />
            ) : undefined
          }>
          <Masthead title={title} subtitle={subtitle} />
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>
          <Masthead title={title} subtitle={subtitle} />
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 72 },
  fill: { flex: 1, paddingBottom: 0 },
  mast: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 11,
    rowGap: 4,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    marginBottom: 12,
  },
  // The monogram and wordmark keep together; the wordmark shrinks before it would overflow.
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1, maxWidth: '100%' },
  mono: {
    width: 30,
    height: 30,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // includeFontPadding off and a set line height so "DN" sits in the middle on Android too.
  monoText: {
    fontFamily: FONT.displayHeavy,
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -1,
    includeFontPadding: false,
  },
  word: { fontFamily: FONT.displayHeavy, fontSize: 21, letterSpacing: -0.42, flexShrink: 1 },
  kick: { marginLeft: 'auto', alignItems: 'flex-end', flexShrink: 0 },
  kickText: {
    fontFamily: FONT.bodySemi,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
  },
});
