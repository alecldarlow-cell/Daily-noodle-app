import type { SupabaseClient } from '@supabase/supabase-js';
import { useURL } from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useTokens } from '@/shared/theme';
import { Note, Screen } from '@/shared/ui';

import { authClient } from '../../api/authClient';
import { completeLink } from '../../hooks/useAccount';

/** Where the email's sign-in link lands (dailynoodle://auth): finish signing in, go to Account. */
export function AuthLinkScreen({ client = authClient() }: { client?: SupabaseClient | null }) {
  const t = useTokens();
  const url = useURL();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    void completeLink(url, client).then((e) => {
      if (e) setError(e);
      else router.replace('/account');
    });
  }, [url, client]);
  return (
    <Screen title="Signing in" testID="auth-screen">
      {error ? (
        <Note
          testID="auth-error"
          title="Couldn’t sign you in"
          body={`${error} Sign-in links work once and expire after an hour; ask for a new one on the Account tab.`}
          action={{ label: 'Go to Account', onPress: () => router.replace('/account') }}
        />
      ) : (
        <ActivityIndicator style={styles.spin} color={t.muted} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ spin: { marginTop: 40 } });
