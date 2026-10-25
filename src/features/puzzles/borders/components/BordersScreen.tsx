import type { TodayItem } from '@noodle/core';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { usePuzzleVisit } from '@/shared/results';
import { FONT } from '@/shared/theme';

import type { PuzzleFile } from '../../types';
import type { FinishInfo } from '../finishing';
import { useBordersGame } from '../hooks/useBordersGame';
import { serial, type BordersData } from '../model';
import { useBordersColors, type BordersColors } from './colors';
import { BordersHome } from './BordersHome';
import { BordersQuiz } from './BordersQuiz';
import { tilesHtml } from './drawing';
import { Picture } from './Picture';

export const BORDERLINE = 'https://dailynoodle.co.uk/reports/2026-10-05-quiz-borderline.html';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

function openNext(item: TodayItem | null) {
  if (!item) return back();
  const file = item.path.replace(/^reports\//, '').replace(/\.html$/, '');
  router.replace({ pathname: '/play/[type]/[file]', params: { type: item.type, file } });
}

/** "Today's ten", easiest first: each outline with its name, the misses crossed. */
function Recap({ info, c }: { info: FinishInfo; c: BordersColors }) {
  return (
    <View>
      <Picture
        html={tilesHtml(info.tiles, c)}
        style={styles.tiles}
        label={info.tiles.map((t) => `${t.caption}${t.ok ? '' : ', missed'}`).join('; ')}
        testID="borders-recap"
      />
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(BORDERLINE)}
        style={styles.link}>
        <Text style={[styles.linkText, { color: c.ink }]}>Explore more outlines in Borderline</Text>
      </Pressable>
    </View>
  );
}

/** Borders, played natively: its start screen, the ten outlines, the finish sheet. */
export function BordersScreen({
  file,
  deps,
}: {
  file: PuzzleFile<BordersData>;
  /** Clocks and stores, for tests. */
  deps?: Parameters<typeof useBordersGame>[1];
}) {
  const c = useBordersColors();
  const { state, info, dispatch, today } = useBordersGame(file, deps);
  const fresh = useFreshFinish(state.view === 'winModal' && !!info);
  // Play on the home card is the page's #playCard: a start, unless today's round is done.
  const start = usePuzzleVisit(file.path, 'borders', !!state.save.done[state.P.id]);
  if (state.view === 'winModal' && info)
    return (
      <FinishSheet
        celebrate={fresh}
        type="borders"
        path={file.path}
        n={serial(file.data.id)}
        date={file.data.date}
        title="Spotted"
        hero={info.hero}
        note={info.note}
        share={info.share}
        stats={[
          { value: info.points, label: 'points' },
          { value: info.streak, label: 'day streak' },
          { value: info.best, label: 'best score' },
        ]}
        recap={{ title: 'Today’s ten', sub: 'Easiest first', node: <Recap info={info} c={c} /> }}
        onBack={back}
        onNext={openNext}
      />
    );
  if (state.view === 'quiz') return <BordersQuiz state={state} c={c} dispatch={dispatch} />;
  return (
    <BordersHome
      state={state}
      today={today}
      c={c}
      onPlay={() => {
        start();
        dispatch({ t: 'play' });
      }}
      onBack={back}
    />
  );
}

const styles = StyleSheet.create({
  tiles: { aspectRatio: 5 / 2.6 },
  link: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  linkText: { fontSize: 15, fontFamily: FONT.sansSemi, textDecorationLine: 'underline' },
});
