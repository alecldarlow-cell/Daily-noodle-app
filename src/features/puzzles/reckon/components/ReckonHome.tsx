import { dayBefore } from '@noodle/core';

import { StartLayout } from '@/shared/start-card';
import { useTokens } from '@/shared/theme';
import { PuzzleTile } from '@/shared/ui';
import { dayHead, longDate } from '@/shared/time';

import { homeView, rulesText, serial, type ReckonState } from '../model';
import type { ReckonColors } from './colors';

const HOW = [
  'Drag the marker along the scale to guess, nudge it with − and +, then Lock in. Each big mark on the scale is ten times the last.',
  'Within 15% of the answer scores 100; within 30%, 75; within 60%, 50; within three times either way, 25. Gaps are measured from the smaller number, so half the answer scores the same as double it.',
  'Ten questions, the same for everyone, one go a day. Figures are rounded; dated ones say when they’re from.',
];

interface Props {
  state: ReckonState;
  today: string;
  c: ReckonColors;
  onPlay: () => void;
  onBack: () => void;
}

/** Reckon's start screen (the page's #home, filled by renderHome). */
export function ReckonHome({ state, today, c, onPlay, onBack }: Props) {
  const h = homeView(state, today, dayBefore);
  const t = useTokens();
  return (
    <StartLayout
      testID="reckon-home"
      title="Reckon"
      dateLine={`No. ${serial(state.P.id)}, ${longDate(state.P.date)}`}
      art={<PuzzleTile type="reckon" size={132} />}
      head={dayHead('ten', state.P.date, today)}
      status={h.status}
      statusTestID="reckon-status"
      button={{ label: h.button, onPress: onPlay, testID: 'reckon-play-button' }}
      stats={[
        [h.stats[0]!, 'Reckon streak'],
        [h.stats[1]!, 'best score'],
        [h.stats[2]!, 'Reckons played'],
      ]}
      how={rulesText(state.P) ? [HOW[0]!, rulesText(state.P)!, HOW[2]!] : HOW}
      colors={{
        bg: c.bg,
        card: c.paper,
        ink: c.ink,
        inkSoft: c.ink2,
        line: c.line,
        pill: t.accent,
        onPill: t.onAccent,
      }}
      onBack={onBack}
    />
  );
}
