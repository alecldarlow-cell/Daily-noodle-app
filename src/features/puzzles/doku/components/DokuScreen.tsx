import { dnNum } from '@noodle/core';
import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { WIN_BURSTS, useWinBursts } from '@/shared/motion';
import { PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { BOARD_SLOT, fitBoard, pressable, useBoardFit } from '@/shared/ui';
import { usePlayerExit } from '@/shared/shell';

import type { PuzzleFile } from '../../types';
import { MiniArt } from '../../mini/components/MiniGrids';
import { useDokuGame } from '../hooks/useDokuGame';
import { recapSub, type DokuData } from '../model';
import { DokuBank } from './DokuBank';
import { DokuBoard } from './DokuBoard';
import { SolvedGrid } from './DokuGrids';

/** The Doku, played natively: start card, board and bank, finish sheet. */
export function DokuScreen({ file }: { file: PuzzleFile<DokuData> }) {
  const { back, next: openNext } = usePlayerExit();
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const game = useDokuGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  // A fresh win, between the last move and the sheet: the board's wave and the confetti.
  const winning = game.phase === 'play' && !!game.info;
  const boardRef = useRef<ComponentRef<typeof View>>(null);
  useWinBursts(winning, WIN_BURSTS, boardRef);
  const stats = useStartStats('doku');
  const fit = useBoardFit(fitBoard(win, 360, 420), 420);
  const n = dnNum(file.data.id).slice(1);
  const { state, dispatch } = game;

  // The bank is the keyboard. Where the page brings the phone's keyboard up (a tap on an
  // empty square: state.kbd), it covered the bank, so players lost sight of their letters.
  // Here the keyboard stays down and a bank tile types its letter into the yellow square
  // instead, then the next, as typing would. Otherwise a tile tap picks the tile up, as on
  // the page (then a tap on a square puts it down).
  const onTile = (id: string) => {
    const t = state.tiles.find((x) => x.id === id && !x.at);
    if (t && state.kbd && !state.selTile) dispatch({ t: 'key', ch: t.ch });
    else dispatch({ t: 'tile', id });
  };

  if (game.phase === 'start')
    return (
      <StartCard
        type="doku"
        n={n}
        date={file.date}
        rule={ruleFor('doku', file.data)}
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
        type="doku"
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
          { value: game.info.played, label: 'Dokus played' },
        ]}
        recap={{ title: 'The grid', sub: recapSub(state.p), node: <SolvedGrid p={state.p} /> }}
        onBack={back}
        onNext={openNext}
      />
    );

  // Board, bank, message and Hints on one screen, as the page's app mode lays them out.
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="doku-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Doku ${n}`}
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
          <DokuBoard
            celebrating={winning}
            state={state}
            side={fit.side}
            onCell={(r, c) => dispatch({ t: 'cell', r, c })}
          />
        </View>
        <DokuBank state={state} onTile={onTile} />
        {/* The message and the Hints switch on one line under the bank, the switch at its
            end, rather than a lone button floating under everything (the page groups Hints
            with its other tools; the app has no others). */}
        <View style={styles.foot}>
          <Text
            style={[styles.msg, { color: pt.inkSoft }]}
            accessibilityLiveRegion="polite"
            testID="doku-msg">
            {game.msg}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ checked: state.hints }}
            onPress={() => dispatch({ t: 'hints' })}
            testID="doku-hints"
            style={pressable([styles.btn, { borderColor: pt.line, backgroundColor: pt.card }])}>
            <Text style={[styles.btnText, { color: pt.ink }]}>
              {`Hints: ${state.hints ? 'on' : 'off'}`}
            </Text>
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
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  board: BOARD_SLOT,
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  msg: { flex: 1, fontFamily: FONT.sans, fontSize: 13, minHeight: 18 },
  btn: {
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 9,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  btnText: { fontSize: 13, fontFamily: FONT.sansMedium },
});
