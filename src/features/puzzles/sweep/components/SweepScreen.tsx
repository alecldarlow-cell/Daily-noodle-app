import { useRef, type ComponentRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishLink, FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { WIN_BURSTS, useWinBursts } from '@/shared/motion';
import { houseLine, PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { FONT, usePuzzleTokens } from '@/shared/theme';
import { BOARD_SLOT, fitBoard, pressable, useBoardFit } from '@/shared/ui';
import { useLondonDay } from '@/shared/time';
import { usePlayerExit } from '@/shared/shell';

import type { PuzzleFile } from '../../types';
import { useSweepGame } from '../hooks/useSweepGame';
import { shownCopy } from '../copy';
import { minesLeft, msgText, type SweepData } from '../model';
import { SweepBoard, SweepRecap } from './SweepBoard';

/** The message under the board, its bold parts (the time, the counter) in bold. */
function Message({ msg, color }: { msg: string; color: string }) {
  const parts = msg.split(/<b>|<\/b>/);
  return (
    <Text
      style={[styles.msg, { color }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={msgText(msg) || undefined}
      testID="sweep-msg">
      {parts.map((p, k) =>
        k % 2 ? (
          <Text key={k} style={styles.bold}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

/** Sweep, played natively: start card, board, Dig and Flag, Hint, finish sheet. */
export function SweepScreen({ file }: { file: PuzzleFile<SweepData> }) {
  const { back, next: openNext } = usePlayerExit();
  const pt = usePuzzleTokens();
  const dark = useColorScheme() === 'dark';
  const win = useWindowDimensions();
  const game = useSweepGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  // A fresh win, between the last move and the sheet: the board's wave and the confetti.
  const winning = game.phase === 'play' && !!game.info && game.state.won;
  const boardRef = useRef<ComponentRef<typeof View>>(null);
  useWinBursts(winning, WIN_BURSTS, boardRef);
  const stats = useStartStats('sweep');
  const fit = useBoardFit(fitBoard(win, 330, 460), 460);
  const today = useLondonDay();
  const n = file.n ?? '';
  const { state, dispatch } = game;

  if (game.phase === 'start')
    return (
      <StartCard
        type="sweep"
        n={n}
        date={file.date}
        line={houseLine('sweep')}
        rule={ruleFor('sweep', file.data)}
        stats={stats}
        onPlay={game.play}
        onBack={back}
      />
    );

  if (game.phase === 'finished' && game.info)
    return (
      <FinishSheet
        celebrate={fresh}
        type="sweep"
        path={file.path}
        n={n}
        date={file.date}
        title={game.info.title}
        solved={!game.info.again}
        hero={game.info.hero}
        note={game.info.note}
        share={game.info.share}
        stats={[
          { value: game.info.streak, label: 'day streak' },
          { value: game.info.best, label: 'best streak' },
          { value: game.info.played, label: 'Sweeps played' },
        ]}
        recap={{ title: 'The board', node: <SweepRecap state={state} /> }}
        after={
          game.info.again ? (
            <FinishLink label="Play again (not recorded)" onPress={game.again} />
          ) : undefined
        }
        onBack={back}
        onNext={openNext}
      />
    );

  const left = minesLeft(state);
  const copy = shownCopy(state, file.date < today);
  const modeBtn = (flag: boolean) => {
    const on = state.flagMode === flag;
    const bg = on ? (flag ? pt.active : pt.brand) : pt.card;
    const ink = on ? (flag ? '#141726' : '#fff') : pt.ink;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={flag ? `Flag, ${left} mines left` : 'Dig'}
        accessibilityState={{ selected: on }}
        onPress={() => dispatch({ t: 'mode', flag })}
        testID={flag ? 'sweep-mode-flag' : 'sweep-mode-dig'}
        style={pressable([
          styles.mode,
          { backgroundColor: bg, borderColor: on && !flag ? pt.brand : pt.ink },
        ])}>
        <Text style={[styles.modeText, { color: ink }]}>{flag ? '⚑ Flag' : '⛏ Dig'}</Text>
        {flag ? (
          // The mines-left count rides in the Flag button: a counter with a button's
          // outline invited a pointless tap (Alec, 8 Nov 2026).
          <Text
            style={[
              styles.modeText,
              styles.count,
              left < 0 ? [styles.neg, { backgroundColor: pt.bad }] : { color: ink },
            ]}
            testID="sweep-left">
            {left}
          </Text>
        ) : null}
      </Pressable>
    );
  };
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="sweep-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Sweep ${n}`}
          sub={[file.data.band, copy.rank].filter(Boolean).join(' ')}
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
          <SweepBoard
            celebrating={winning}
            state={state}
            side={fit.side}
            dark={dark}
            onTap={(i) => dispatch({ t: 'tap', i })}
            onPress={(i) => dispatch({ t: 'press', i })}
          />
        </View>
        <View style={styles.modes}>
          {modeBtn(false)}
          {modeBtn(true)}
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch({ t: 'hint' })}
            testID="sweep-hint"
            style={pressable([styles.hint, { borderColor: pt.ink, backgroundColor: pt.card }])}>
            <Text style={[styles.btnText, { color: pt.ink }]}>Hint</Text>
          </Pressable>
        </View>
        <Message msg={copy.msg} color={pt.inkSoft} />
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
  modes: { flexDirection: 'row', gap: 8 },
  mode: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: { fontSize: 15, fontFamily: FONT.display },
  count: { fontVariant: ['tabular-nums'] },
  neg: { color: '#fff', borderRadius: 4, paddingHorizontal: 5, overflow: 'hidden' },
  msg: { fontFamily: FONT.sans, fontSize: 13, lineHeight: 18, textAlign: 'center', minHeight: 18 },
  bold: { fontFamily: FONT.display },
  hint: {
    minHeight: 48,
    minWidth: 76,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnText: { fontSize: 14, fontFamily: FONT.sansMedium },
});
