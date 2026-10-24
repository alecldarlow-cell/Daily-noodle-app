import { StyleSheet, Text } from 'react-native';

import { useTokens } from '@/shared/theme';
import { Screen } from '@/shared/ui';

/** Leagues: placeholder until its work package lands. */
export function LeaguesScreen() {
  const t = useTokens();
  return (
    <Screen title="Leagues" testID="leagues-screen">
      <Text style={[styles.body, { color: t.muted }]}>Your leagues and today’s boards.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 17, lineHeight: 26 },
});
