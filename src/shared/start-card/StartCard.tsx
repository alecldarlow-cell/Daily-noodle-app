import type { GridStreakType } from '@noodle/core';

import { longDate, startHead, useLondonDay } from '@/shared/time';
import { PuzzleTile } from '@/shared/ui';

import { HOW, nameOf } from './copy';
import { StartLayout } from './StartLayout';
import type { StartStats } from './stats';

interface StartCardProps {
  type: GridStreakType;
  /** The player number ("105"). */
  n: number | string;
  /** The puzzle's day, YYYY-MM-DD. */
  date: string;
  rule: string;
  stats: StartStats;
  /**
   * A round kept part-way (Link, engines/link.js resumeCard): the card reads "Part-played",
   * says where it was paused, and its button is Resume.
   */
  resume?: { head: string; status: string };
  onPlay: () => void;
  onBack: () => void;
}

/**
 * The card before a grid puzzle you haven't finished (engines/house.js): back to Puzzles,
 * the type's icon, the name and date, today's rule with Play,
 * your three numbers, and How to play.
 */
export function StartCard(props: StartCardProps) {
  const { type, n, date, rule, stats, resume, onPlay, onBack } = props;
  const name = nameOf(type);
  const today = useLondonDay();
  return (
    <StartLayout
      testID="start-card"
      title={name}
      dateLine={`No. ${n}, ${longDate(date)}`}
      art={<PuzzleTile type={type} size={132} />}
      head={resume?.head ?? startHead(name, date, today)}
      status={resume?.status ?? rule}
      button={{ label: resume ? 'Resume' : 'Play', onPress: onPlay }}
      stats={[
        [stats.streak, `${name} streak`],
        [stats.best, 'best streak'],
        [stats.played, type === 'tally' ? 'boards played' : `${name}s played`],
      ]}
      how={HOW[type]}
      onBack={onBack}
    />
  );
}
