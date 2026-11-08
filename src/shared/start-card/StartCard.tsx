import type { GridStreakType } from '@noodle/core';

import { longDate, startHead, useLondonDay } from '@/shared/time';
import { PuzzleTile } from '@/shared/ui';

import { HOW, houseLine, nameOf } from './copy';
import { StartLayout } from './StartLayout';
import type { StartStats } from './stats';

interface StartCardProps {
  type: GridStreakType;
  /** The player number ("105"). */
  n: number | string;
  /** The puzzle's day, YYYY-MM-DD. */
  date: string;
  /** The open page's line: the type's house line (houseLine; Link passes its data for the trap count). */
  line?: string;
  /** The rule sentence (ruleFor), the first paragraph of How to play. */
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
 * the type's icon, the name and date, the house line with Play,
 * your three numbers, and How to play led by the rule (Alec, 8 Nov 2026).
 */
export function StartCard(props: StartCardProps) {
  const { type, n, date, line, rule, stats, resume, onPlay, onBack } = props;
  const name = nameOf(type);
  const today = useLondonDay();
  return (
    <StartLayout
      testID="start-card"
      title={name}
      dateLine={`No. ${n}, ${longDate(date)}`}
      art={<PuzzleTile type={type} size={132} />}
      head={resume?.head ?? startHead(name, date, today)}
      status={resume?.status ?? line ?? houseLine(type)}
      button={{ label: resume ? 'Resume' : 'Play', onPress: onPlay }}
      stats={[
        [stats.streak, `${name} streak`],
        [stats.best, 'best streak'],
        [stats.played, type === 'tally' ? 'boards played' : `${name}s played`],
      ]}
      how={[rule, ...HOW[type]]}
      onBack={onBack}
    />
  );
}
