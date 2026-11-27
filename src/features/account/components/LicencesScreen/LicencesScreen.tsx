import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';

import notices from '../../notices.json';
import { Card, Row } from '../AccountParts/AccountParts';

/** The full notices, licence texts and all (scripts/make-notices.js; copyright audit, 8 Nov 2026). */
export const NOTICES_URL =
  'https://github.com/alecldarlow-cell/Daily-noodle-app/blob/main/THIRD-PARTY-NOTICES.md';

type Pkg = { name: string; version: string; license: string };

/** Every open-source package the app is built from, as make-notices.js lists it. */
export const PACKAGES: readonly Pkg[] = notices as Pkg[];

/** The fonts, word lists and maps the app carries, in the words of THIRD-PARTY-NOTICES.md. */
export const CREDITS: readonly { title: string; text: string }[] = [
  {
    title: 'Fonts',
    text: 'Archivo, Inter and Instrument Serif, under the SIL Open Font License 1.1.',
  },
  {
    title: 'Word lists',
    text: 'Some word lists used by Tangle, Doku and Tumbler were built with SCOWL and the en-GB Hunspell dictionary derived from it, filtered by frequency with wordfreq. SCOWL: Copyright 2000-2018 by Kevin Atkinson.',
  },
  {
    title: 'Maps',
    text: 'Country outlines in Borders: Natural Earth (naturalearthdata.com), public domain.',
  },
];

/**
 * Open-source licences, inside the app (#192, review of 27 Nov 2026): what the app carries and
 * every package with its licence, rather than a jump out to GitHub. The full licence texts are
 * one tap away, at the end.
 */
export function LicencesScreen() {
  const t = useTokens();
  return (
    <FlatList
      testID="licences-screen"
      data={PACKAGES}
      keyExtractor={(p) => `${p.name}@${p.version}`}
      initialNumToRender={30}
      contentContainerStyle={styles.content}
      style={{ backgroundColor: t.canvas }}
      ListHeaderComponent={
        <View>
          <Text style={[styles.p, { color: t.muted }]}>
            The Daily Noodle app and its puzzles are © The Daily Noodle. It is built with the
            material below, each used under its own licence.
          </Text>
          {CREDITS.map((c) => (
            <View key={c.title} style={styles.credit}>
              <Text accessibilityRole="header" style={[styles.h3, { color: t.ink }]}>
                {c.title}
              </Text>
              <Text style={[styles.p, { color: t.muted }]}>{c.text}</Text>
            </View>
          ))}
          <Text accessibilityRole="header" style={[styles.h3, styles.pkgHead, { color: t.ink }]}>
            Open-source packages ({PACKAGES.length})
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.pkg, { borderTopColor: t.hair }]}>
          <Text style={[styles.name, { color: t.ink }]} numberOfLines={2}>
            {item.name} <Text style={{ color: t.faint }}>{item.version}</Text>
          </Text>
          <Text style={[styles.lic, { color: t.muted }]}>{item.license}</Text>
        </View>
      )}
      ListFooterComponent={
        <View style={styles.foot}>
          <Card testID="licences-full-card">
            <Row
              first
              role="link"
              label="Full licence texts"
              sub="Opens on GitHub"
              testID="licences-full"
              onPress={() => void Linking.openURL(NOTICES_URL).catch(() => undefined)}
            />
          </Card>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  credit: { marginTop: 16, gap: 4 },
  h3: { fontFamily: FONT.displayHeavy, fontSize: 17 },
  pkgHead: { marginTop: 24, marginBottom: 8 },
  p: { fontFamily: FONT.body, fontSize: 15, lineHeight: 22 },
  pkg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, fontFamily: FONT.body, fontSize: 14 },
  lic: { fontFamily: FONT.body, fontSize: 13 },
  foot: { marginTop: 20 },
});
