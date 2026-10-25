import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildLine } from '@/shared/build';
import { useTokens } from '@/shared/theme';
import { Screen } from '@/shared/ui';

import { SyncCard } from '../SyncCard/SyncCard';

/** Account: sign-in arrives with WP7. For now, the way in for someone who already plays. */
export function AccountScreen() {
  const t = useTokens();
  return (
    <Screen title="Account" testID="account-screen">
      <SyncCard />
      <View style={[styles.card, { backgroundColor: t.paper, borderColor: t.hair }]}>
        <Text accessibilityRole="header" style={[styles.h2, { color: t.ink }]}>
          Already a player?
        </Text>
        <Text style={[styles.p, { color: t.muted }]}>
          In a league on another browser or app? Play as yourself here too, with your league’s
          invite link and your PIN, or your personal link.
        </Text>
        <Pressable
          accessibilityRole="button"
          testID="account-claim"
          onPress={() => router.navigate({ pathname: '/leagues', params: { go: 'claim' } })}
          style={[styles.btn, { backgroundColor: t.accent }]}>
          <Text style={[styles.btnText, { color: t.paper }]}>Bring my leagues here</Text>
        </Pressable>
      </View>
      <Text style={[styles.build, { color: t.faint }]} testID="account-build" selectable>
        {buildLine()}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 17, lineHeight: 26 },
  card: { marginTop: 18, padding: 16, borderWidth: 1, borderRadius: 12, gap: 8 },
  h2: { fontSize: 19, fontWeight: '800' },
  p: { fontSize: 15, lineHeight: 22 },
  btn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  build: { marginTop: 28, fontSize: 13 },
});
