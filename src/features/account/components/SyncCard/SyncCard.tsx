import { readBoard } from '@noodle/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { appStorage, type CachedStorage } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { Button, TextField } from '@/shared/ui';

import { authClient } from '../../api/authClient';
import { AccountError, sayAccountError } from '../../hooks/authErrors';
import { tapId } from '../../hooks/tap';
import { lastSync, sendLink, signOut, syncNow, useAccount } from '../../hooks/useAccount';
import { emailSchema } from '../../schemas/email';

/** Seconds before "Send again" can send another link (Supabase limits sign-in emails). */
export const RESEND_AFTER_S = 60;

export function ago(at: number | null, now = Date.now()): string {
  if (!at) return 'Not synced yet';
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return 'Synced just now';
  if (m < 60) return `Synced ${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `Synced ${h} h ago` : `Synced ${Math.round(h / 24)} d ago`;
}

/** A green disc with a white tick: the signed-in state's mark, drawn from views. */
function Tick() {
  const t = useTokens();
  return (
    <View
      style={[styles.disc, { backgroundColor: t.accent }]}
      accessible={false}
      importantForAccessibility="no"
      testID="sync-tick">
      <View style={[styles.tick, { borderColor: t.onAccent }]} />
    </View>
  );
}

/**
 * Optional sign-in, so streaks and leagues follow the player to another phone or the
 * website (tracker AF-018, AF-003, AF-004). Signed out it offers the email link; signed in
 * it is a status: a tick and "Signed in", the email, and one quiet line for the sync.
 * Hidden when the build has sync off.
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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<'send' | 'sync' | 'signout' | null>(null);
  const [sent, setSent] = useState<{ to: string; at: number } | null>(null);
  const [now, setNow] = useState(Date.now);
  const [, setTick] = useState(0);

  // While a link is out, count down to when another may be sent.
  const wait = sent ? Math.max(0, RESEND_AFTER_S - Math.floor((now - sent.at) / 1000)) : 0;
  useEffect(() => {
    if (!sent || wait <= 0) return;
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [sent, wait]);
  // Once signed in, a later sign-out starts from the email form again.
  const [seen, setSeen] = useState(account.kind);
  if (seen !== account.kind) {
    setSeen(account.kind);
    if (account.kind === 'signed-in') setSent(null);
  }

  if (account.kind === 'off') return null;

  // A sync brought the account's league player, and this phone plays as someone else:
  // the choice waits on Leagues (its "Which leagues should this app use?" card).
  const waiting = account.kind === 'signed-in' && !!readBoard(store).pend;

  const act = async (kind: typeof busy, fn: () => Promise<unknown>) => {
    setBusy(kind);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(sayAccountError(e));
    } finally {
      setBusy(null);
      setTick((n) => n + 1);
    }
  };

  const send = (to?: string) =>
    act('send', async () => {
      const valid =
        to ??
        (await emailSchema.validate(email).catch((e: Error) => {
          throw new AccountError(e.message);
        }));
      await sendLink(valid, client);
      const at = Date.now();
      setNow(at);
      setSent({ to: valid, at });
    });

  const errorLine = msg ? (
    <Text
      style={[styles.small, { color: t.bad }]}
      testID="sync-msg"
      accessibilityLiveRegion="polite">
      {msg}
    </Text>
  ) : null;

  if (account.kind === 'loading')
    return (
      <View
        style={[styles.card, { backgroundColor: t.paper, borderColor: t.hair }]}
        testID="sync-card">
        <ActivityIndicator color={t.muted} />
      </View>
    );

  if (account.kind === 'signed-out')
    return (
      <View
        style={[styles.card, { backgroundColor: t.paper, borderColor: t.accent }]}
        testID="sync-card">
        {!sent ? (
          <>
            <Text accessibilityRole="header" style={[styles.h2, { color: t.ink }]}>
              Sign in or create an account
            </Text>
            <Text style={[styles.p, { color: t.muted }]}>
              Keep your streaks and leagues on every phone and the website. Free, no password: we
              email you a link.
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
            {errorLine}
            <Button
              variant="filled"
              label="Email me a sign-in link"
              onPress={() => send()}
              loading={busy === 'send'}
              testID="sync-send"
            />
          </>
        ) : (
          <>
            <Text accessibilityRole="header" style={[styles.h2, { color: t.ink }]}>
              Check your email
            </Text>
            <Text style={[styles.p, { color: t.ink }]} testID="sync-sent">
              We’ve sent a link to {sent.to}. Open it on this phone.
            </Text>
            {errorLine}
            <View style={styles.row}>
              <Button
                variant="tonal"
                label={wait > 0 ? `Send again in ${wait} s` : 'Send again'}
                disabled={wait > 0}
                loading={busy === 'send'}
                onPress={() => send(sent.to)}
                testID="sync-resend"
              />
              <Button
                variant="text"
                label="Use a different email"
                onPress={() => (setSent(null), setMsg(null))}
                testID="sync-different"
              />
            </View>
          </>
        )}
      </View>
    );

  // Signed in: a status, not a form.
  const doSync = () => act('sync', () => syncNow(store, client));
  const line =
    busy === 'sync' ? null : msg ? (
      <>
        <Text
          style={[styles.small, { color: t.bad }]}
          testID="sync-msg"
          accessibilityLiveRegion="polite">
          {msg}
        </Text>
        <Button variant="text" label="Try again" onPress={() => doSync()} testID="sync-now" />
      </>
    ) : waiting ? (
      <>
        <Text style={[styles.small, { color: t.ink }]} testID="sync-waiting">
          Your account plays in other leagues than this phone.
        </Text>
        <Button
          variant="text"
          label="Choose on Leagues"
          testID="sync-choose"
          onPress={() =>
            router.navigate({ pathname: '/leagues', params: { go: 'home', n: tapId() } })
          }
        />
      </>
    ) : (
      <>
        <Text style={[styles.small, { color: t.faint }]} testID="sync-last">
          {ago(lastSync(store))} ·
        </Text>
        <Button variant="text" label="Sync now" onPress={() => doSync()} testID="sync-now" />
      </>
    );

  return (
    <View
      style={[styles.card, { backgroundColor: t.paper, borderColor: t.hair }]}
      testID="sync-card">
      <View style={styles.status}>
        <Tick />
        <Text accessibilityRole="header" style={[styles.h2, { color: t.ink }]}>
          Signed in
        </Text>
      </View>
      <Text style={[styles.p, { color: t.ink }]} testID="sync-signed-in" selectable>
        {account.email}
      </Text>
      <View style={styles.line} testID="sync-line">
        {busy === 'sync' ? (
          <>
            <ActivityIndicator color={t.muted} size="small" />
            <Text style={[styles.small, { color: t.faint }]} testID="sync-progress">
              Syncing…
            </Text>
          </>
        ) : (
          line
        )}
      </View>
      <Button
        variant="tonal"
        label="Sign out"
        onPress={() => act('signout', () => signOut(client))}
        loading={busy === 'signout'}
        disabled={busy === 'sync'}
        testID="sync-signout"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderRadius: 12, gap: 8 },
  h2: { fontFamily: FONT.displayHeavy, fontSize: 19 },
  p: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19, flexShrink: 1 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 2,
    minHeight: 48,
  },
  disc: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tick: {
    width: 7,
    height: 12,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginTop: -3,
  },
});
