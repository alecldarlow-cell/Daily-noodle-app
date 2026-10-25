import type { TodayItem } from '@noodle/core';
import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishSheet } from '@/shared/finish-sheet';
import { PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { useStoredRaw } from '@/shared/storage';
import { usePuzzleTokens } from '@/shared/theme';

import type { PuzzleFile } from '../../types';
import { useSweepGame } from '../hooks/useSweepGame';
import { minesLeft, msgText, STREAK_KEY, type SweepData } from '../model';
import { SweepArt, SweepBoard, SweepRecap } from './SweepBoard';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

function openNext(item: TodayItem | null) {
  if (!item) return back();
  const file = item.path.replace(/^reports\//, '').replace(/\.html$/, '');
  router.replace({ pathname: '/play/[type]/[file]', params: { type: item.type, file } });
}

/** The bar's flame: the saved streak as stored (the page's refreshStreakUI). */
function savedStreak(raw: string | null): number {
  try {
    const s = JSON.parse(raw ?? 'null') as { streak?: unknown } | null;
    return (s && Number(s.streak)) || 0;
  } catch {
    return 0;
  }
}

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
  const pt = usePuzzleTokens();
  const dark = useColorScheme() === 'dark';
  const { width, height } = useWindowDimensions();
  const game = useSweepGame(file);
  const stats = useStartStats('sweep');
  const streak = savedStreak(useStoredRaw(STREAK_KEY));
  const n = file.n ?? '';
  const { state, dispatch } = game;

  if (game.phase === 'start')
    return (
      <StartCard
        type="sweep"
        n={n}
        date={file.date}
        rule={ruleFor('sweep', file.data)}
        stats={stats}
        art={<SweepArt start={file.data.start} />}
        onPlay={game.play}
        onBack={back}
      />
    );

  if (game.phase === 'finished' && game.info)
    return (
      <FinishSheet
        type="sweep"
        n={n}
        date={file.date}
        title={game.info.title}
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
            <Pressable accessibilityRole="button" onPress={game.again} hitSlop={8}>
              <Text style={[styles.again, { color: pt.inkSoft }]}>Play again (not recorded)</Text>
            </Pressable>
          ) : undefined
        }
        onBack={back}
        onNext={openNext}
      />
    );

  const side = Math.max(200, Math.min(width - 32, height - 330, 460));
  const left = minesLeft(state);
  const modeBtn = (flag: boolean) => {
    const on = state.flagMode === flag;
    const bg = on ? (flag ? pt.active : pt.brand) : pt.card;
    const ink = on ? (flag ? '#141726' : '#fff') : pt.ink;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => dispatch({ t: 'mode', flag })}
        style={[
          styles.mode,
          { backgroundColor: bg, borderColor: on && !flag ? pt.brand : pt.ink },
        ]}>
        <Text style={[styles.modeText, { color: ink }]}>{flag ? '⚑ Flag' : '⛏ Dig'}</Text>
      </Pressable>
    );
  };
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="sweep-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Sweep ${n}`}
          sub={[file.data.band, state.rank].filter(Boolean).join(' ')}
          streak={streak}
          clock={game.clock}
          onBack={back}
        />
        <View style={styles.board}>
          <SweepBoard
            state={state}
            side={side}
            dark={dark}
            onTap={(i) => dispatch({ t: 'tap', i })}
            onPress={(i) => dispatch({ t: 'press', i })}
          />
        </View>
        <View style={styles.modes}>
          {modeBtn(false)}
          {modeBtn(true)}
          <View
            style={[styles.counter, { borderColor: pt.ink, backgroundColor: pt.card }]}
            accessibilityLabel={`Mines left ${left}`}>
            <Text style={[styles.modeText, { color: pt.ink }]}>⚑ </Text>
            <Text
              style={[
                styles.modeText,
                left < 0 ? [styles.neg, { backgroundColor: pt.bad }] : { color: pt.ink },
              ]}
              testID="sweep-left">
              {left}
            </Text>
          </View>
        </View>
        <Message msg={state.msg} color={pt.inkSoft} />
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch({ t: 'hint' })}
            style={[styles.btn, { borderColor: pt.ink, backgroundColor: pt.card }]}>
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
  modes: { flexDirection: 'row', gap: 8 },
  mode: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: { fontSize: 15, fontWeight: '700' },
  counter: {
    minWidth: 74,
    borderWidth: 1.5,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neg: { color: '#fff', borderRadius: 4, paddingHorizontal: 5, overflow: 'hidden' },
  msg: { fontSize: 13, lineHeight: 18, textAlign: 'center', minHeight: 18 },
  bold: { fontWeight: '700' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btn: {
    minHeight: 44,
    minWidth: 88,
    borderWidth: 1.5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  btnText: { fontSize: 14, fontWeight: '500' },
  again: { fontSize: 15, textDecorationLine: 'underline' },
});
