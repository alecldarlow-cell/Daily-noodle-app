'use no memo';
// React Compiler (app.json experiments.reactCompiler) caches a component while its props are
// unchanged. Tangle hands its screens the engine, one object mutated in place, so a compiled
// screen never redrew: the 3-2-1 count-in froze on 3 on a phone (25 Oct 2026). Jest runs
// without the compiler, so only a device showed it.

import { londonDay, type TodayItem } from '@noodle/core';
import { router } from 'expo-router';

import { FinishSheet } from '@/shared/finish-sheet';
import { usePuzzleVisit } from '@/shared/results';
import { dayHead, useLondonDay } from '@/shared/time';

import type { PuzzleFile } from '../../types';
import { sheetInfo } from '../finishing';
import { useTangleGame } from '../hooks/useTangleGame';
import { homeCard, type TangleData } from '../model';
import { TangleBoard } from './TangleBoard';
import { TangleHome } from './TangleHome';
import { TangleRecap } from './TangleRecap';

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
        celebrate={engine.s.freshResult}
        type="tangle"
        path={file.path}
        n={engine.P.n}
        date={engine.P.date}
        title={f.title}
        hero={`${f.hero.score} ${f.hero.word}`}
        note={f.note}
        share={f.share}
        stats={f.stats}
        recap={{
          title: dayHead('words', file.date, day, 'The words'),
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
