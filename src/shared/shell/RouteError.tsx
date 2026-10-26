import { router, type ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTokens } from '@/shared/theme';
import { Note } from '@/shared/ui';

/** Leaves a broken or missing page for Today, the one page that is always there. */
export function goToToday(): void {
  try {
    router.dismissTo('/');
  } catch {
    // The root itself failed before its navigator mounted: Try again is the only way on.
  }
}

/**
 * A screen that crashed, in the house style rather than the router's red developer page:
 * Try again re-renders it, Go to Today leaves it.
 */
export function RouteError({ error, retry }: ErrorBoundaryProps) {
  const t = useTokens();
  if (__DEV__) console.warn('A screen crashed', error);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: t.canvas }]} testID="route-error">
      <View style={styles.in}>
        <Note
          title="Something went wrong"
          body="This page couldn’t be shown. Try again, or go back to today’s puzzles."
          action={{ label: 'Try again', onPress: () => void retry() }}
          alt={{ label: 'Go to Today', onPress: goToToday }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  in: { paddingHorizontal: 16, paddingTop: 24 },
});
