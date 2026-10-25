import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { usePuzzleTokens } from '@/shared/theme';

import { usePuzzleData } from '../api/usePuzzleData';
import { enabled as linkEnabled } from '../link';
import { LinkScreen } from '../link/components/LinkScreen';
import { validate as validateLink, type LinkData } from '../link/model';
import { MiniScreen } from '../mini/components/MiniScreen';
import { enabled as miniEnabled } from '../mini';
import { validate as validateMini, type MiniData } from '../mini/model';
import { enabled as tangleEnabled } from '../tangle';
import { TangleScreen } from '../tangle/components/TangleScreen';
import { validate as validateTangle, type TangleData } from '../tangle/model';
import type { PuzzleFile } from '../types';

/** Puzzle types with a native player, each on once its replay has passed on every puzzle. */
export function hasNativePlayer(type: unknown): boolean {
  return (
    (type === 'mini' && miniEnabled) ||
    (type === 'link' && linkEnabled) ||
    (type === 'tangle' && tangleEnabled)
  );
}

interface NativePlayProps {
  type: string;
  file: string;
  /** What to show when the puzzle can't play natively: the WebView bridge. */
  fallback: ReactElement;
}

/**
 * A puzzle with a native player: its data from reports/<file>.json (kept for offline),
 * checked by the model's validate, then the native screen. A page without a data file,
 * data the model refuses, or no connection and no kept copy: the bridge instead.
 */
export function NativePlay({ type, file, fallback }: NativePlayProps) {
  const pt = usePuzzleTokens();
  const q = usePuzzleData(file);
  const data = q.data;
  if (!data && q.isPending)
    return (
      <View style={[styles.fill, { backgroundColor: pt.paper }]} testID="native-loading">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator style={styles.spin} color={pt.inkSoft} />
      </View>
    );
  if (type === 'mini' && data && data.type === 'mini' && validateMini(data.data).ok)
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <MiniScreen key={file} file={data as PuzzleFile<MiniData>} />
      </>
    );
  if (type === 'link' && data && data.type === 'link' && validateLink(data.data).ok)
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LinkScreen key={file} file={data as PuzzleFile<LinkData>} />
      </>
    );
  // Tangle's gate also checks the page's dn:date against the puzzle's: the data file's date.
  if (
    type === 'tangle' &&
    data &&
    data.type === 'tangle' &&
    validateTangle(data.data, data.date).ok
  )
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <TangleScreen key={file} file={data as PuzzleFile<TangleData>} />
      </>
    );
  return fallback;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spin: { marginTop: 120 },
});
