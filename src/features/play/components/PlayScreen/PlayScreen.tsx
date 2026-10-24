import { isPuzzleType, TYPE_LABEL } from '@noodle/core';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useTokens } from '@/shared/theme';
import { Screen } from '@/shared/ui';

/** Where a puzzle opens. WP4 plays it through the site's page; WP8 on, natively by type. */
export function PlayScreen() {
  const t = useTokens();
  const { type, file } = useLocalSearchParams<{ type: string; file: string }>();
  const label = isPuzzleType(type) ? TYPE_LABEL[type] : 'Puzzle';
  return (
    <Screen title={label} subtitle={file} testID="play-screen">
      <Text style={[styles.body, { color: t.muted }]}>
        Playing in the app arrives in the next build.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { fontSize: 17, lineHeight: 26 } });
