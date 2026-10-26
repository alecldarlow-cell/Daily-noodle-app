import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildLine } from '@/shared/build';
import { FONT, useTokens } from '@/shared/theme';
import { Button, Screen } from '@/shared/ui';

import { syncEnabled } from '../../api/authClient';
import { tapId } from '../../hooks/tap';
import { SyncCard } from '../SyncCard/SyncCard';

/** Account: optional sign-in, and the way in for someone who already plays elsewhere. */
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
          {syncEnabled()
            ? 'In a league on another phone or the website? Sign in above with the same email there and here, and your leagues come with you. Or play as yourself with your league’s code and PIN.'
            : 'In a league on another phone or the website? Play as yourself here too, with your league’s code and PIN.'}
        </Text>
        <Button
          kind={syncEnabled() ? 'plain' : 'go'}
          label="I have a league PIN"
          testID="account-claim"
          // A fresh `n` each tap, so Leagues opens the form again after its Back.
          onPress={() =>
            router.navigate({
              pathname: '/leagues',
              params: { go: 'claim', n: tapId() },
            })
          }
        />
      </View>
      <Pressable
        accessibilityRole="link"
        testID="account-privacy"
        onPress={() => router.navigate('/privacy')}
        style={styles.link}>
        <Text style={[styles.linkText, { color: t.accent }]}>
          Privacy: what’s recorded, and how to stop it
        </Text>
      </Pressable>
      <Text style={[styles.build, { color: t.faint }]} testID="account-build" selectable>
        {buildLine()}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 16, borderWidth: 1, borderRadius: 12, gap: 8 },
  h2: { fontFamily: FONT.displayHeavy, fontSize: 19 },
  p: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22, marginBottom: 6 },
  link: { marginTop: 24, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: FONT.bodySemi, fontSize: 15, textDecorationLine: 'underline' },
  build: { fontFamily: FONT.body, marginTop: 12, fontSize: 13 },
});
