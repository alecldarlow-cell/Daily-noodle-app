import { dnNum, type TodayItem } from '@noodle/core';
import { router } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { WIN_BURSTS, useWinBursts } from '@/shared/motion';
import { PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { useStoredRaw } from '@/shared/storage';
import { usePuzzleTokens } from '@/shared/theme';
import { fitBoard } from '@/shared/ui';

import type { PuzzleFile } from '../../types';
import { useMiniGame } from '../hooks/useMiniGame';
import { STREAK_KEY, type MiniData } from '../model';
import { ClueBar } from './ClueBar';
import { MiniBoard } from './MiniBoard';
import { MiniControls } from './MiniControls';
import { MiniArt, SolvedGrid } from './MiniGrids';
import { MiniKeyboard } from './MiniKeyboard';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

function openNext(item: TodayItem | null) {
  if (!item) return back();
  const file = item.path.replace(/^reports\//, '').replace(/\.html$/, '');
  router.replace({ pathname: '/play/[type]/[file]', params: { type: item.type, file } });
}

function savedStreak(raw: string | null): number {
  try {
    const s = JSON.parse(raw ?? 'null') as { streak?: unknown } | null;
    return (s && Number(s.streak)) || 0;
  } catch {
    return 0;
  }
}

/** The Mini, played natively: start card, board, finish sheet. */
export function MiniScreen({ file }: { file: PuzzleFile<MiniData> }) {
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const game = useMiniGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  // A fresh win, between the last move and the sheet: the board's wave and the confetti.
  const winning = game.phase === 'play' && !!game.info;
  const boardRef = useRef<ComponentRef<typeof View>>(null);
  useWinBursts(winning, WIN_BURSTS, boardRef);
  const stats = useStartStats('mini');
  const streak = savedStreak(useStoredRaw(STREAK_KEY));
  const n = dnNum(file.data.id).slice(1);
  const { state, dispatch } = game;

  if (game.phase === 'start')
    return (
      <StartCard
        type="mini"
        n={n}
        date={file.date}
        rule={ruleFor('mini', file.data)}
        stats={stats}
        art={<MiniArt grid={file.data.grid} />}
        onPlay={game.play}
        onBack={back}
      />
    );

  if (game.phase === 'finished' && game.info)
    return (
      <FinishSheet
        celebrate={fresh}
        type="mini"
        path={file.path}
        n={n}
        date={file.date}
        title="Solved"
        hero={game.info.hero}
        note={game.info.note}
        share={game.info.share}
        stats={[
          { value: game.info.streak, label: 'day streak' },
          { value: game.info.best, label: 'best streak' },
          { value: game.info.played, label: 'Minis played' },
        ]}
        recap={{ title: 'The grid', node: <SolvedGrid grid={state.p.grid} nums={state.p.nums} /> }}
        onBack={back}
        onNext={openNext}
      />
    );

  // Board, clue bar, the checks and keyboard on one screen, in the page's order (.gridwrap,
  // .cluebar, .controls, .kb; Alec's call 25 Oct 2026 to match it).
  const side = fitBoard(win, 400, 420);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="mini-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Mini ${n}`}
          sub={file.data.band}
          streak={streak}
          clock={game.clock}
          onBack={back}
        />
        <View ref={boardRef} collapsable={false} style={styles.board}>
          <MiniBoard
            celebrating={winning}
            state={state}
            side={side}
            onCell={(r, c) => dispatch({ t: 'cell', r, c })}
          />
        </View>
        <ClueBar
          bar={game.bar}
          onPrev={() => dispatch({ t: 'step', delta: -1 })}
          onNext={() => dispatch({ t: 'step', delta: 1 })}
          onToggle={() => dispatch({ t: 'bar' })}
        />
        <MiniControls
          onCheckWord={() => dispatch({ t: 'checkWord' })}
          onCheckAll={() => dispatch({ t: 'checkAll' })}
          onRevealWord={() => dispatch({ t: 'revealWord' })}
        />
        <MiniKeyboard
          onKey={(ch) => dispatch({ t: 'key', ch })}
          onDelete={() => dispatch({ t: 'del' })}
        />
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
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  board: { flex: 1, justifyContent: 'center' },
});
