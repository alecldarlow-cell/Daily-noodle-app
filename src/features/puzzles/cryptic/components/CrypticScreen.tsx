import { LAB_LABEL, LAB_TYPES, labSaveKey } from '@noodle/core';
import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LabFeedItem } from '@/shared/feed';
import { useFreshFinish } from '@/shared/finish-sheet';
import { LabFinishSheet, LabStartCard, nextTrial, useLabTrials } from '@/shared/lab';
import { openPuzzle, type Opener } from '@/shared/played';
import { usePlayerExit } from '@/shared/shell';
import { PuzzleBar } from '@/shared/start-card';
import { useStoredDocs } from '@/shared/storage';
import { FONT, usePuzzleTokens } from '@/shared/theme';

import type { PuzzleFile } from '../../types';
import { useCrypticGame } from '../hooks/useCrypticGame';
import { crypticNumber, message, type CrypticData } from '../model';
import { CrypticCard, CrypticKeyboard, CrypticRecap, HintButtons, HintPanel } from './CrypticBoard';

/** The open page's line (the site's tools/standfirst.js). */
export const HOUSE_LINE = 'One cryptic clue a day. Find the definition, crack the wordplay.';
/** How to play: the rule sentence, then the guide's paragraphs (engines/house.js). */
const HOW = [
  'One cryptic clue a day. The definition is at the start or the end; the rest is wordplay that builds the same answer.',
  'Every clue is two ways to the same answer: a plain definition at the start or the end, and wordplay (an anagram, a hidden word, a sound-alike…) that builds it letter by letter. Punctuation can be ignored. Type your answer and press Enter: a wrong one just shakes, and costs nothing.',
  'Hint underlines the definition, then names the clue type, then reveals a letter at a time. Your time is the score, with the hints you used beside it. The finish shows how the clue works.',
];

const LAB_KEYS = LAB_TYPES.map(labSaveKey);

const learn = () => router.navigate({ pathname: '/how-to-play', params: { type: 'cryptic' } });

/** Cryptic, played natively: a Lab trial, with the Lab's start card and finish. */
export function CrypticScreen({ file }: { file: PuzzleFile<CrypticData> }) {
  const { back } = usePlayerExit();
  const pt = usePuzzleTokens();
  const win = useWindowDimensions();
  const game = useCrypticGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  const { current } = useLabTrials();
  const docs = useStoredDocs(LAB_KEYS);
  const n = crypticNumber(file.data.id);
  const { state, dispatch } = game;
  const leaving = useRef(false);
  const onKey = useCallback((ch: string) => dispatch({ t: 'type', ch }), [dispatch]);
  const onDelete = useCallback(() => dispatch({ t: 'del' }), [dispatch]);
  const onEnter = useCallback(() => dispatch({ t: 'enter' }), [dispatch]);
  const onSelect = useCallback((i: number) => dispatch({ t: 'select', i }), [dispatch]);

  const isDone = (it: LabFeedItem) => {
    const d = docs[`digi-${it.type}-v1`] as { done?: Record<string, unknown> } | null;
    return !!d?.done?.[it.id];
  };
  const onNext = (it: LabFeedItem) => {
    const go: Opener = (href) => {
      if (leaving.current) return;
      leaving.current = true;
      router.replace(href);
    };
    openPuzzle({ type: it.type, name: LAB_LABEL[it.type], path: it.path }, go);
  };

  if (game.phase === 'start')
    return (
      <LabStartCard
        type="cryptic"
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
        type="cryptic"
        n={n}
        date={file.date}
        path={file.path}
        title="Solved"
        hero={game.info.hero}
        note={game.info.note}
        share={game.info.share}
        recap={{
          title: 'How it works',
          node: <CrypticRecap p={file.data} sol={state.sol} onLearn={learn} />,
        }}
        next={nextTrial(current, 'cryptic', isDone)}
        celebrate={fresh}
        onBack={back}
        onNext={onNext}
      />
    );

  const msg = game.info ? `Solved in ${game.info.hero}.` : message(state);
  const width = Math.min(win.width, 560) - 24;
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="cryptic-screen">
      <View style={styles.in}>
        <PuzzleBar name={`Cryptic ${n}`} sub="Lab" streak={0} clock={game.clock} onBack={back} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <CrypticCard state={state} width={width} onSelect={onSelect} />
          <HintButtons
            state={state}
            onHint={() => dispatch({ t: 'hint' })}
            onClear={() => dispatch({ t: 'clear' })}
          />
          <HintPanel state={state} onLearn={learn} />
          <Text
            style={[styles.msg, { color: pt.inkSoft }]}
            accessibilityLiveRegion="polite"
            testID="cryptic-msg">
            {msg}
          </Text>
        </ScrollView>
        <View style={styles.kbWrap}>
          <CrypticKeyboard onKey={onKey} onDelete={onDelete} onEnter={onEnter} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  in: { flex: 1, paddingHorizontal: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  body: { gap: 12, paddingTop: 12, paddingBottom: 12, flexGrow: 1, justifyContent: 'center' },
  msg: { fontFamily: FONT.sans, fontSize: 14, lineHeight: 19, textAlign: 'center', minHeight: 20 },
  kbWrap: { paddingBottom: 8, paddingTop: 4 },
});
