import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTokens } from '@/shared/theme';

interface ScreenProps {
  title: string;
  subtitle?: string;
  /** Pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** False when the page brings its own list (a SectionList scrolls itself). */
  scroll?: boolean;
  children?: ReactNode;
  testID?: string;
}

/** A titled, scrollable page on the house canvas, inside the safe area. */
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
          <View style={[styles.mast, { borderBottomColor: t.ink }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: t.faint }]}>{subtitle}</Text>
            ) : null}
          </View>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>
          <View style={[styles.mast, { borderBottomColor: t.ink }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: t.faint }]}>{subtitle}</Text>
            ) : null}
          </View>
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
  mast: { paddingTop: 14, paddingBottom: 10, borderBottomWidth: 2, marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, marginTop: 2 },
});
