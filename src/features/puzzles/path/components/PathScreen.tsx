import type { TodayItem } from '@noodle/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { usePuzzleTokens } from '@/shared/theme';
import { fitBoard } from '@/shared/ui';

import type { PuzzleFile } from '../../types';
import { usePathGame } from '../hooks/usePathGame';
import type { Cell, PathData } from '../model';
import { pathNumber } from '../simulate';
import { PathArt, PathBoard, PathRecap } from './PathBoard';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

function openNext(item: TodayItem | null) {
  if (!item) return back();
  const file = item.path.replace(/^reports\//, '').replace(/\.html$/, '');
  router.replace({ pathname: '/play/[type]/[file]', params: { type: item.type, file } });
}

/** Path, played natively: start card, board, Undo and Hint, finish sheet. */
export function PathScreen({ file }: { file: PuzzleFile<PathData> }) {
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const game = usePathGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  const stats = useStartStats('path');
  const n = pathNumber(file.data.id);
  const { state, dispatch } = game;

  if (game.phase === 'start') {
    const one = file.data.locked.find((x) => x[2] === 1);
    return (
      <StartCard
        type="path"
        n={n}
        date={file.date}
        rule={ruleFor('path', {})}
        stats={stats}
        art={<PathArt one={one ? ([one[0] - 1, one[1] - 1] as Cell) : null} />}
        onPlay={game.play}
        onBack={back}
      />
    );
  }

  if (game.phase === 'finished' && game.info)
    return (
      <FinishSheet
        celebrate={fresh}
        type="path"
        n={n}
        date={file.date}
        title="Thread complete"
        hero={game.info.hero}
        note={game.info.note}
        share={game.info.share}
        stats={[
          { value: game.info.streak, label: 'day streak' },
          { value: game.info.best, label: 'best streak' },
          { value: game.info.played, label: 'Paths played' },
        ]}
        recap={{
          title: 'The thread',
          sub: 'The given numbers are shaded.',
          node: <PathRecap state={state} />,
        }}
        onBack={back}
        onNext={openNext}
      />
    );

  const side = fitBoard(win, 300, 460);
  const btn = [styles.btn, { borderColor: pt.ink, backgroundColor: pt.card }];
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="path-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Path ${n}`}
          sub={file.data.band}
          streak={game.streak}
          clock={game.clock}
          onBack={back}
        />
        <View style={styles.board}>
          <PathBoard state={state} side={side} onCell={(r, c) => dispatch({ t: 'cell', r, c })} />
        </View>
        <Text
          style={[styles.msg, { color: pt.inkSoft }]}
          accessibilityLiveRegion="polite"
          testID="path-msg">
          {state.msg}
        </Text>
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" onPress={() => dispatch({ t: 'undo' })} style={btn}>
            <Text style={[styles.btnText, { color: pt.ink }]}>Undo</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => dispatch({ t: 'hint' })} style={btn}>
            <Text style={[styles.btnText, { color: pt.ink }]}>Hint</Text>
          </Pressable>
        </View>
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
    gap: 10,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  board: { flex: 1, justifyContent: 'center' },
  msg: { fontSize: 14, lineHeight: 19, textAlign: 'center', minHeight: 38 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btn: {
    minHeight: 44,
    minWidth: 96,
    borderWidth: 1.5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  btnText: { fontSize: 14, fontWeight: '500' },
});
