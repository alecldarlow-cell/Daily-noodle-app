'use no memo';
// React Compiler (app.json experiments.reactCompiler) caches a component while its props are
// unchanged. Tangle hands its screens the engine, one object mutated in place, so a compiled
// screen never redrew: the 3-2-1 count-in froze on 3 on a phone (25 Oct 2026). Jest runs
// without the compiler, so only a device showed it.

import { londonDay } from '@noodle/core';

import { FinishSheet } from '@/shared/finish-sheet';
import { usePuzzleVisit } from '@/shared/results';
import { dayHead, useLondonDay } from '@/shared/time';
import { usePlayerExit } from '@/shared/shell';

import type { PuzzleFile } from '../../types';
import { sheetInfo } from '../finishing';
import { useTangleGame } from '../hooks/useTangleGame';
import { homeCard, type TangleData } from '../model';
import { TangleBoard } from './TangleBoard';
import { TangleHome } from './TangleHome';
import { TangleRecap } from './TangleRecap';

/**
 * The home card with its heading naming the puzzle's day: the model keeps the page's
 * "Today’s Tangle" (the differential replay checks it against tangle.js); the screen
 * says "Yesterday’s Tangle" or "From the archive" on an older board.
 */
export function dayCard<C extends { head: string }>(card: C, date: string, today: string): C {
  return card.head === 'Today’s Tangle' ? { ...card, head: dayHead('Tangle', date, today) } : card;
}

/** Tangle, played natively: its home card, the round, the result. */
export function TangleScreen({ file }: { file: PuzzleFile<TangleData> }) {
  const { back, next: openNext } = usePlayerExit();
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
      card={dayCard(homeCard(engine, day), file.date, day)}
      onPlay={() => {
        start();
        engine.playCard();
      }}
      onBack={back}
    />
  );
}
