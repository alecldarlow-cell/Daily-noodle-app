import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT, useTokens } from '@/shared/theme';

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
 * The site's masthead (front.css `.mast`): the DP monogram and the Noodle·Puzzles wordmark,
 * with the page's name as the kicker on the right, over a 2 pt ink rule.
 */
function Masthead({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = useTokens();
  return (
    <View style={[styles.mast, { borderBottomColor: t.ink }]}>
      <View style={[styles.mono, { backgroundColor: t.accent }]} accessible={false}>
        <Text style={[styles.monoText, { color: t.onAccent }]}>DP</Text>
      </View>
      <Text style={[styles.word, { color: t.ink }]} accessible={false}>
        Noodle<Text style={{ color: t.accent }}>Puzzles</Text>
      </Text>
      <View style={styles.kick}>
        <Text accessibilityRole="header" style={[styles.kickText, { color: t.faint }]}>
          {title}
        </Text>
        {subtitle ? <Text style={[styles.kickText, { color: t.faint }]}>{subtitle}</Text> : null}
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
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
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
    alignItems: 'center',
    gap: 11,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    marginBottom: 12,
  },
  mono: {
    width: 30,
    height: 30,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoText: { fontFamily: FONT.displayHeavy, fontSize: 17, letterSpacing: -1 },
  word: { fontFamily: FONT.displayHeavy, fontSize: 21, letterSpacing: -0.42 },
  kick: { marginLeft: 'auto', alignItems: 'flex-end' },
  kickText: {
    fontFamily: FONT.bodySemi,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
  },
});
