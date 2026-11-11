import { LAB_LABEL, type LabType } from '@noodle/core';

import { StartLayout } from '@/shared/start-card';
import { longDate, startHead, useLondonDay } from '@/shared/time';
import { PuzzleTile } from '@/shared/ui';

interface LabStartCardProps {
  type: LabType;
  n: number | string;
  /** The puzzle's day, YYYY-MM-DD. */
  date: string;
  /** The open page's line: the type's house line (the site's tools/standfirst.js). */
  line: string;
  /** How to play: the rule sentence first, then the type's paragraphs (engines/house.js). */
  how: readonly string[];
  /** Puzzles of this type finished on this phone. */
  played: number;
  /** A round kept part-way: the card says so and its button is Resume. */
  resume?: { head: string; status: string };
  onPlay: () => void;
  onBack: () => void;
}

/**
 * The card before a Lab puzzle: the house start card with the Lab's place made plain. No
 * streak numbers (a trial isn't in your streaks): only how many you've played.
 */
export function LabStartCard(props: LabStartCardProps) {
  const { type, n, date, line, how, played, resume, onPlay, onBack } = props;
  const name = LAB_LABEL[type];
  const today = useLondonDay();
  return (
    <StartLayout
      testID="lab-start"
      title={name}
      dateLine={`Lab trial No. ${n}, ${longDate(date)}`}
      art={<PuzzleTile type={type} size={132} />}
      head={resume?.head ?? startHead(name, date, today)}
      status={resume?.status ?? line}
      button={{ label: resume ? 'Resume' : 'Play', onPress: onPlay }}
      stats={[[played, `${name}s played`]]}
      how={[...how, 'This is a Lab trial: tell us at the end whether it should go daily.']}
      onBack={onBack}
    />
  );
}
