import { PUZZLE_TYPES, TYPE_LABEL, type PuzzleType } from '@noodle/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFeatures } from '@/shared/features';
import { isConnectionError } from '@/shared/net';
import { openPuzzle, useKept, usePlayed } from '@/shared/played';
import { useManualRefresh } from '@/shared/query';
import { FONT, useTokens } from '@/shared/theme';
import { relDay, useLondonDay } from '@/shared/time';
import { appRecorder } from '@/shared/track';
import {
  Chevron,
  Note,
  PuzzleRow,
  PuzzleRowSkeleton,
  PuzzleTile,
  refreshColors,
  Screen,
  TAP,
} from '@/shared/ui';

import { groupArchive, type DoneFilter } from '../../hooks/groupArchive';
import { ArchiveCalendar } from '../ArchiveCalendar/ArchiveCalendar';
import { useArchive } from '../../hooks/useArchive';
import type { ArchiveItem } from '../../types';

const NO_ITEMS: ArchiveItem[] = [];

type View_ = 'list' | 'calendar';

/** The app's noodle mark, the picker's icon for All. */
const MARK = require('../../../../../assets/images/masthead-mark.png') as number;

/**
 * Every released puzzle before today, by month, newest first. One row of controls (Alec,
 * 7 Nov 2026): a picker for the puzzle type (a sheet of tiles), "✓ Hide done" with the
 * finished cards' tick, and the calendar.
 */
