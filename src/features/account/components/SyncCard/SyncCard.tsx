import { readBoard } from '@noodle/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { appStorage, type CachedStorage } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { Button, TextField } from '@/shared/ui';

import { authClient } from '../../api/authClient';
import { AccountError, sayAccountError } from '../../hooks/authErrors';
import { tapId } from '../../hooks/tap';
import {
  deleteSynced,
  lastSync,
  sendLink,
  signOut,
  syncNow,
  useAccount,
} from '../../hooks/useAccount';
import { emailSchema } from '../../schemas/email';

function ago(at: number | null, now = Date.now()): string {
  if (!at) return 'Not synced yet';
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return 'Synced just now';
  if (m < 60) return `Synced ${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `Synced ${h} h ago` : `Synced ${Math.round(h / 24)} d ago`;
}

/**
 * Optional sign-in, so streaks and results follow the player to another phone or the
 * website. Hidden when the build has sync off. Never a nudge: one quiet card.
 */
export function SyncCard({
  client = authClient(),
  store = appStorage,
}: {
  client?: SupabaseClient | null;
  store?: CachedStorage;
}) {
  const t = useTokens();
  const account = useAccount(client);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [, setTick] = useState(0);

  if (account.kind === 'off') return null;

  // A sync brought the account's league player, and this phone plays as someone else:
  // the choice waits on Leagues (its "Which leagues should this app use?" card).
  const waiting = account.kind === 'signed-in' && !!readBoard(store).pend;

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg({ text: done });
    } catch (e) {
      setMsg({ text: sayAccountError(e), bad: true });
    } finally {
      setBusy(false);
      setTick((n) => n + 1);
    }
  };

  const send = () =>
    act(async () => {
      const valid = await emailSchema.validate(email).catch((e: Error) => {
        throw new AccountError(e.message);
      });
      await sendLink(valid, client);
      setSentTo(valid);
    });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.paper,
          borderColor: account.kind === 'signed-in' ? t.hair : t.accent,
        },
      ]}
      testID="sync-card">
      <Text accessibilityRole="header" style={[styles.h2, { color: t.ink }]}>
        {account.kind === 'signed-in' ? 'Your account' : 'Create a free account'}
      </Text>
      {account.kind === 'loading' ? <ActivityIndicator color={t.muted} /> : null}

      {account.kind === 'signed-out' && !sentTo ? (
        <>
          <Text style={[styles.p, { color: t.muted }]}>
            Keep your results and streaks on every phone, browser and the website. Optional and
            free. Already have an account? Use the same email to sign in. No password: we email you
            a link.
          </Text>
          <TextField
            label="Your email"
            testID="sync-email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
            returnKeyType="send"
            onSubmitEditing={() => void send()}
          />
          <Button
            variant="filled"
            label="Email me a sign-in link"
            onPress={() => void send()}
            disabled={busy}
            testID="sync-send"
          />
        </>
      ) : null}

      {account.kind === 'signed-out' && sentTo ? (
        <>
          <Text style={[styles.p, { color: t.ink }]} testID="sync-sent">
            Check your email: we sent a sign-in link to {sentTo}. Open it on this phone.
          </Text>
          <Button label="Use a different email" onPress={() => setSentTo(null)} />
        </>
      ) : null}

      {account.kind === 'signed-in' ? (
        <>
          <Text style={[styles.p, { color: t.ink }]} testID="sync-signed-in">
            Signed in as {account.email}
          </Text>
          <Text style={[styles.small, { color: t.faint }]} testID="sync-last">
            {ago(lastSync(store))}
          </Text>
          <View style={styles.row}>
            <Button
              variant="filled"
              label="Sync now"
              onPress={() =>
                void act(async () => {
                  await syncNow(store, client);
                  // Up to date, unless the sync left a choice waiting on Leagues.
                  if (!readBoard(store).pend) setMsg({ text: 'Up to date.' });
                })
              }
              disabled={busy}
              testID="sync-now"
            />
            <Button
              label="Sign out"
              onPress={() => void act(() => signOut(client))}
              disabled={busy}
              testID="sync-signout"
            />
          </View>
          {waiting ? (
            <View style={[styles.waiting, { backgroundColor: t.accentSoft }]} testID="sync-waiting">
              <Text style={[styles.p, { color: t.ink }]}>
                Your account plays in other leagues than this phone. Choose which to use on Leagues.
              </Text>
              <Button
                variant="filled"
                label="Choose on Leagues"
                testID="sync-choose"
                onPress={() =>
                  router.navigate({
                    pathname: '/leagues',
                    params: { go: 'home', n: tapId() },
                  })
                }
              />
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            testID="sync-delete"
            disabled={busy}
            style={styles.linkHit}
            onPress={() =>
              Alert.alert(
                'Delete your synced copy?',
                'Your results stay on this phone. The copy kept for your email is deleted and you’re signed out.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => void act(() => deleteSynced(client), 'Deleted.'),
                  },
                ],
              )
            }>
            <Text style={[styles.link, { color: t.bad }]}>Delete my synced copy</Text>
          </Pressable>
        </>
      ) : null}

      {busy ? <ActivityIndicator color={t.muted} /> : null}
      {msg ? (
        <Text style={[styles.small, { color: msg.bad ? t.bad : t.muted }]} testID="sync-msg">
          {msg.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 16, borderWidth: 1, borderRadius: 12, gap: 10 },
  h2: { fontFamily: FONT.displayHeavy, fontSize: 19 },
  p: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  waiting: { padding: 12, borderRadius: 10, gap: 8 },
  linkHit: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: FONT.bodySemi, fontSize: 14 },
});
