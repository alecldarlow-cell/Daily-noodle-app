import { LAB_LABEL, LAB_TYPES, labPlayed, labSaveKey } from '@noodle/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LabFeedItem } from '@/shared/feed';
import { useFreshFinish, useRecapWidth } from '@/shared/finish-sheet';
import { LabFinishSheet, LabStartCard, nextTrial, useLabTrials } from '@/shared/lab';
import { openPuzzle } from '@/shared/played';
import { usePlayerExit } from '@/shared/shell';
import { PuzzleBar } from '@/shared/start-card';
import { useStoredDocs } from '@/shared/storage';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { BOARD_SLOT, fitBoard, pressable, useBoardFit } from '@/shared/ui';

import type { PuzzleFile } from '../../types';
import { useRedactGame } from '../hooks/useRedactGame';
import {
  clearOff,
  HOUSE_LINE,
  HOW,
  redactNumber,
  ruleSentence,
  undoOff,
  type Move,
  type RedactData,
} from '../model';
import { RedactBoard, RedactRecap } from './RedactBoard';

const KEYS = LAB_TYPES.map(labSaveKey);

/** Redact, played natively (a Lab trial): start card, the letters, Undo and Clear, the Lab finish. */
export function RedactScreen({ file }: { file: PuzzleFile<RedactData> }) {
  const { back } = usePlayerExit();
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const game = useRedactGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  const recapW = useRecapWidth();
  const { current } = useLabTrials();
  const docs = useStoredDocs(KEYS);
  const fit = useBoardFit(fitBoard(win, 250, 460), 460);
  const n = redactNumber(file.data.id);
  const { state, dispatch } = game;

  if (game.phase === 'start')
    return (
      <LabStartCard
        type="redact"
        n={n}
        date={file.date}
        line={HOUSE_LINE}
        how={[ruleSentence(file.data), ...HOW]}
        played={game.played}
        resume={
          game.resumed
            ? { head: 'Part-played', status: `${state.black.length} of ${state.k} blacked out.` }
            : undefined
        }
        onPlay={game.play}
        onBack={back}
      />
    );

  if (game.phase === 'finished' && game.info) {
    const next = nextTrial(
      current,
      'redact',
      (it) => !!labPlayed(it.id, docs[labSaveKey(it.type)] as never)?.done,
    );
    const onNext = (it: LabFeedItem) =>
      openPuzzle({ type: it.type, name: LAB_LABEL[it.type], path: it.path }, null, (href) =>
        router.replace(href),
      );
    return (
      <LabFinishSheet
        celebrate={fresh}
        type="redact"
        n={n}
        date={file.date}
        path={file.path}
        title="Solved"
        hero={game.info.hero}
        note={game.info.note}
        share={game.info.share}
        recap={{
          title: 'The crossword',
          sub: `${state.k} black squares; every run across and down a word.`,
          node: <RedactRecap state={state} width={recapW} />,
        }}
        next={next}
        onBack={back}
        onNext={onNext}
      />
    );
  }

  const tool = (m: Move, name: string, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => dispatch(m)}
      testID={`redact-${m.t}`}
      style={pressable([
        styles.tool,
        { backgroundColor: pt.card, borderColor: pt.lineSoft, opacity: off ? 0.35 : 1 },
      ])}>
      <Text style={[styles.toolText, { color: pt.ink }]}>{name}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="redact-screen">
      <View style={styles.in}>
        <PuzzleBar name={`Redact ${n}`} sub="Lab" streak={0} clock={game.clock} onBack={back} />
        <View style={styles.board} onLayout={fit.onLayout} testID="board-slot">
          <RedactBoard
            state={state}
            side={fit.side}
            celebrating={game.winning}
            onCell={game.winning ? undefined : (i) => dispatch({ t: 'cell', i })}
          />
        </View>
        <View style={styles.tools}>
          <Text style={[styles.count, { color: pt.inkSoft }]} testID="redact-count">
            <Text style={[styles.countB, { color: pt.ink }]}>{state.black.length}</Text> of{' '}
            {state.k} blacked out
          </Text>
          {tool({ t: 'undo' }, 'Undo', undoOff(state))}
          {tool({ t: 'clear' }, 'Clear', clearOff(state))}
        </View>
        <Text
          style={[styles.msg, { color: pt.inkSoft }]}
          accessibilityLiveRegion="polite"
          testID="redact-msg">
          {state.solved ? `Solved in ${game.clock}.` : state.msg}
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
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  count: { flex: 1, fontFamily: FONT.sans, fontSize: 14 },
  countB: { fontFamily: FONT.sansSemi },
  tool: {
    minHeight: 48,
    minWidth: 76,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { fontFamily: FONT.sansMedium, fontSize: 15 },
  msg: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 19, textAlign: 'center', minHeight: 40 },
});