export function ArchiveScreen() {
  const t = useTokens();
  const day = useLondonDay();
  const q = useArchive();
  const [type, setType] = useState<PuzzleType | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [picking, setPicking] = useState(false);
  const status: DoneFilter = hideDone ? 'todo' : 'all';
  // Alec, 6 Nov 2026: the list stays the default; the month calendar is one tap away.
  const [chosen, setView] = useState<View_>('list');
  // features.json's archive switch (Alec, 6 Nov 2026): off hides the calendar, with no app update.
  const calendarOn = useFeatures().archive;
  const view: View_ = calendarOn ? chosen : 'list';
  const items = q.data?.items ?? NO_ITEMS;
  const { byId, rounds, held } = usePlayed(items, day);
  // Finished, won or lost, counts as done; started but unfinished does not (as the cards' ✓).
  const finished = useMemo(() => new Set(Object.keys(byId).filter((id) => byId[id]?.done)), [byId]);
  const sections = useMemo(
    () => groupArchive(items, type, status, finished, day),
    [items, type, status, finished, day],
  );
  const { refresh, refreshing } = useManualRefresh(q, () => q.refetch());
  const offline = isConnectionError(q.error);
  const paths = useMemo(() => items.map((it) => it.path), [items]);
  const kept = useKept(paths, offline && !!q.data);
  const byIdItem = useMemo(() => {
    const m: Record<string, ArchiveItem> = {};
    for (const it of items) m[it.id] = it;
    return m;
  }, [items]);

  const renderRow = (item: ArchiveItem) => (
    <PuzzleRow
      testID={`archive-${item.id}`}
      type={item.type}
      title={item.headline}
      detail={item.standfirst}
      mask={item.mask}
      when={relDay(item.date, day)}
      read={item.read}
      played={byId[item.id] ?? null}
      roundTime={rounds[item.id]?.time}
      kept={kept.has(item.path)}
      onHowTo={() => router.push({ pathname: '/how-to-play', params: { type: item.type } })}
      onPress={() => {
        appRecorder.event('archive_play', { type: item.type, id: item.id }, 'archive.html');
        const other = held(item.type, item.id);
        const o = other ? byIdItem[other] : undefined;
        openPuzzle(
          { type: item.type, name: item.headline, path: item.path },
          other ? { name: o?.headline, path: o?.path } : null,
        );
      }}
    />
  );

  return (
    <Screen title="Archive" testID="archive-screen" scroll={false}>
      <View style={styles.bar} testID="archive-switches">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Puzzles: ${type ? TYPE_LABEL[type] : 'All'}`}
          accessibilityHint="Choose which puzzle to show"
          accessibilityState={{ expanded: picking }}
          testID="archive-type"
          onPress={() => setPicking(true)}
          style={({ pressed }) => [
            styles.pill,
            { borderColor: t.hair, backgroundColor: pressed ? t.accentSoft : t.paper },
          ]}>
          <TypeIcon type={type} size={26} />
          <Text style={[styles.pillText, { color: t.ink }]} numberOfLines={1}>
            {type ? TYPE_LABEL[type] : 'All'}
          </Text>
          <Chevron color={t.ink} dir="down" size={7} />
        </Pressable>
        {view === 'list' ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Hide done"
            accessibilityState={{ checked: hideDone }}
            testID="archive-hide-done"
            onPress={() => setHideDone((h) => !h)}
            style={[
              styles.pill,
              hideDone
                ? { borderColor: t.accent, backgroundColor: t.accentSoft }
                : { borderColor: t.hair, backgroundColor: t.paper },
            ]}>
            <View style={[styles.tick, { backgroundColor: t.accent, borderColor: t.canvas }]}>
              <Text maxFontSizeMultiplier={1} style={[styles.tickText, { color: t.onAccent }]}>
                ✓
              </Text>
            </View>
            <Text style={[styles.pillText, { color: hideDone ? t.accent : t.muted }]}>
              Hide done
            </Text>
          </Pressable>
        ) : null}
        {calendarOn ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={view === 'calendar' ? 'Show as a list' : 'Show as a calendar'}
            accessibilityState={{ selected: view === 'calendar' }}
            testID="view-calendar"
            onPress={() => setView(view === 'calendar' ? 'list' : 'calendar')}
            style={[
              styles.round,
              view === 'calendar'
                ? { borderColor: t.accent, backgroundColor: t.accentSoft }
                : { borderColor: t.hair, backgroundColor: t.paper },
            ]}>
            <CalendarGlyph color={view === 'calendar' ? t.accent : t.ink} />
          </Pressable>
        ) : null}
      </View>
      <TypeSheet
        open={picking}
        type={type}
        onClose={() => setPicking(false)}
        onPick={(ty) => {
          setType(ty);
          setPicking(false);
        }}
      />
      {q.data && offline ? (
        <Note
          testID="archive-offline-kept"
          title="You’re offline"
          body="Puzzles you’ve opened before still work; the rest load when you’re back online."
          action={{ label: 'Try again', onPress: refresh }}
        />
      ) : null}
      {!q.data && q.isPending ? <PuzzleRowSkeleton testID="archive-loading" /> : null}
      {!q.data && q.isError ? (
        <Note
          testID={offline ? 'archive-offline' : 'archive-failed'}
          title={offline ? 'No connection' : 'Couldn’t load the archive'}
          body={
            offline
              ? 'You’re offline, and the archive hasn’t downloaded yet. It loads when you’re back online.'
              : 'Something went wrong at our end. Try again in a moment.'
          }
          action={{ label: 'Try again', onPress: refresh }}
        />
      ) : null}
      {q.data && view === 'list' && sections.length === 0 ? (
        <Note testID="archive-empty" title={hideDone ? 'All done here' : 'No puzzles match'} />
      ) : null}
      {view === 'calendar' ? (
        <ScrollView
          testID="archive-calendar-scroll"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors(t)} />
          }>
          {q.data ? (
            <ArchiveCalendar
              items={items}
              today={day}
              type={type}
              finished={finished}
              renderRow={renderRow}
            />
          ) : null}
          <View style={styles.footer} />
        </ScrollView>
      ) : (
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
          renderItem={({ item }) => renderRow(item)}
          ListFooterComponent={<View style={styles.footer} />}
        />
      )}
    </Screen>
  );
}

/** A type's tile, or the noodle mark for All. */
function TypeIcon({ type, size }: { type: PuzzleType | null; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 6, overflow: 'hidden' }}>
      {type ? (
        <PuzzleTile type={type} size={size} />
      ) : (
        <Image source={MARK} style={{ width: size, height: size }} accessible={false} />
      )}
    </View>
  );
}

/** A small calendar drawn from views (the app has no icon font): a box, its top bar, two rings. */
function CalendarGlyph({ color }: { color: string }) {
  return (
    <View accessible={false} importantForAccessibility="no" style={styles.cal}>
      <View style={[styles.calBox, { borderColor: color }]}>
        <View style={[styles.calBar, { backgroundColor: color }]} />
      </View>
      <View style={[styles.calRing, { left: 4, backgroundColor: color }]} />
      <View style={[styles.calRing, { right: 4, backgroundColor: color }]} />
    </View>
  );
}

/** The type picker: a sheet from the bottom with All and each puzzle as a tile and its name. */
function TypeSheet({
  open,
  type,
  onClose,
  onPick,
}: {
  open: boolean;
  type: PuzzleType | null;
  onClose: () => void;
  onPick: (t: PuzzleType | null) => void;
}) {
  const t = useTokens();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Close"
        testID="archive-type-close"
        onPress={onClose}
      />
      <View style={[styles.sheet, { backgroundColor: t.paper }]} testID="archive-type-sheet">
        <View style={[styles.grab, { backgroundColor: t.hair }]} />
        <Text accessibilityRole="header" style={[styles.sheetTitle, { color: t.ink }]}>
          Show puzzles
        </Text>
        <View style={styles.grid}>
          {[null, ...PUZZLE_TYPES].map((ty) => {
            const on = ty === type;
            const label = ty ? TYPE_LABEL[ty] : 'All';
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                testID={`chip-${ty ?? 'all'}`}
                onPress={() => onPick(ty)}
                style={styles.cell}>
                <View style={[styles.ring, { borderColor: on ? t.accent : 'transparent' }]}>
                  <TypeIcon type={ty} size={48} />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.cellText, { color: on ? t.accent : t.muted }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // One row of controls; it wraps under large text rather than clipping.
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: -4,
    marginBottom: 6,
  },
  pill: {
    minHeight: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderWidth: 1,
    borderRadius: 999,
  },
  pillText: { fontFamily: FONT.bodySemi, fontSize: 14 },
  // The finished cards' mark (PuzzleRow), smaller.
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickText: { fontFamily: FONT.bodyBold, fontSize: 12, lineHeight: 14 },
  round: {
    width: TAP,
    height: TAP,
    borderRadius: TAP / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  cal: { width: 18, height: 18 },
  calBox: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.8,
    borderRadius: 3,
  },
  calBar: { height: 3.5 },
  calRing: { position: 'absolute', top: 0, width: 2, height: 5, borderRadius: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(5,6,8,0.6)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontFamily: FONT.displayHeavy, fontSize: 18, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  cell: { width: '20%', alignItems: 'center', gap: 6, minHeight: TAP },
  ring: { padding: 2, borderWidth: 2, borderRadius: 12 },
  cellText: { fontFamily: FONT.bodySemi, fontSize: 12 },
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
