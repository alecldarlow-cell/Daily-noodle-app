import { dnNum, type TodayItem } from '@noodle/core';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { useStoredRaw } from '@/shared/storage';
import { usePuzzleTokens } from '@/shared/theme';

import type { PuzzleFile } from '../../types';
import { useLinkGame } from '../hooks/useLinkGame';
import { groupsByRank, STREAK_KEY, type LinkData } from '../model';
import { LinkBoard } from './LinkBoard';
import { GroupBands, GuessSquares, LinkArt, PlayAgain } from './LinkParts';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

function openNext(item: TodayItem | null) {
  if (!item) return back();
  const file = item.path.replace(/^reports\//, '').replace(/\.html$/, '');
  router.replace({ pathname: '/play/[type]/[file]', params: { type: item.type, file } });
}

/** The saved streak as the page's bar shows it (#streak: the saved number, live or not). */
function savedStreak(raw: string | null): number {
  try {
    const s = JSON.parse(raw ?? 'null') as { streak?: unknown } | null;
    return (s && Number(s.streak)) || 0;
  } catch {
    return 0;
  }
}

/** Link, played natively: start card, board, finish sheet. */
export function LinkScreen({ file }: { file: PuzzleFile<LinkData> }) {
  const pt = usePuzzleTokens();
  const game = useLinkGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  const stats = useStartStats('link');
  const streak = savedStreak(useStoredRaw(STREAK_KEY));
  const n = dnNum(file.data.id).slice(1);
  const { state, dispatch } = game;

  if (game.phase === 'start')
    return (
      <StartCard
        type="link"
        n={n}
        date={file.date}
        rule={ruleFor('link', {})}
        stats={stats}
        art={<LinkArt />}
        onPlay={game.play}
        onBack={back}
      />
    );

  if (game.phase === 'finished' && game.info) {
    const f = game.info;
    const names = f.squares.map((r) =>
      r ? (state.p.groups.find((g) => g.rank === r)?.name ?? '') : 'a miss',
    );
    return (
      <FinishSheet
        celebrate={fresh}
        type="link"
        path={file.path}
        n={n}
        date={file.date}
        title={f.title}
        hero={names.join(', ')}
        heroNode={<GuessSquares squares={f.squares} names={names} />}
        note={f.note}
        share={f.share}
        stats={[
          { value: f.time, label: 'time' },
          { value: f.streak, label: 'day streak' },
          { value: f.best, label: 'best streak' },
        ]}
        recap={{
          title: 'The groups',
          sub: 'Easiest to hardest',
          node: <GroupBands groups={groupsByRank(state.p)} />,
        }}
        after={f.won ? undefined : <PlayAgain onPress={() => dispatch({ t: 'again' })} />}
        onBack={back}
        onNext={openNext}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="link-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Link ${n}`}
          sub={`${file.data.band}${state.label ? ' · replay' : ''}`}
          streak={streak}
          clock={game.clock}
          onBack={back}
        />
        <LinkBoard state={state} dispatch={dispatch} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  in: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 12,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
});
