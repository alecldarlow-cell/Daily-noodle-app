import { StyleSheet, Text } from 'react-native';

import { useTokens } from '@/shared/theme';
import { Screen } from '@/shared/ui';

/** Today: placeholder until its work package lands. */
export function TodayScreen() {
  const t = useTokens();
  return (
    <Screen title="Today" testID="today-screen">
      <Text style={[styles.body, { color: t.muted }]}>Today’s eight puzzles arrive here next.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 17, lineHeight: 26 },
});
