import { boldLead, FinishSheet, useFreshFinish } from '@/shared/finish-sheet';
import { dayHead } from '@/shared/time';
import { usePuzzleVisit } from '@/shared/results';
import { usePlayerExit } from '@/shared/shell';

import type { PuzzleFile } from '../../types';
import { useReckonGame } from '../hooks/useReckonGame';
import { serial, type ReckonData } from '../model';
import { useReckonColors } from './colors';
import { ReckonHome } from './ReckonHome';
import { ReckonPlay } from './ReckonPlay';
import { ReckonRecap } from './ReckonRecap';

/** Reckon, played natively: its start screen, the ten questions, the finish sheet. */
export function ReckonScreen({
  file,
  deps,
}: {
  file: PuzzleFile<ReckonData>;
  /** Clocks and stores, for tests. */
  deps?: Parameters<typeof useReckonGame>[1];
}) {
  const { back, next: openNext } = usePlayerExit();
  const c = useReckonColors();
  const { state, info, dispatch, today } = useReckonGame(file, deps);
  const fresh = useFreshFinish(state.view === 'winModal' && !!info);
  // Play on the home card is the page's #playCard: a start, unless today's round is done.
  const start = usePuzzleVisit(file.path, 'reckon', !!state.save.done[state.P.id]);
  if (state.view === 'winModal' && info)
    return (
      <FinishSheet
        celebrate={fresh}
        type="reckon"
        path={file.path}
        n={serial(file.data.id)}
        date={file.data.date}
        title="Reckoned"
        hero={`${info.points} pts`}
        note={info.note ? boldLead(info.note) : undefined}
        share={info.share}
        stats={[
          { value: info.time, label: 'time' },
          { value: info.streak, label: 'day streak' },
          { value: info.best, label: 'best score' },
        ]}
        recap={{
          title: dayHead('ten', file.date, today, 'The ten'),
          sub: 'Tap one to see it on the scale.',
          node: <ReckonRecap info={info} c={c} onRow={(k) => dispatch({ t: 'recap', k })} />,
        }}
        onBack={back}
        onNext={openNext}
      />
    );
  if (state.view === 'play') return <ReckonPlay state={state} c={c} dispatch={dispatch} />;
  return (
    <ReckonHome
      state={state}
      today={today}
      c={c}
      onPlay={() => {
        start();
        dispatch({ t: 'play' });
      }}
      onBack={back}
    />
  );
}
