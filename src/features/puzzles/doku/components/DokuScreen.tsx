import { dnNum, type TodayItem } from '@noodle/core';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { useStoredRaw } from '@/shared/storage';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { fitBoard } from '@/shared/ui';

import type { PuzzleFile } from '../../types';
import { MiniArt } from '../../mini/components/MiniGrids';
import { useDokuGame } from '../hooks/useDokuGame';
import { STREAK_KEY, type DokuData } from '../model';
import { DokuBank } from './DokuBank';
import { DokuBoard } from './DokuBoard';
import { SolvedGrid } from './DokuGrids';

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

/** The Doku, played natively: start card, board and bank, finish sheet. */
export function DokuScreen({ file }: { file: PuzzleFile<DokuData> }) {
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const game = useDokuGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  const stats = useStartStats('doku');
  const streak = savedStreak(useStoredRaw(STREAK_KEY));
  const n = dnNum(file.data.id).slice(1);
  const { state, dispatch, feed } = game;

  // The page's hidden input: a tap on an empty square brings the phone's keyboard up,
  // a tap anywhere else on the board or a tile takes it down.
  const input = useRef<TextInputInstance>(null);
  const kbd = state.kbd && !state.solved && game.phase === 'play';
  useEffect(() => {
    if (kbd) input.current?.focus();
    else input.current?.blur();
  }, [kbd, state]);

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
        recap={{ title: 'The grid', node: <SolvedGrid p={state.p} /> }}
        onBack={back}
        onNext={openNext}
      />
    );

  // Board, bank, message and Hints on one screen, as the page's app mode lays them out.
  const side = fitBoard(win, 360, 420);
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="doku-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Doku ${n}`}
          sub={file.data.band}
          streak={streak}
          clock={game.clock}
          onBack={back}
        />
        <View style={styles.board}>
          <DokuBoard state={state} side={side} onCell={(r, c) => dispatch({ t: 'cell', r, c })} />
        </View>
        <DokuBank state={state} onTile={(id) => dispatch({ t: 'tile', id })} />
        <Text
          style={[styles.msg, { color: pt.inkSoft }]}
          accessibilityLiveRegion="polite"
          testID="doku-msg">
          {game.msg}
        </Text>
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ checked: state.hints }}
            onPress={() => dispatch({ t: 'hints' })}
            style={[styles.btn, { borderColor: pt.line, backgroundColor: pt.card }]}>
            <Text style={[styles.btnText, { color: pt.ink }]}>
              {`Hints: ${state.hints ? 'on' : 'off'}`}
            </Text>
          </Pressable>
        </View>
        <TextInput
          ref={input}
          testID="doku-keys"
          value=""
          onChangeText={feed}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Backspace') dispatch({ t: 'del' });
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          caretHidden
          importantForAutofill="no"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.hidden}
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
  msg: { fontFamily: FONT.sans, fontSize: 13, textAlign: 'center', minHeight: 18 },
  controls: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  btn: {
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: 9,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  btnText: { fontSize: 13, fontFamily: FONT.sansMedium },
  hidden: { position: 'absolute', top: 0, left: '50%', width: 1, height: 1, opacity: 0 },
});
