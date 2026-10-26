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
  View,
} from 'react-native';

import { usePlayed } from '@/shared/played';
import { FONT, useTokens } from '@/shared/theme';
import { relDay, useLondonDay } from '@/shared/time';
import { Note, PuzzleRow, Screen } from '@/shared/ui';

import { groupArchive, type DoneFilter } from '../../hooks/groupArchive';
import { useArchive } from '../../hooks/useArchive';
import type { ArchiveItem } from '../../types';

const NO_ITEMS: ArchiveItem[] = [];

const STATUS: { id: DoneFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'Not done' },
  { id: 'done', label: 'Done' },
];

/** Every released puzzle, by month, newest first; filter by type, then by done or not. */
export function ArchiveScreen() {
  const t = useTokens();
  const day = useLondonDay();
  const q = useArchive();
  const [type, setType] = useState<PuzzleType | null>(null);
  const [status, setStatus] = useState<DoneFilter>('all');
  const items = q.data?.items ?? NO_ITEMS;
  const { byId } = usePlayed(items, day);
  // Finished, won or lost, counts as done; started but unfinished does not (as the cards' ✓).
  const finished = useMemo(() => new Set(Object.keys(byId).filter((id) => byId[id]?.done)), [byId]);
  const sections = useMemo(
    () => groupArchive(items, type, status, finished),
    [items, type, status, finished],
  );

  return (
    <Screen title="Archive" testID="archive-screen" scroll={false}>
      <ScrollView
        horizontal
        testID="archive-chips"
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
              style={[
                styles.chip,
                on
                  ? { borderColor: t.accent, backgroundColor: t.accentSoft }
                  : { borderColor: t.hair, backgroundColor: t.paper },
              ]}>
              <Text style={[styles.chipText, { color: on ? t.accent : t.muted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View
        style={[styles.seg, { borderColor: t.hair, backgroundColor: t.paper }]}
        testID="archive-status">
        {STATUS.map((s) => {
          const on = s.id === status;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Show ${s.label === 'All' ? 'all puzzles' : s.label.toLowerCase()}`}
              testID={`status-${s.id}`}
              onPress={() => setStatus(s.id)}
              style={[styles.segBtn, on && { backgroundColor: t.accentSoft }]}>
              <Text style={[styles.chipText, { color: on ? t.accent : t.muted }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
        <Note
          testID="archive-empty"
          title={
            status === 'done'
              ? 'Nothing finished here yet'
              : status === 'todo'
                ? 'All done here'
                : 'No puzzles match'
          }
        />
      ) : null}
      <SectionList
        sections={sections}
        keyExtractor={(it) => it.path}
        stickySectionHeadersEnabled={false}
        initialNumToRender={20}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={[styles.month, { color: t.faint }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <PuzzleRow
            testID={`archive-${item.id}`}
            type={item.type}
            title={item.headline}
            detail={item.standfirst}
            mask={item.mask}
            when={relDay(item.date, day)}
            read={item.read}
            played={byId[item.id] ?? null}
            onHowTo={() => router.push({ pathname: '/how-to-play', params: { type: item.type } })}
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
  // flexShrink 0: the list below takes the rest of the column, and on Android it otherwise
  // squeezed this row, clipping the chip labels (seen at 115% font size on a Pixel 10 Pro).
  chips: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  chipsRow: { gap: 6 },
  // a three-way switch under the type chips: All, Not done, Done
  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 2,
    marginBottom: 10,
  },
  segBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, minHeight: 32 },
  // front.css .chip: 12.5 px semibold, 6 × 12 padding, a hairline; the chosen one in the accent.
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: FONT.bodySemi, fontSize: 12.5 },
  spinner: { marginTop: 40 },
  // front.css .count: the list's small uppercase label.
  month: {
    fontFamily: FONT.bodySemi,
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 0,
  },
  footer: { height: 72 },
});
