import type { PuzzleType } from '@noodle/core';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useFeedLite, type FeedItem } from '@/shared/feed';
import { fileOf, openPuzzle, useKept, usePlayed } from '@/shared/played';
import { FONT, useTokens } from '@/shared/theme';
import { shortDate, useLondonDay } from '@/shared/time';
import { Note, PuzzleRow, PuzzleRowSkeleton, Screen } from '@/shared/ui';

import { useToday } from '../../hooks/useToday';

const NO_ITEMS: never[] = [];

/** What works offline, said once (AF-023): no promise of reloading by itself. */
export const OFFLINE_BODY =
  'Puzzles you’ve opened before still work; pull down or tap Try again when you’re back online.';

/** Opens the site's how-to-play guide at a type. */
export function openHowTo(type: PuzzleType): void {
  router.push({ pathname: '/how-to-play', params: { type } });
}

/**
 * Today's eight puzzles, in the daily set's order, as the site's cards: each with its
 * preview tile and standfirst from feed-lite (just the name until that list arrives),
 * and your results so far.
 */
export function TodayScreen() {
  const t = useTokens();
  const day = useLondonDay();
  const status = useToday();
  const feed = useFeedLite();
  const items = status.kind === 'ready' ? status.list.items : NO_ITEMS;
  const { byId, run, rounds, held } = usePlayed(items, day);
  const refresh = status.refresh;
  const cards = useMemo(() => {
    const m: Record<string, FeedItem> = {};
    for (const it of feed.data?.items ?? []) m[it.id] = it;
    return m;
  }, [feed.data]);
  const played = items.filter((it) => byId[it.id]?.done).length;
  const offline = status.kind === 'ready' && status.offline;
  const paths = useMemo(() => items.map((it) => it.path), [items]);
  const kept = useKept(paths, offline);
  /** A puzzle by id, for the replace-your-round question: its card's name and path. */
  const named = (id: string) => {
    const c = cards[id];
    if (c) return { name: c.headline, path: c.path };
    const i = items.find((x) => x.id === id);
    return i ? { name: i.name, path: i.path } : {};
  };

  return (
    <Screen
      title="Today"
      subtitle={shortDate(day)}
      testID="today-screen"
      onRefresh={refresh}
      refreshing={status.refreshing}>
      {status.kind === 'ready' ? (
        <View style={styles.countRow}>
          <Text style={[styles.count, { color: t.faint }]} testID="today-count">
            {items.length} puzzles{played ? ` · ${played} played` : ''}
          </Text>
          {run >= 2 ? (
            <View
              accessible
              accessibilityLabel={`${run}-day streak`}
              style={[styles.run, { backgroundColor: t.accentSoft }]}
              testID="run-chip">
              <Text style={[styles.runText, { color: t.accent }]}>
                🔥 <Text style={styles.bold}>{run}-day</Text> streak
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {offline ? (
        <View style={styles.note}>
          <Note
            testID="today-offline-kept"
            title="You’re offline"
            body={OFFLINE_BODY}
            action={{ label: 'Try again', onPress: refresh }}
          />
        </View>
      ) : null}

      {status.kind === 'loading' ? <PuzzleRowSkeleton rows={6} testID="today-loading" /> : null}

      {status.kind === 'nearly' ? (
        <View style={styles.note}>
          <Note
            testID="today-nearly"
            title="Nearly ready"
            body="Today’s puzzles are on their way. They’re usually here by 5 am."
            action={{ label: 'Try again', onPress: refresh }}
          />
        </View>
      ) : null}

      {status.kind === 'offline' ? (
        <View style={styles.note}>
          <Note
            testID="today-offline"
            title="No connection"
            body={`You’re offline, and today’s puzzles haven’t downloaded yet. ${OFFLINE_BODY}`}
            action={{ label: 'Try again', onPress: refresh }}
          />
        </View>
      ) : null}

      {status.kind === 'failed' ? (
        <View style={styles.note}>
          <Note
            testID="today-failed"
            title="Couldn’t load today’s puzzles"
            body="Something went wrong at our end. Try again in a moment."
            action={{ label: 'Try again', onPress: refresh }}
          />
        </View>
      ) : null}

      {items.map((it) => {
        const card = cards[it.id];
        const title = card?.headline ?? it.name;
        return (
          <PuzzleRow
            key={it.id}
            testID={`today-${it.type}`}
            type={it.type}
            title={title}
            detail={card?.standfirst}
            mask={card?.mask}
            when="Today"
            read={card?.read}
            played={byId[it.id] ?? null}
            roundTime={rounds[it.id]?.time}
            kept={kept.has(it.path)}
            onHowTo={() => openHowTo(it.type)}
            onPress={() => {
              const other = held(it.type, it.id);
              openPuzzle(
                { type: it.type, name: title, path: it.path },
                other ? named(other) : null,
              );
            }}
          />
        );
      })}
    </Screen>
  );
}

export { fileOf };

const styles = StyleSheet.create({
  countRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 6,
    paddingTop: 0,
    paddingBottom: 2,
  },
  count: {
    fontFamily: FONT.bodySemi,
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  run: { borderRadius: 999, paddingLeft: 8, paddingRight: 10, paddingVertical: 4 },
  runText: { fontFamily: FONT.bodySemi, fontSize: 12.5 },
  bold: { fontFamily: FONT.bodyBold },
  note: { marginTop: 16 },
});
