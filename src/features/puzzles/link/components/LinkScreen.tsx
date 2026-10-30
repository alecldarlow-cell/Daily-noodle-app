import { dnNum, dnTime } from '@noodle/core';
import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { LINK_BURSTS, useWinBursts } from '@/shared/motion';
import { PuzzleBar, ruleFor, StartCard, useStartStats } from '@/shared/start-card';
import { usePuzzleTokens } from '@/shared/theme';
import { usePlayerExit } from '@/shared/shell';

import type { PuzzleFile } from '../../types';
import { useLinkGame } from '../hooks/useLinkGame';
import { groupsByRank, shownLabel, timerText, type LinkData } from '../model';
import { LinkBoard } from './LinkBoard';
import { GroupBands, GuessSquares, LinkArt, PlayAgain } from './LinkParts';

/** engines/link.js resumeCard: how many groups a kept round had found. */
const FOUND = ['No groups', 'One group', 'Two groups', 'Three groups'];

/** Link, played natively: start card, board, finish sheet. */
export function LinkScreen({ file }: { file: PuzzleFile<LinkData> }) {
  const { back, next: openNext } = usePlayerExit();
  const pt = usePuzzleTokens();
  const game = useLinkGame(file);
  const fresh = useFreshFinish(game.phase === 'finished');
  // A fresh win, between the last move and the sheet: the board's wave and the confetti.
  const winning = game.phase === 'play' && !!game.info?.won;
  const boardRef = useRef<ComponentRef<typeof View>>(null);
  useWinBursts(winning, LINK_BURSTS, boardRef);
  // The bar's flame is Link's own streak, the number its start card shows (alive or 0).
  const stats = useStartStats('link');
  const n = dnNum(file.data.id).slice(1);
  const { state, dispatch } = game;

  if (game.phase === 'start')
    return (
      <StartCard
        type="link"
        n={n}
        date={file.date}
        rule={ruleFor('link', {})}
        stats={stats}
        art={<LinkArt />}
        resume={
          game.resumed
            ? {
                head: 'Today’s Link, part-played',
                status: `Paused at ${dnTime(timerText(game.resumed.secs))}. ${FOUND[game.resumed.found] ?? ''} found so far; your clock carries on from there.`,
              }
            : undefined
        }
        onPlay={game.play}
        onBack={back}
      />
    );

  if (game.phase === 'finished' && game.info) {
    const f = game.info;
    const names = f.squares.map((r) =>
      r ? (state.p.groups.find((g) => g.rank === r)?.name ?? '') : 'a miss',
    );
    return (
      <FinishSheet
        celebrate={fresh}
        type="link"
        path={file.path}
        n={n}
        date={file.date}
        title={f.title}
        solved={f.won}
        hero={names.join(', ')}
        heroNode={<GuessSquares squares={f.squares} names={names} />}
        note={f.note}
        share={f.share}
        stats={[
          { value: f.time, label: 'time' },
          { value: f.streak, label: 'day streak' },
          { value: f.best, label: 'best streak' },
        ]}
        recap={{
          title: 'The groups',
          sub: 'Easiest to hardest',
          node: <GroupBands groups={groupsByRank(state.p)} />,
        }}
        after={f.won ? undefined : <PlayAgain onPress={() => dispatch({ t: 'again' })} />}
        onBack={back}
        onNext={openNext}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: pt.paper }]} testID="link-screen">
      <View style={styles.in}>
        <PuzzleBar
          name={`Link ${n}`}
          sub={`${file.data.band}${shownLabel(state, game.past) ? ' · replay' : ''}`}
          streak={stats.streak}
          clock={game.clock}
          waiting={game.waiting}
          onBack={back}
        />
        <LinkBoard state={state} dispatch={dispatch} past={game.past} />
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
    gap: 12,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
});
