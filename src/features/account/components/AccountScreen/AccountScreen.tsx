import type { SupabaseClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { buildLine } from '@/shared/build';
import { appStorage, type CachedStorage } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { Button, Screen } from '@/shared/ui';

import { authClient } from '../../api/authClient';
import { sayAccountError } from '../../hooks/authErrors';
import { tapId } from '../../hooks/tap';
import { deleteSynced, useAccount } from '../../hooks/useAccount';
import { Card, Row, Section } from '../AccountParts/AccountParts';
import { SettingsCard } from '../SettingsCard/SettingsCard';
import { SyncCard } from '../SyncCard/SyncCard';

/** Where the website's privacy page sends requests to delete an account (privacy.html › contact). */
export const CONTACT_EMAIL = 'contact@dailynoodle.co.uk';

/** The email that asks for the sign-in account and everything kept against it to be deleted. */
export function deletionRequestUrl(email: string | null): string {
  const subject = 'Delete my Daily Noodle account';
  const body = [
    'Please delete my Daily Noodle account: my sign-in email and everything kept against it.',
    '',
    `Sign-in email: ${email ?? '(the address I sign in with)'}`,
  ].join('\n');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Account (tracker AF-018): sign-in or its status, the app-wide settings, joining a league
 * with a code, privacy and data, and the version. Top to bottom as the design.
 */
export function AccountScreen({
  client = authClient(),
  store = appStorage,
}: {
  client?: SupabaseClient | null;
  store?: CachedStorage;
}) {
  const t = useTokens();
  const account = useAccount(client);
  const [view, setView] = useState<'home' | 'delete'>('home');
  const [notice, setNotice] = useState<string | null>(null);
  const [mailFailed, setMailFailed] = useState(false);
  const signedIn = account.kind === 'signed-in';
  const syncOn = account.kind !== 'off';

  if (view === 'delete' && signedIn)
    return (
      <DeleteDataView
        email={account.email}
        client={client}
        onCancel={() => setView('home')}
        onDeleted={() => {
          setNotice('Your saved copy was deleted. This phone keeps its results.');
          setView('home');
        }}
      />
    );

  const requestDeletion = () => {
    setMailFailed(false);
    Linking.openURL(deletionRequestUrl(signedIn ? account.email : null)).catch(() =>
      setMailFailed(true),
    );
  };

  return (
    <Screen title="Account" testID="account-screen">
      <SyncCard client={client} store={store} />

      <Section label="Settings">
        <SettingsCard store={store} />
      </Section>

      <Section label="Leagues">
        <Card testID="account-leagues">
          <View style={styles.cardBody}>
            <Text accessibilityRole="header" style={[styles.h3, { color: t.ink }]}>
              Join a league
            </Text>
            <Text style={[styles.p, { color: t.muted }]}>
              {signedIn
                ? 'Got an invite code and PIN? Join here.'
                : syncOn
                  ? 'In a league already? Sign in above with the same email, or join with your league’s code and PIN.'
                  : 'In a league already? Join with your league’s code and PIN.'}
            </Text>
            <Button
              variant="tonal"
              label="Join with a code"
              testID="account-claim"
              // A fresh `n` each tap, so Leagues opens the form again after its Back.
              onPress={() =>
                router.navigate({ pathname: '/leagues', params: { go: 'claim', n: tapId() } })
              }
            />
          </View>
        </Card>
      </Section>

      <Section label="Privacy & data">
        {notice ? (
          <Text
            style={[styles.p, { color: t.accent }]}
            testID="account-notice"
            accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
        <Card testID="account-privacy-card">
          <Row
            first
            role="link"
            label="Privacy: what’s recorded and how to change it"
            testID="account-privacy"
            onPress={() => router.navigate('/privacy')}
          />
          {signedIn ? (
            <Row
              label="Delete my saved data"
              sub="The copy kept for your email. This phone keeps its results."
              testID="account-delete"
              onPress={() => (setNotice(null), setView('delete'))}
            />
          ) : null}
          {syncOn ? (
            <Row
              role="link"
              label="Request account deletion"
              sub="Deletes your sign-in email as well as your saved data. Opens an email to us."
              testID="account-request-deletion"
              onPress={requestDeletion}
            />
          ) : null}
        </Card>
        {mailFailed ? (
          <Text style={[styles.small, { color: t.ink }]} testID="account-mail-failed" selectable>
            No email app opened. Email {CONTACT_EMAIL} from the address you sign in with, and ask
            for your account to be deleted.
          </Text>
        ) : null}
      </Section>

      <Text style={[styles.build, { color: t.faint }]} testID="account-build" selectable>
        {buildLine()}
      </Text>
    </Screen>
  );
}

/**
 * The confirm screen for "Delete my saved data": what goes, what stays, and a red Delete
 * (never the filled accent button).
 */
function DeleteDataView({
  email,
  client,
  onCancel,
  onDeleted,
}: {
  email: string;
  client: SupabaseClient | null;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const t = useTokens();
  const [err, setErr] = useState<string | null>(null);
  const del = async () => {
    setErr(null);
    try {
      await deleteSynced(client);
      onDeleted();
    } catch (e) {
      setErr(sayAccountError(e));
    }
  };
  return (
    <Screen title="Account" testID="account-delete-screen">
      <Card>
        <View style={styles.cardBody}>
          <Text accessibilityRole="header" style={[styles.h2, { color: t.ink }]}>
            Delete your saved data?
          </Text>
          <Text style={[styles.h4, { color: t.ink }]}>Deleted</Text>
          <Text style={[styles.p, { color: t.muted }]} testID="delete-goes">
            The copy of your results, streaks and leagues kept for {email}, so another phone or the
            website can have them. You’re signed out on this phone.
          </Text>
          <Text style={[styles.h4, { color: t.ink }]}>Stays</Text>
          <Text style={[styles.p, { color: t.muted }]} testID="delete-stays">
            Everything on this phone: your results, streaks and leagues here. Your sign-in email
            stays too; to remove it, use Request account deletion.
          </Text>
          {err ? (
            <Text
              style={[styles.small, { color: t.bad }]}
              testID="delete-error"
              accessibilityLiveRegion="polite">
              {err}
            </Text>
          ) : null}
          <View style={styles.acts}>
            <Button
              variant="tonal"
              destructive
              label="Delete"
              onPress={del}
              testID="delete-confirm"
            />
            <Button variant="text" label="Cancel" onPress={onCancel} testID="delete-cancel" />
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardBody: { paddingVertical: 12, gap: 8 },
  h2: { fontFamily: FONT.displayHeavy, fontSize: 21, lineHeight: 26 },
  h3: { fontFamily: FONT.displayHeavy, fontSize: 18 },
  h4: { fontFamily: FONT.bodyBold, fontSize: 14, marginTop: 4 },
  p: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19 },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  build: { fontFamily: FONT.body, marginTop: 24, fontSize: 13 },
});
