import { useEffect, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT, useTokens } from '@/shared/theme';
import { Note } from '@/shared/ui';

import { appStorage } from './appStorage';
import type { CachedStorage } from './cachedStorage';

/**
 * The quiet "Couldn't save, retrying" line over every screen while a result, streak or
 * other critical write hasn't reached the phone's storage (hardening R1). It never blocks a
 * tap. Leaving the app tries the queued writes again at once, as the phone may close it.
 */
export function SaveNotice({ store = appStorage }: { store?: CachedStorage }) {
  const t = useTokens();
  const status = useSyncExternalStore(
    (fn) => store.subscribeStatus(fn),
    () => store.saveStatus,
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') store.flush().catch(() => undefined);
    });
    return () => sub.remove();
  }, [store]);
  if (status !== 'retrying') return null;
  return (
    <SafeAreaView edges={['top']} pointerEvents="none" style={styles.over}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.pill, { backgroundColor: t.paper, borderColor: t.hair }]}
        testID="save-notice">
        <Text style={[styles.text, { color: t.ink }]}>Couldn’t save, retrying</Text>
      </View>
    </SafeAreaView>
  );
}

/** In place of the app when the saves couldn't be read at launch (hardening R2). */
export function SavesLoadFailed({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const t = useTokens();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: t.canvas }]} testID="saves-load-failed">
      <View style={styles.in}>
        <Note
          title="Couldn’t load your saves"
          body="Your results and streaks are still on this phone, and nothing has been changed. Try again, or close the app and open it again."
          action={{
            label: retrying ? 'Trying again…' : 'Try again',
            onPress: () => {
              if (!retrying) onRetry();
            },
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  over: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  pill: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontFamily: FONT.bodySemi, fontSize: 13 },
  fill: { flex: 1 },
  in: { paddingHorizontal: 16, paddingTop: 24 },
});
