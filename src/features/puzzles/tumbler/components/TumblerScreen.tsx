import { LAB_LABEL } from '@noodle/core';
import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LabFeedItem } from '@/shared/feed';
import { useFreshFinish } from '@/shared/finish-sheet';
import { LabFinishSheet, LabStartCard, nextTrial, useLabTrials } from '@/shared/lab';
import { openPuzzle, type Opener } from '@/shared/played';
import { usePlayerExit } from '@/shared/shell';
import { PuzzleBar } from '@/shared/start-card';
import { useStoredDocs } from '@/shared/storage';
import { FONT, usePuzzleTokens, useTokens } from '@/shared/theme';
import { pressable } from '@/shared/ui';

import type { PuzzleFile } from '../../types';
import { useTumblerGame } from '../hooks/useTumblerGame';
import { tumblerNumber, type TumblerData } from '../model';
import { TryRow, TumblerBoard, TumblerRecap } from './TumblerBoard';

/** The open page's line (the site's tools/standfirst.js). */
export const HOUSE_LINE =
  "Today's word is hidden in four wheels of letters. Give them a spin and close in on it.";
/** How to play: the rule sentence, then the guide's paragraphs (engines/house.js). */
export const HOW = [
  'A four-letter word is hidden in the wheels. Make words on the yellow line and submit them for clues until you find it.',
  'Each wheel holds one letter of the hidden word and six others. Tap a wheel’s arrow, or drag it down, to turn it; wheels only turn down and wrap round. Only the yellow line counts.',
  'Make any real word on the yellow line and Submit it. Green: right letter on the right wheel. Amber: the letter is in the word but belongs to another wheel. Grey: not in the word. Your submits stay listed below. Submit the hidden word to solve it; the clock is the score.',
];

const LAB_KEYS = ['digi-tilt-v1', 'digi-redact-v1', 'digi-tumbler-v1'];

/** Tumbler, played natively: a Lab trial, with the Lab's start card and finish. */
export function TumblerScreen({ file }: { file: PuzzleFile<TumblerData> }) {
  const { back } = usePlayerExit();
  const pt = usePuzzleTokens();
  const t = useTokens();
  const win = useWindowDimensions();
  const game = useTumblerGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  const { current } = useLabTrials();
  const docs = useStoredDocs(LAB_KEYS);
  const n = tumblerNumber(file.data.id);
  const { state, dispatch } = game;
  const leaving = useRef(false);
  const onTurn = useCallback((k: number) => dispatch({ t: 'turn', k }), [dispatch]);

  const isDone = (it: LabFeedItem) => {
    const d = docs[`digi-${it.type}-v1`] as { done?: Record<string, unknown> } | null;
    return !!d?.done?.[it.id];
  };
  /** The next trial swaps in for this one, as a daily's Play next does. */
  const onNext = (it: LabFeedItem) => {
    const go: Opener = (href) => {
      if (leaving.current) return;
      leaving.current = true;
      router.replace(href);
    };
    openPuzzle({ type: it.type, name: LAB_LABEL[it.type], path: it.path }, null, go);
  };

  if (game.phase === 'start')
    return (
      <LabStartCard
        type="tumbler"
        n={n}
        date={file.date}
        line={HOUSE_LINE}
        how={HOW}
        played={game.played}
        resume={
          game.resumed
            ? { head: 'Part-played', status: 'Carrying on where you left off.' }
            : undefined
        }
        onPlay={game.play}
        onBack={back}
      />
    );

  if (game.phase === 'finished' && game.info)
    return (
      <LabFinishSheet
        type="tumbler"
        n={n}
        date={file.date}
        path={file.path}
        title="Solved"
        hero={game.info.hero}
        note={game.info.note}
        share={game.info.share}
        recap={{
          title: 'The word',
          sub: 'And the submits that found it.',
          node: <TumblerRecap secret={file.data.secret} tries={game.info.tries} />,
        }}
        next={nextTrial(current, 'tumbler', isDone)}
        celebrate={fresh}
        onBack={back}
        onNext={onNext}
      />
    );

  const msg = game.info ? `Solved in ${game.info.hero}.` : state.msg;
  const width = Math.min(win.width, 520) - 24;
  const total = state.tries.length;
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="tumbler-screen">
      <View style={styles.in}>
        <PuzzleBar name={`Tumbler ${n}`} sub="Lab" streak={0} clock={game.clock} onBack={back} />
        <ScrollView contentContainerStyle={styles.body}>
          <TumblerBoard state={state} width={width} won={state.solved} onTurn={onTurn} />
          <Pressable
            accessibilityRole="button"
            disabled={state.solved}
            onPress={() => dispatch({ t: 'submit' })}
            style={pressable([styles.submit, { backgroundColor: t.accent }])}
            testID="tumbler-submit">
            <Text style={[styles.submitText, { color: t.onAccent }]}>Submit</Text>
          </Pressable>
          <Text
            style={[styles.msg, { color: pt.inkSoft }]}
            accessibilityLiveRegion="polite"
            testID="tumbler-msg">
            {msg}
          </Text>
          <View style={styles.tries} testID="tumbler-tries">
            {state.tries
              .slice()
              .reverse()
              .map((w, j) => (
                <TryRow key={w} word={w} secret={file.data.secret} label={`submit ${total - j}`} />
              ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  in: { flex: 1, paddingHorizontal: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  body: { gap: 12, paddingTop: 8, paddingBottom: 24, alignItems: 'stretch' },
  submit: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 40,
  },
  submitText: { fontFamily: FONT.sansSemi, fontSize: 16 },
  msg: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 19, textAlign: 'center', minHeight: 20 },
  tries: { gap: 6 },
});
