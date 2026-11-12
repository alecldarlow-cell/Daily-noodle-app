import { isPuzzleType, TYPE_LABEL } from '@noodle/core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '@/shared/theme';
import { PuzzleWebView } from '@/shared/webview';

/**
 * A puzzle through its page on the site (the WebView bridge). The play route opens a
 * type's native player instead where one is enabled (src/features/puzzles), and this
 * is the fallback when a puzzle has no data file or its data can't play natively.
 */
export function PlayScreen() {
  const t = useTokens();
  const { type, file } = useLocalSearchParams<{ type: string; file: string }>();
  const label = isPuzzleType(type) ? TYPE_LABEL[type] : 'Puzzle';
  return (
    <View style={[styles.fill, { backgroundColor: t.canvas }]} testID="play-screen">
      <Stack.Screen options={{ title: label }} />
      <PuzzleWebView file={String(file ?? '')} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
