import { StyleSheet, Text } from 'react-native';

import { useTokens } from '@/shared/theme';
import { Screen } from '@/shared/ui';

/** Archive: placeholder until its work package lands. */
export function ArchiveScreen() {
  const t = useTokens();
  return (
    <Screen title="Archive" testID="archive-screen">
      <Text style={[styles.body, { color: t.muted }]}>Every past puzzle, by type and month.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 17, lineHeight: 26 },
});
