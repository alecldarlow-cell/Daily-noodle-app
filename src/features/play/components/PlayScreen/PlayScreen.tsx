import { isPuzzleType, TYPE_LABEL } from '@noodle/core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '@/shared/theme';
import { PuzzleWebView } from '@/shared/webview';

/**
 * Where a puzzle opens. Every type plays through its page on the site for now
 * (the WebView bridge); from WP8 a type with a native player opens that instead.
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
