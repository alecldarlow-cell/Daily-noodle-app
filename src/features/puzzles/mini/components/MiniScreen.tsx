import { dnNum } from '@noodle/core';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { WIN_BURSTS, useWinBursts } from '@/shared/motion';
import { houseLine, PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { usePuzzleTokens } from '@/shared/theme';
import { BOARD_SLOT, fitBoard, useBoardFit } from '@/shared/ui';
import { usePlayerExit } from '@/shared/shell';

import type { PuzzleFile } from '../../types';
import { useMiniGame } from '../hooks/useMiniGame';
import type { MiniData } from '../model';
import { ClueBar } from './ClueBar';
import { MiniBoard } from './MiniBoard';
import { MiniHelp } from './MiniHelp';
import { SolvedGrid } from './MiniGrids';
import { MiniKeyboard } from './MiniKeyboard';

/** The Mini, played natively: start card, board, finish sheet. */
export function MiniScreen({ file }: { file: PuzzleFile<MiniData> }) {
  const { back, next: openNext } = usePlayerExit();
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const game = useMiniGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  // A fresh win, between the last move and the sheet: the board's wave and the confetti.
  const winning = game.phase === 'play' && !!game.info;
  const boardRef = useRef<ComponentRef<typeof View>>(null);
  useWinBursts(winning, WIN_BURSTS, boardRef);
  const stats = useStartStats('mini');
  const fit = useBoardFit(fitBoard(win, 400, 420), 420);
  const n = dnNum(file.data.id).slice(1);
  const { state, dispatch } = game;
  const [help, setHelp] = useState(false);

  if (game.phase === 'start')
    return (
      <StartCard
        type="mini"
        n={n}
        date={file.date}
        line={houseLine('mini')}
        rule={ruleFor('mini', file.data)}
        stats={stats}
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

  // Board, clue bar and keyboard on one screen. The page's row of checks moved into Help,
  // the keyboard's bottom-left key, so the keys could grow (Alec, 8 Nov 2026).
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="mini-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Mini ${n}`}
          sub={file.data.band}
          streak={stats.streak}
          clock={game.clock}
          onBack={back}
        />
        <View
          ref={boardRef}
          collapsable={false}
          style={styles.board}
          onLayout={fit.onLayout}
          testID="board-slot">
          <MiniBoard
            celebrating={winning}
            state={state}
            side={fit.side}
            onCell={(r, c) => dispatch({ t: 'cell', r, c })}
          />
        </View>
        <ClueBar
          bar={game.bar}
          onPrev={() => dispatch({ t: 'step', delta: -1 })}
          onNext={() => dispatch({ t: 'step', delta: 1 })}
          onToggle={() => dispatch({ t: 'bar' })}
        />
        <MiniKeyboard
          onKey={(ch) => dispatch({ t: 'key', ch })}
          onDelete={() => dispatch({ t: 'del' })}
          onHelp={() => setHelp(true)}
        />
        <MiniHelp
          open={help}
          word={game.bar?.label}
          onClose={() => setHelp(false)}
          onCheckCell={() => dispatch({ t: 'checkCell' })}
          onCheckWord={() => dispatch({ t: 'checkWord' })}
          onCheckAll={() => dispatch({ t: 'checkAll' })}
          onRevealWord={() => dispatch({ t: 'revealWord' })}
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
  board: BOARD_SLOT,
});
