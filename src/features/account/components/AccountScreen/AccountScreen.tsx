import type { SupabaseClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { buildLine } from '@/shared/build';
import { appStorage, type CachedStorage } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { appRecorder } from '@/shared/track';
import { Button, Screen } from '@/shared/ui';

import { authClient } from '../../api/authClient';
import { sayAccountError } from '../../hooks/authErrors';
import { deleteSynced, useAccount } from '../../hooks/useAccount';
import { Card, Row, Section } from '../AccountParts/AccountParts';
import { SettingsCard } from '../SettingsCard/SettingsCard';
import { SyncCard } from '../SyncCard/SyncCard';

/** Where the website's privacy page sends requests to delete an account (privacy.html › contact). */
export const CONTACT_EMAIL = 'contact@dailynoodle.co.uk';

/** The app's Google Play listing: the Play Store app first, the web page if that won't open. */
export const PLAY_APP_URL = 'market://details?id=uk.co.dailynoodle.app';
export const PLAY_WEB_URL = 'https://play.google.com/store/apps/details?id=uk.co.dailynoodle.app';

/**
 * The App Store's id for Daily Noodle (#214): App Store Connect › App Information › Apple ID,
 * digits only. Empty until the app is on the App Store, and while it is, iPhones don't show
 * the Rate row. Filling it in is the only change the row needs.
 */
export const APP_STORE_ID = '';

/**
 * Where Rate Daily Noodle sends a player on this phone: the store app first, its web page if
 * that won't open. Null on an iPhone until there's an App Store id.
 */
export function ratingUrls(
  os: string = Platform.OS,
  appStoreId: string = APP_STORE_ID,
): [string, string] | null {
  if (os !== 'ios') return [PLAY_APP_URL, PLAY_WEB_URL];
  if (!/^\d+$/.test(appStoreId)) return null;
  const listing = `apps.apple.com/app/id${appStoreId}?action=write-review`;
  return [`itms-apps://${listing}`, `https://${listing}`];
}

/**
 * Rate Daily Noodle (Alec, 20 Nov 2026: no ratings yet, and Google rations the in-app sheet):
 * opens the store listing (on iPhone, straight to writing a review), recorded as an anonymous
 * `review_link`. The row passes `ratingUrls()`; without it, the Play listing.
 */
export function openRating(
  record = appRecorder.event,
  urls: [string, string] | null = [PLAY_APP_URL, PLAY_WEB_URL],
): void {
  if (!urls) return;
  try {
    record('review_link', { from: 'account' }, 'review');
  } catch {
    // Recording must never stop the link.
  }
  const [app, web] = urls;
  Linking.openURL(app)
    .catch(() => Linking.openURL(web))
    .catch(() => undefined);
}

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
  appStoreId = APP_STORE_ID,
}: {
  client?: SupabaseClient | null;
  store?: CachedStorage;
  /** Tests only: stands in for APP_STORE_ID. */
  appStoreId?: string;
}) {
  const t = useTokens();
  const account = useAccount(client);
  const [view, setView] = useState<'home' | 'delete'>('home');
  const [notice, setNotice] = useState<string | null>(null);
  const [mailFailed, setMailFailed] = useState(false);
  const signedIn = account.kind === 'signed-in';
  const rating = ratingUrls(Platform.OS, appStoreId);
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
          {rating ? (
            <Row
              role="link"
              label="Rate Daily Noodle"
              sub={`Tell other players what you think on ${Platform.OS === 'ios' ? 'the App Store' : 'Google Play'}`}
              testID="account-rate"
              onPress={() => openRating(undefined, rating)}
            />
          ) : null}
          <Row role="link" label="Contact us" testID="account-contact" onPress={contact} />
          <Row
            role="link"
            label="Open-source licences"
            testID="account-licences"
            onPress={() => router.navigate('/licences')}
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
  // A quiet footer (#192): small, centred, well clear of the last card.
  build: { fontFamily: FONT.body, marginTop: 40, fontSize: 12, textAlign: 'center' },
});
