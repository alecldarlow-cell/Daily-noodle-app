import { PUZZLE_TYPES, TYPE_LABEL, type PuzzleType } from '@noodle/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { isConnectionError } from '@/shared/net';
import { usePlayed } from '@/shared/played';
import { useManualRefresh } from '@/shared/query';
import { FONT, useTokens } from '@/shared/theme';
import { relDay, useLondonDay } from '@/shared/time';
import { Note, PuzzleRow, PuzzleRowSkeleton, refreshColors, Screen } from '@/shared/ui';

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
  const { refresh, refreshing } = useManualRefresh(q, () => q.refetch());
  const offline = isConnectionError(q.error);

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
              testID={`chip-${ty ?? 'all'}`}
              style={styles.chipHit}>
              <View
                style={[
                  styles.chip,
                  on
                    ? { borderColor: t.accent, backgroundColor: t.accentSoft }
                    : { borderColor: t.hair, backgroundColor: t.paper },
                ]}>
                <Text style={[styles.chipText, { color: on ? t.accent : t.muted }]}>{label}</Text>
              </View>
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
      {!q.data && q.isPending ? <PuzzleRowSkeleton testID="archive-loading" /> : null}
      {!q.data && q.isError ? (
        <Note
          testID={offline ? 'archive-offline' : 'archive-failed'}
          title={offline ? 'No connection' : 'Couldn’t load the archive'}
          body={
            offline
              ? 'The archive will load when you’re back online.'
              : 'Something went wrong at our end. Try again in a moment.'
          }
          action={{ label: 'Try again', onPress: refresh }}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            testID="archive-refresh"
            {...refreshColors(t)}
          />
        }
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
  // Out to the screen's edges (the page has a 16 pt gutter), so the last chip slides off the
  // edge rather than being cut in mid-air.
  chips: { flexGrow: 0, flexShrink: 0, marginHorizontal: -16, marginTop: -8 },
  chipsRow: { gap: 6, paddingHorizontal: 16 },
  // A 46 pt press area round the site-sized ~30 pt chip (front.css .chip), so it is easy to hit;
  // the -8 margin above keeps the chip where it was.
  chipHit: { paddingVertical: 8, justifyContent: 'center' },
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
  // 40 pt buttons in a 3 pt-padded, bordered pill: 48 pt to tap, Material's minimum.
  segBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  // front.css .chip: 12.5 px semibold, 6 × 12 padding, a hairline; the chosen one in the accent.
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: FONT.bodySemi, fontSize: 12.5 },
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
