import type { SupabaseClient } from '@supabase/supabase-js';
import { useLinkingURL } from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { Button, Note, Screen } from '@/shared/ui';

import { authClient } from '../../api/authClient';
import { completeLink } from '../../hooks/useAccount';

/** How long to wait for the link (and Supabase) before saying it didn't work. */
export const SIGN_IN_WAIT_MS = 15_000;

/** No link arrived, or signing in never answered (a weak signal). */
export const TOO_LONG = 'Signing in is taking too long. Check your connection and try again.';

/**
 * Where the email's sign-in link lands (dailynoodle://auth): finish signing in, go to
 * Account. While it works there's a way back; if nothing has happened after a while
 * (no link, or no answer) it says so instead of spinning for ever.
 */
export function AuthLinkScreen({
  client = authClient(),
  waitMs = SIGN_IN_WAIT_MS,
}: {
  client?: SupabaseClient | null;
  waitMs?: number;
}) {
  const t = useTokens();
  const url = useLinkingURL(); // the latest link, even one that arrived before this screen mounted
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    void completeLink(url, client).then((e) => {
      if (!live) return;
      if (e) setError(e);
      else router.replace('/account');
    });
    return () => {
      live = false;
    };
  }, [url, client]);
  useEffect(() => {
    if (error) return;
    const timer = setTimeout(() => setError(TOO_LONG), waitMs);
    return () => clearTimeout(timer);
  }, [error, waitMs, url]);
  const toAccount = () => router.replace('/account');
  return (
    <Screen title="Signing in" testID="auth-screen">
      {error ? (
        <Note
          testID="auth-error"
          title="Couldn’t sign you in"
          body={`${error} Sign-in links work once and expire after an hour; ask for a new one on the Account tab.`}
          action={{ label: 'Go to Account', onPress: toAccount }}
        />
      ) : (
        <>
          <ActivityIndicator
            style={styles.spin}
            color={t.muted}
            accessibilityLabel="Signing you in"
          />
          <Text style={[styles.wait, { color: t.muted }]} testID="auth-waiting">
            Signing you in…
          </Text>
          <Button label="Cancel" onPress={toAccount} testID="auth-cancel" />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  spin: { marginTop: 40 },
  wait: {
    fontFamily: FONT.body,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
});
