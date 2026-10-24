import { StyleSheet, Text } from 'react-native';

import { useTokens } from '@/shared/theme';
import { Screen } from '@/shared/ui';

/** Account: placeholder until its work package lands. */
export function AccountScreen() {
  const t = useTokens();
  return (
    <Screen title="Account" testID="account-screen">
      <Text style={[styles.body, { color: t.muted }]}>
        Sign in to keep your streaks on every phone. Optional.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 17, lineHeight: 26 },
});
