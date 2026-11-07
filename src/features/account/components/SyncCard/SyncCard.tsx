import { BOARD_KEY, readBoard } from '@noodle/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { appStorage, useStoredRaw, type CachedStorage } from '@/shared/storage';
import { FONT, useTokens } from '@/shared/theme';
import { Button, Chevron, TAP, TextField } from '@/shared/ui';

import { authClient } from '../../api/authClient';
import { AccountError, sayAccountError } from '../../hooks/authErrors';
import { tapId } from '../../hooks/tap';
import { lastSync, sendLink, signOut, syncNow, useAccount } from '../../hooks/useAccount';
import { LAST_SYNC_KEY } from '../../hooks/syncEngine';
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

/** The sync row's status: ago() without its leading "Synced " ("Just now", "54 min ago"). */
export function agoShort(at: number | null, now = Date.now()): string {
  const s = ago(at, now).replace(/^Synced /, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A circular arrow (refresh), drawn from views: the app has no icon font. */
function RefreshGlyph({ color }: { color: string }) {
  return (
    <View style={styles.glyph} accessible={false} importantForAccessibility="no">
      <View
        style={[
          styles.arc,
          { borderColor: color, borderTopColor: 'transparent', transform: [{ rotate: '45deg' }] },
        ]}
      />
      <View style={[styles.head, { borderBottomColor: color }]} />
    </View>
  );
}

/**
 * Optional sign-in, so streaks and leagues follow the player to another phone or the
 * website (tracker AF-018, AF-003, AF-004). Signed out it offers the email link. Signed in
 * (Alec, 7 Nov 2026) it reads like the page's other cards, label on the left and the action
 * on the right: the avatar and email; Sync with when it last ran and a refresh button; then
 * Sign out with a chevron.
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
  // Read through the store's subscriptions, so the card follows a sync as it finishes.
  useStoredRaw(LAST_SYNC_KEY, store);
  useStoredRaw(BOARD_KEY, store);
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
  const right =
    busy === 'sync' ? (
      <>
        <ActivityIndicator color={t.muted} size="small" />
        <Text style={[styles.small, { color: t.faint }]} testID="sync-progress">
          Syncing…
        </Text>
      </>
    ) : msg || waiting ? null : (
      <>
        <Text style={[styles.small, { color: t.faint }]} testID="sync-last">
          {agoShort(lastSync(store))}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sync now"
          hitSlop={6}
          onPress={() => void doSync()}
          testID="sync-now"
          style={({ pressed }) => [
            styles.round,
            { borderColor: t.hair, backgroundColor: pressed ? t.accentSoft : 'transparent' },
          ]}>
          <RefreshGlyph color={t.ink} />
        </Pressable>
      </>
    );
  const note =
    busy === 'sync' ? null : msg ? (
      <View style={styles.note}>
        <Text
          style={[styles.small, { color: t.bad }]}
          testID="sync-msg"
          accessibilityLiveRegion="polite">
          {msg}
        </Text>
        <Button variant="text" label="Try again" onPress={() => doSync()} testID="sync-now" />
      </View>
    ) : waiting ? (
      <View style={styles.note}>
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
      </View>
    ) : null;

  return (
    <View
      style={[styles.list, { backgroundColor: t.paper, borderColor: t.hair }]}
      testID="sync-card">
      <View style={styles.me}>
        <View
          style={[styles.avatar, { backgroundColor: t.accentSoft }]}
          accessible={false}
          importantForAccessibility="no"
          testID="sync-avatar">
          <Text maxFontSizeMultiplier={1} style={[styles.avatarText, { color: t.accent }]}>
            {(account.email[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <Text
          style={[styles.email, { color: t.ink }]}
          numberOfLines={1}
          ellipsizeMode="tail"
          testID="sync-signed-in"
          selectable>
          {account.email}
        </Text>
      </View>
      <View style={[styles.rule, { borderTopColor: t.hair }]} testID="sync-line">
        <View style={styles.item}>
          <Text style={[styles.label, { color: t.ink }]}>Sync</Text>
          <View style={styles.right}>{right}</View>
        </View>
        {note}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityState={{ disabled: busy === 'sync' || busy === 'signout' }}
        disabled={busy === 'sync' || busy === 'signout'}
        onPress={() => void act('signout', () => signOut(client))}
        testID="sync-signout"
        style={({ pressed }) => [
          styles.item,
          styles.rule,
          styles.press,
          { borderTopColor: t.hair },
          pressed ? { backgroundColor: t.accentSoft } : null,
        ]}>
        <Text style={[styles.label, { color: t.ink }]}>Sign out</Text>
        {busy === 'signout' ? (
          <ActivityIndicator color={t.muted} size="small" />
        ) : (
          <Chevron color={t.faint} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderRadius: 12, gap: 8 },
  h2: { fontFamily: FONT.displayHeavy, fontSize: 19 },
  p: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19, flexShrink: 1 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  // Signed in: the page's list-card shape (AccountParts Card and Row).
  list: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16 },
  me: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: FONT.displayHeavy, fontSize: 19 },
  email: { flex: 1, minWidth: 0, fontFamily: FONT.bodySemi, fontSize: 16, lineHeight: 21 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TAP + 4 },
  // The whole Sign out row is the button, its press tint running to the card's edges.
  press: { marginHorizontal: -16, paddingHorizontal: 16 },
  label: { flex: 1, fontFamily: FONT.bodySemi, fontSize: 15.5, lineHeight: 21 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingBottom: 8 },
  // A 36 pt round button, 48 to tap with its slop.
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { width: 16, height: 16 },
  arc: { position: 'absolute', inset: 1, borderWidth: 2, borderRadius: 8 },
  head: {
    position: 'absolute',
    top: -1,
    right: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
});
