import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTokens } from '@/shared/theme';

interface ScreenProps {
  title: string;
  children?: ReactNode;
  testID?: string;
}

/** A titled, scrollable page on the house canvas, inside the safe area. */
export function Screen({ title, children, testID }: ScreenProps) {
  const t = useTokens();
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: t.canvas }]}
      edges={['top', 'left', 'right']}
      testID={testID}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.mast, { borderBottomColor: t.ink }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.ink }]}>
            {title}
          </Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 72 },
  mast: { paddingTop: 14, paddingBottom: 10, borderBottomWidth: 2, marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
});
