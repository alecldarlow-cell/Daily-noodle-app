import { StartLayout } from '@/shared/start-card';
import { PuzzleTile } from '@/shared/ui';

import type { homeCard } from '../model';

const HOW = [
  'You have 90 seconds. Drag through touching letters, across, up, down or diagonally, to spell a word. Or tap letters one by one and tap the last one again to enter.',
  'Words are three letters or more, and each tile can be used once per word. QU counts as two letters.',
  'A word scores its length minus two: 1 point for three letters, 2 for four, 3 for five, and so on. The board’s longest word scores double.',
  'One round a day, the same board for everyone. A new one arrives at midnight.',
];

interface TangleHomeProps {
  card: ReturnType<typeof homeCard>;
  onPlay: () => void;
  onBack: () => void;
}

/** Tangle's own home card (the page's #home): the day's round to play, resume or view. */
export function TangleHome({ card, onPlay, onBack }: TangleHomeProps) {
  return (
    <StartLayout
      testID="tangle-home"
      title="Tangle"
      dateLine={card.date}
      streak={card.streak >= 1 ? `${card.streak}-day streak` : undefined}
      art={<PuzzleTile type="tangle" />}
      head={card.head}
      status={card.status}
      button={{ label: card.go, onPress: onPlay, testID: 'play-card' }}
      stats={[
        [card.streak, 'day streak'],
        [card.best, 'best score'],
        [card.played, 'Tangles played'],
      ]}
      how={HOW}
      onBack={onBack}
    />
  );
}
