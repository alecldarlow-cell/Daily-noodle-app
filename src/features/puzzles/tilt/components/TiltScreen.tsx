import { LAB_TYPES, labPlayed, labSaveKey } from '@noodle/core';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LabFeedItem } from '@/shared/feed';
import { LabFinishSheet, LabStartCard, nextTrial, useLabTrials } from '@/shared/lab';
import { useFreshFinish } from '@/shared/finish-sheet';
import { useReduceMotion } from '@/shared/motion';
import { openPuzzle } from '@/shared/played';
import { usePlayerExit } from '@/shared/shell';
import { PuzzleBar } from '@/shared/start-card';
import { useStoredDocs } from '@/shared/storage';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { BOARD_SLOT, fitBoard, pressable, useBoardFit } from '@/shared/ui';

import type { PuzzleFile } from '../../types';
import { useTiltGame } from '../hooks/useTiltGame';
import { SAVE_KEY, tiltNumber, type Move, type TiltData } from '../model';
import { TiltBoard, tiltColors, TiltRecap } from './TiltBoard';

/** The page's open-page line (the site's tools/standfirst.js) and How to play (engines/house.js). */
export const TILT_LINE = 'Turn the maze and the ball rolls. Get it out as fast as you can.';
export const TILT_HOW = [
  'Turn the maze and the ball drops until it hits a wall. Get it out through the gap: the clock is the score.',
  'Turn the maze a quarter at a time with the two buttons (or the arrow keys). After every turn the ball drops straight down until a wall stops it, or it rolls out through the gap in the outer wall.',
  'The squares the ball has crossed are shaded, so you can see where you have been; Undo takes back a turn. Your time is the score, and the finish shows the shortest way out.',
];

type Save = { done?: Record<string, unknown> } | null;
const LAB_KEYS = LAB_TYPES.map(labSaveKey);

/** Opens another Lab trial in this screen's place (it isn't a daily: no kept round to ask about). */
function openTrial(it: LabFeedItem) {
  openPuzzle({ type: it.type, name: it.headline, path: it.path }, null, (href) =>
    router.replace(href),
  );
}

/** Tilt, played natively (Lab, 11 Nov 2026): the Lab start card, the maze, the Lab finish. */
export function TiltScreen({ file }: { file: PuzzleFile<TiltData> }) {
  const { back } = usePlayerExit();
  const pt = usePuzzleTokens();
  const colors = tiltColors(useColorScheme() === 'dark');
  const reduced = useReduceMotion() === true;
  const win = useWindowDimensions();
  const game = useTiltGame(file, { reduced });
  const fresh = useFreshFinish(game.phase === 'finished');
  const fit = useBoardFit(fitBoard(win, 260, 520), 520);
  const n = tiltNumber(file.data.id);
  const { state, dispatch } = game;
  const docs = useStoredDocs(LAB_KEYS);
  const played = Object.keys((docs[SAVE_KEY] as Save)?.done ?? {}).length;
  const { current } = useLabTrials();
  const next = useMemo(
    () =>
      nextTrial(
        current,
        'tilt',
        (it) => !!labPlayed(it.id, docs[labSaveKey(it.type)] as never)?.done,
      ),
    [current, docs],
  );

  if (game.phase === 'start')
    return (
      <LabStartCard
        type="tilt"
        n={n}
        date={file.date}
        line={TILT_LINE}
        how={TILT_HOW}
        played={played}
        onPlay={game.play}
        onBack={back}
      />
    );

  if (game.phase === 'finished' && game.info)
    return (
      <LabFinishSheet
        type="tilt"
        n={n}
        date={file.date}
        path={file.path}
        title="Out"
        hero={game.info.hero}
        note={game.info.note}
        share={game.info.share}
        recap={{
          title: 'The way out',
          sub: `The shortest route: ${file.data.par} turns.`,
          node: <TiltRecap p={file.data} colors={colors} />,
        }}
        next={next}
        celebrate={fresh}
        onBack={back}
        onNext={openTrial}
      />
    );

  const turnBtn = (dir: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir > 0 ? 'Turn the maze right' : 'Turn the maze left'}
      onPress={() => dispatch({ t: 'turn', dir })}
      style={pressable([styles.turn, { backgroundColor: pt.card, borderColor: pt.lineSoft }])}
      testID={dir > 0 ? 'tilt-right' : 'tilt-left'}>
      <Text style={[styles.turnGlyph, { color: pt.ink }]}>{dir > 0 ? '↻' : '↺'}</Text>
    </Pressable>
  );
  const undo: Move = { t: 'undo' };
  const undoOff = !state.hist.length || state.solved;
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="tilt-screen">
      <View style={styles.in}>
        <PuzzleBar name={`Tilt ${n}`} sub="Lab" streak={0} clock={game.clock} onBack={back} />
        <View style={styles.board} onLayout={fit.onLayout} testID="board-slot">
          <View style={styles.center}>
            <TiltBoard state={state} side={fit.side} colors={colors} reduced={reduced} />
          </View>
        </View>
        <View style={styles.controls}>
          {turnBtn(-1)}
          <View style={styles.turns} accessible accessibilityLabel={`${state.turns} turns`}>
            <Text style={[styles.turnsN, { color: pt.ink }]} testID="tilt-turns">
              {state.turns}
            </Text>
            <Text style={[styles.turnsL, { color: pt.inkSoft }]}>turns</Text>
          </View>
          {turnBtn(1)}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: undoOff }}
          disabled={undoOff}
          onPress={() => dispatch(undo)}
          style={pressable([styles.undo, { opacity: undoOff ? 0.45 : 1 }])}
          testID="tilt-undo">
          <Text style={[styles.undoText, { color: undoOff ? pt.inkSoft : pt.brand }]}>Undo</Text>
        </Pressable>
        <Text
          style={[styles.msg, { color: pt.inkSoft }]}
          accessibilityLiveRegion="polite"
          testID="tilt-msg">
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
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  board: BOARD_SLOT,
  center: { alignItems: 'center' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  turn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnGlyph: { fontSize: 32, lineHeight: 38, fontFamily: FONT.sansMedium },
  turns: { alignItems: 'center', minWidth: 56 },
  turnsN: { fontSize: 26, fontFamily: FONT.display, fontVariant: ['tabular-nums'] },
  turnsL: { fontSize: 13, fontFamily: FONT.sans },
  undo: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
  undoText: { fontSize: 15, fontFamily: FONT.sansSemi },
  msg: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 19, textAlign: 'center', minHeight: 20 },
});
