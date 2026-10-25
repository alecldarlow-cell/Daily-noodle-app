import { londonDay, type TodayItem } from '@noodle/core';
import { router } from 'expo-router';

import { FinishSheet } from '@/shared/finish-sheet';
import { usePuzzleVisit } from '@/shared/results';
import { useLondonDay } from '@/shared/time';

import type { PuzzleFile } from '../../types';
import { noteText, sheetInfo } from '../finishing';
import { useTangleGame } from '../hooks/useTangleGame';
import { homeCard, type TangleData } from '../model';
import { TangleBoard } from './TangleBoard';
import { TangleHome } from './TangleHome';
import { TangleRecap, TangleScore } from './TangleRecap';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

function openNext(item: TodayItem | null) {
  if (!item) return back();
  const file = item.path.replace(/^reports\//, '').replace(/\.html$/, '');
  router.replace({ pathname: '/play/[type]/[file]', params: { type: item.type, file } });
}

/** Tangle, played natively: its home card, the round, the result. */
export function TangleScreen({ file }: { file: PuzzleFile<TangleData> }) {
  const { engine, setRects } = useTangleGame(file);
  const day = useLondonDay();
  // The home card's Play is the page's #playCard: a start, unless today's round is done.
  const start = usePuzzleVisit(file.path, 'tangle', engine.s.D.state === 'done');
  const view = engine.s.view;

  if (view === 'play')
    return <TangleBoard engine={engine} setRects={setRects} onHome={() => engine.home()} />;

  if (view === 'winModal') {
    const f = sheetInfo(engine, londonDay());
    return (
      <FinishSheet
        type="tangle"
        n={engine.P.n}
        date={engine.P.date}
        title={f.title}
        hero={`${f.hero.score} ${f.hero.word}`}
        heroNode={<TangleScore score={f.hero.score} word={f.hero.word} />}
        note={noteText(f.note)}
        share={f.share}
        stats={f.stats}
        recap={{
          title: 'Today’s words',
          node: <TangleRecap r={f.recap} />,
        }}
        onBack={back}
        onNext={openNext}
      />
    );
  }

  return (
    <TangleHome
      card={homeCard(engine, day)}
      onPlay={() => {
        start();
        engine.playCard();
      }}
      onBack={back}
    />
  );
}
