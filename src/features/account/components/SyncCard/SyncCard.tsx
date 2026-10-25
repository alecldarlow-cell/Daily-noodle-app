import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { appStorage, type CachedStorage } from '@/shared/storage';
import { useTokens } from '@/shared/theme';

import { authClient } from '../../api/authClient';
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

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg({ text: done });
    } catch (e) {
      setMsg({
        text: e instanceof Error ? e.message : 'Something went wrong. Try again.',
        bad: true,
      });
    } finally {
      setBusy(false);
      setTick((n) => n + 1);
    }
  };

  const send = () =>
    act(async () => {
      const valid = await emailSchema.validate(email).catch((e: Error) => {
        throw new Error(e.message);
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
          <Text style={[styles.label, { color: t.ink }]} nativeID="sync-email-label">
            Your email
          </Text>
          <TextInput
            testID="sync-email"
            accessibilityLabel="Your email"
            accessibilityLabelledBy="sync-email-label"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={t.faint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            style={[
              styles.input,
              { color: t.ink, borderColor: t.muted, backgroundColor: t.canvas },
            ]}
          />
          <Button
            label="Email me a sign-in link"
            onPress={send}
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
          <Button label="Use a different email" quiet onPress={() => setSentTo(null)} />
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
              label="Sync now"
              onPress={() => act(() => syncNow(store, client), 'Up to date.')}
              disabled={busy}
              testID="sync-now"
            />
            <Button
              label="Sign out"
              quiet
              onPress={() => act(() => signOut(client))}
              disabled={busy}
              testID="sync-signout"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            testID="sync-delete"
            disabled={busy}
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

function Button({
  label,
  onPress,
  disabled,
  quiet,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  quiet?: boolean;
  testID?: string;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={[
        styles.btn,
        quiet ? { borderWidth: 1.5, borderColor: t.ink } : { backgroundColor: t.accent },
        disabled ? { opacity: 0.5 } : null,
      ]}>
      <Text style={[styles.btnText, { color: quiet ? t.ink : t.paper }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 16, borderWidth: 1, borderRadius: 12, gap: 10 },
  h2: { fontSize: 19, fontWeight: '800' },
  p: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: -4 },
  small: { fontSize: 13 },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  btn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { fontSize: 15, fontWeight: '700' },
  link: { fontSize: 14, fontWeight: '600', marginTop: 4 },
});
