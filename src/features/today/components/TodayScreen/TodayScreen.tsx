import { TYPE_LABEL } from '@noodle/core';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/shared/theme';
import { shortDate, useLondonDay } from '@/shared/time';
import { Note, PuzzleRow, Screen } from '@/shared/ui';

import { usePlayed } from '@/shared/played';
import { useToday } from '../../hooks/useToday';

const NO_ITEMS: never[] = [];

/** Today's eight puzzles, in the daily set's order, with your results so far. */
export function TodayScreen() {
  const t = useTokens();
  const day = useLondonDay();
  const status = useToday();
  const items = status.kind === 'ready' ? status.list.items : NO_ITEMS;
  const { byId, run } = usePlayed(items, day);
  const refresh = status.refresh;

  return (
    <Screen title="Today" subtitle={shortDate(day)} testID="today-screen" onRefresh={refresh}>
      {run >= 2 ? (
        <View style={[styles.chip, { backgroundColor: t.accentSoft }]} testID="run-chip">
          <Text style={[styles.chipText, { color: t.ink }]}>
            🔥 <Text style={styles.bold}>{run}-day</Text> streak
          </Text>
        </View>
      ) : null}

      {status.kind === 'loading' ? (
        <ActivityIndicator style={styles.spinner} color={t.muted} />
      ) : null}

      {status.kind === 'nearly' ? (
        <Note
          testID="today-nearly"
          title="Nearly ready"
          body="Today’s puzzles are on their way. They’re usually here by 5 am."
          action={{ label: 'Try again', onPress: refresh }}
        />
      ) : null}

      {status.kind === 'offline' ? (
        <Note
          testID="today-offline"
          title="No connection"
          body="Today’s puzzles will appear as soon as you’re back online."
          action={{ label: 'Try again', onPress: refresh }}
        />
      ) : null}

      {status.kind === 'ready'
        ? items.map((it) => (
            <PuzzleRow
              key={it.id}
              testID={`today-${it.type}`}
              kicker={TYPE_LABEL[it.type]}
              title={it.name}
              played={byId[it.id] ?? null}
              onPress={() =>
                router.push({
                  pathname: '/play/[type]/[file]',
                  params: { type: it.type, file: fileOf(it.path) },
                })
              }
            />
          ))
        : null}
    </Screen>
  );
}

/** "reports/2026-10-24-crossword-mini-0105.html" → "2026-10-24-crossword-mini-0105". */
export function fileOf(path: string): string {
  return path.replace(/^reports\//, '').replace(/\.html$/, '');
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  chipText: { fontSize: 15 },
  bold: { fontWeight: '800' },
  spinner: { marginTop: 40 },
});
