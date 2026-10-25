import type { TodayItem } from '@noodle/core';
import { router } from 'expo-router';

import { FinishSheet } from '@/shared/finish-sheet';

import type { PuzzleFile } from '../../types';
import { useReckonGame } from '../hooks/useReckonGame';
import { serial, type ReckonData } from '../model';
import { useReckonColors } from './colors';
import { ReckonHome } from './ReckonHome';
import { ReckonPlay } from './ReckonPlay';
import { ReckonRecap } from './ReckonRecap';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

function openNext(item: TodayItem | null) {
  if (!item) return back();
  const file = item.path.replace(/^reports\//, '').replace(/\.html$/, '');
  router.replace({ pathname: '/play/[type]/[file]', params: { type: item.type, file } });
}

/** Reckon, played natively: its start screen, the ten questions, the finish sheet. */
export function ReckonScreen({
  file,
  deps,
}: {
  file: PuzzleFile<ReckonData>;
  /** Clocks and stores, for tests. */
  deps?: Parameters<typeof useReckonGame>[1];
}) {
  const c = useReckonColors();
  const { state, info, dispatch, today } = useReckonGame(file, deps);
  if (state.view === 'winModal' && info)
    return (
      <FinishSheet
        type="reckon"
        n={serial(file.data.id)}
        date={file.data.date}
        title="Reckoned"
        hero={`${info.points} pts`}
        note={info.note}
        share={info.share}
        stats={[
          { value: info.time, label: 'time' },
          { value: info.streak, label: 'day streak' },
          { value: info.best, label: 'best score' },
        ]}
        recap={{
          title: 'Today’s ten',
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
      onPlay={() => dispatch({ t: 'play' })}
      onBack={back}
    />
  );
}
