import { PUZZLE_TYPES, TYPE_LABEL, type PuzzleType } from '@noodle/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { usePlayed } from '@/shared/played';
import { useTokens } from '@/shared/theme';
import { shortDate, useLondonDay } from '@/shared/time';
import { Note, PuzzleRow, Screen } from '@/shared/ui';

import { groupArchive } from '../../hooks/groupArchive';
import { useArchive } from '../../hooks/useArchive';
import type { ArchiveItem } from '../../types';

const NO_ITEMS: ArchiveItem[] = [];

/** Every released puzzle, by month, newest first; filter by type, find by number. */
export function ArchiveScreen() {
  const t = useTokens();
  const day = useLondonDay();
  const q = useArchive();
  const [type, setType] = useState<PuzzleType | null>(null);
  const [query, setQuery] = useState('');
  const items = q.data?.items ?? NO_ITEMS;
  const sections = useMemo(() => groupArchive(items, type, query), [items, type, query]);
  const { byId } = usePlayed(items, day);

  return (
    <Screen title="Archive" testID="archive-screen" scroll={false}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={styles.chipsRow}>
        {[null, ...PUZZLE_TYPES].map((ty) => {
          const on = ty === type;
          const label = ty ? TYPE_LABEL[ty] : 'All';
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setType(ty)}
              style={[styles.chip, { borderColor: t.hair, backgroundColor: on ? t.ink : t.paper }]}>
              <Text style={[styles.chipText, { color: on ? t.canvas : t.ink }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Find by number"
        placeholderTextColor={t.faint}
        keyboardType="number-pad"
        accessibilityLabel="Find by number"
        style={[styles.search, { color: t.ink, borderColor: t.hair, backgroundColor: t.paper }]}
      />
      {!q.data && q.isPending ? <ActivityIndicator style={styles.spinner} color={t.muted} /> : null}
      {!q.data && q.isError ? (
        <Note
          testID="archive-offline"
          title="No connection"
          body="The archive will load when you’re back online."
          action={{ label: 'Try again', onPress: () => void q.refetch() }}
        />
      ) : null}
      {q.data && sections.length === 0 ? (
        <Note testID="archive-empty" title="No puzzles match" />
      ) : null}
      <SectionList
        sections={sections}
        keyExtractor={(it) => it.path}
        stickySectionHeadersEnabled={false}
        initialNumToRender={20}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={[styles.month, { color: t.muted }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <PuzzleRow
            testID={`archive-${item.id}`}
            kicker={`${TYPE_LABEL[item.type]} · ${shortDate(item.date)}`}
            title={item.headline}
            detail={item.standfirst}
            played={byId[item.id] ?? null}
            onPress={() =>
              router.push({
                pathname: '/play/[type]/[file]',
                params: {
                  type: item.type,
                  file: item.path.replace(/^reports\//, '').replace(/\.html$/, ''),
                },
              })
            }
          />
        )}
        ListFooterComponent={<View style={styles.footer} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexGrow: 0, marginBottom: 10 },
  chipsRow: { gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 15, fontWeight: '700' },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  spinner: { marginTop: 40 },
  month: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },
  footer: { height: 72 },
});
