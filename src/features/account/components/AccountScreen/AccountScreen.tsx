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
import { deleteSynced, useAccount } from '../../hooks/useAccount';
import { Card, Row, Section } from '../AccountParts/AccountParts';
import { SettingsCard } from '../SettingsCard/SettingsCard';
import { SyncCard } from '../SyncCard/SyncCard';

/** Where the website's privacy page sends requests to delete an account (privacy.html › contact). */
export const CONTACT_EMAIL = 'contact@dailynoodle.co.uk';

/** The app's third-party notices: every open-source package, font and word list it carries
 *  with its licence (scripts/make-notices.js; copyright audit, 8 Nov 2026). */
export const NOTICES_URL =
  'https://github.com/alecldarlow-cell/Daily-noodle-app/blob/main/THIRD-PARTY-NOTICES.md';

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
 * Account (tracker AF-018; tidied 7 Nov 2026): sign-in or its status, the app-wide settings,
 * then one Help & privacy card (how to play, privacy, contact, deleting your data) and the
 * version. Joining a league lives on Leagues only.
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

  if (view === 'delete' && syncOn)
    return (
      <DeleteDataView
        email={signedIn ? account.email : null}
        client={client}
        onCancel={() => setView('home')}
        onDeleted={() => {
          setNotice('Your saved copy was deleted. This phone keeps its results.');
          setView('home');
        }}
      />
    );

  const contact = () => {
    setMailFailed(false);
    Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => setMailFailed(true));
  };

  return (
    <Screen title="Account" testID="account-screen">
      {syncOn ? (
        <Section label="Your account">
          <SyncCard client={client} store={store} />
        </Section>
      ) : null}

      <Section label="Settings">
        <SettingsCard store={store} />
      </Section>

      <Section label="Help & privacy">
        {notice ? (
          <Text
            style={[styles.p, { color: t.accent }]}
            testID="account-notice"
            accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
        <Card testID="account-help-card">
          <Row
            first
            role="link"
            label="How to play"
            testID="account-how-to-play"
            onPress={() => router.navigate('/how-to-play')}
          />
          <Row
            role="link"
            label="Privacy"
            testID="account-privacy"
            onPress={() => router.navigate('/privacy')}
          />
          <Row role="link" label="Contact us" testID="account-contact" onPress={contact} />
          <Row
            role="link"
            label="Open-source licences"
            testID="account-licences"
            onPress={() => void Linking.openURL(NOTICES_URL).catch(() => undefined)}
          />
          {syncOn ? (
            <Row
              label="Delete my data"
              testID="account-delete"
              onPress={() => (setNotice(null), setMailFailed(false), setView('delete'))}
            />
          ) : null}
        </Card>
        {mailFailed ? (
          <Text style={[styles.small, { color: t.ink }]} testID="account-mail-failed" selectable>
            No email app opened. Write to us at {CONTACT_EMAIL}.
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
 * Delete my data: the two kinds of deleting, each saying what it does. Signed in, the saved
 * copy can be deleted here (a red Delete, never the filled accent button, AF-019); the
 * account itself, sign-in email included, is asked for by email (G2).
 */
function DeleteDataView({
  email,
  client,
  onCancel,
  onDeleted,
}: {
  email: string | null;
  client: SupabaseClient | null;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const t = useTokens();
  const [err, setErr] = useState<string | null>(null);
  const [mailFailed, setMailFailed] = useState(false);
  const del = async () => {
    setErr(null);
    try {
      await deleteSynced(client);
      onDeleted();
    } catch (e) {
      setErr(sayAccountError(e));
    }
  };
  const requestDeletion = () => {
    setMailFailed(false);
    Linking.openURL(deletionRequestUrl(email)).catch(() => setMailFailed(true));
  };
  return (
    <Screen title="Account" testID="account-delete-screen">
      <Text accessibilityRole="header" style={[styles.h2, { color: t.ink }]}>
        Delete my data
      </Text>
      {email ? (
        <Section label="Your saved copy">
          <Card>
            <View style={styles.cardBody}>
              <Text accessibilityRole="header" style={[styles.h3, { color: t.ink }]}>
                Delete your saved data?
              </Text>
              <Text style={[styles.h4, { color: t.ink }]}>Deleted</Text>
              <Text style={[styles.p, { color: t.muted }]} testID="delete-goes">
                The copy of your results, streaks and leagues kept for {email}, so another phone or
                the website can have them. You’re signed out on this phone.
              </Text>
              <Text style={[styles.h4, { color: t.ink }]}>Stays</Text>
              <Text style={[styles.p, { color: t.muted }]} testID="delete-stays">
                Everything on this phone: your results, streaks and leagues here. Your sign-in email
                stays too; to remove it, delete your account below.
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
              </View>
            </View>
          </Card>
        </Section>
      ) : null}
      <Section label="Your account">
        <Card>
          <View style={styles.cardBody}>
            <Text accessibilityRole="header" style={[styles.h3, { color: t.ink }]}>
              Delete your account
            </Text>
            <Text style={[styles.p, { color: t.muted }]} testID="delete-account-says">
              Removes your sign-in email as well as your saved data. This opens an email to us; we
              delete it and reply to confirm.
            </Text>
            <View style={styles.acts}>
              <Button
                variant="tonal"
                label="Request account deletion"
                onPress={requestDeletion}
                testID="account-request-deletion"
              />
            </View>
            {mailFailed ? (
              <Text
                style={[styles.small, { color: t.ink }]}
                testID="account-mail-failed"
                selectable>
                No email app opened. Email {CONTACT_EMAIL} from the address you sign in with, and
                ask for your account to be deleted.
              </Text>
            ) : null}
          </View>
        </Card>
      </Section>
      <View style={styles.acts}>
        <Button variant="text" label="Cancel" onPress={onCancel} testID="delete-cancel" />
      </View>
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
