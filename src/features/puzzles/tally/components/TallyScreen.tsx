import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { usePlayerExit } from '@/shared/shell';
import { PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { BOARD_SLOT, fitBoard, pressable, useBoardFit } from '@/shared/ui';

import type { PuzzleFile } from '../../types';
import { useTallyGame } from '../hooks/useTallyGame';
import { tallyNumber, type Move, type TallyData } from '../model';
import { tallyColors } from './colors';
import { TallyBoard, TallyRecap } from './TallyBoard';

/** Tally, played natively: start card, board, keypad, Notes, Erase, Undo, finish sheet. */
export function TallyScreen({ file }: { file: PuzzleFile<TallyData> }) {
  const { back, next: openNext } = usePlayerExit();
  const pt = usePuzzleTokens();
  const tc = tallyColors(useColorScheme() === 'dark');
  const win = useWindowDimensions();
  const game = useTallyGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  const stats = useStartStats('tally');
  // The page leaves about 330 px for its bar, keypad and tools.
  const fit = useBoardFit(fitBoard(win, 260, 380), 380);
  const n = tallyNumber(file.data.id);
  const { state, dispatch } = game;

  if (game.phase === 'start')
    return (
      <StartCard
        type="tally"
        n={n}
        date={file.date}
        rule={ruleFor('tally', {})}
        stats={stats}
        onPlay={game.play}
        onBack={back}
      />
    );

  if (game.phase === 'finished' && game.info)
    return (
      <FinishSheet
        celebrate={fresh}
        type="tally"
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
          { value: game.info.played, label: 'boards played' },
        ]}
        recap={{
          title: 'The board',
          sub: `Every row and column 1 to ${state.n}; each cage makes its clue.`,
          node: <TallyRecap state={state} />,
        }}
        onBack={back}
        onNext={openNext}
      />
    );

  const key = pressable([styles.key, { backgroundColor: pt.card, borderColor: tc.lineSoft }]);
  const tool = (m: Move, name: string, opts: { on?: boolean; off?: boolean } = {}) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!opts.off, selected: !!opts.on }}
      disabled={opts.off}
      onPress={() => dispatch(m)}
      style={pressable([
        styles.tool,
        {
          backgroundColor: opts.on ? pt.brand : pt.card,
          borderColor: opts.on ? pt.brand : tc.lineSoft,
          opacity: opts.off ? 0.35 : 1,
        },
      ])}>
      <Text style={[styles.toolText, { color: opts.on ? '#FFFFFF' : pt.ink }]}>{name}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="tally-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Tally ${n}`}
          sub={file.data.band}
          streak={game.streak}
          clock={game.clock}
          onBack={back}
        />
        <View style={styles.board} onLayout={fit.onLayout} testID="board-slot">
          <TallyBoard state={state} side={fit.side} onCell={(i) => dispatch({ t: 'cell', i })} />
        </View>
        <View style={styles.keys}>
          {Array.from({ length: state.n }, (_, k) => k + 1).map((d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={`Enter ${d}`}
              onPress={() => dispatch({ t: 'digit', d })}
              style={key}
              testID={`tally-key-${d}`}>
              <Text style={[styles.keyText, { color: pt.ink }]}>{d}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tools}>
          {tool({ t: 'notes' }, 'Notes', { on: state.notesMode })}
          {tool({ t: 'erase' }, 'Erase')}
          {tool({ t: 'undo' }, 'Undo', { off: !state.undo.length })}
        </View>
        <Text
          style={[styles.msg, { color: pt.inkSoft }]}
          accessibilityLiveRegion="polite"
          testID="tally-msg">
          {state.msg}
        </Text>
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
  board: BOARD_SLOT,
  keys: { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 380, alignSelf: 'center' },
  key: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: FONT.sansMedium, fontSize: 22 },
  tools: { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 380, alignSelf: 'center' },
  tool: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { fontFamily: FONT.sansMedium, fontSize: 15 },
  msg: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 19, textAlign: 'center', minHeight: 20 },
});
