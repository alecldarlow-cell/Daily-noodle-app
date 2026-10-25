import type { GridStreakType } from '@noodle/core';
import type { ReactNode } from 'react';

import { longDate } from '@/shared/time';

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
  /** A small picture of the board (house.js art). */
  art?: ReactNode;
  onPlay: () => void;
  onBack: () => void;
}

/**
 * The card before a grid puzzle you haven't finished (engines/house.js, approved 18 Oct
 * 2026): back to Puzzles and your streak, the name and date, today's rule with Play,
 * your three numbers, and How to play.
 */
export function StartCard({ type, n, date, rule, stats, art, onPlay, onBack }: StartCardProps) {
  const name = nameOf(type);
  return (
    <StartLayout
      testID="start-card"
      title={name}
      dateLine={`No. ${n}, ${longDate(date)}`}
      streak={stats.streak >= 1 ? `${stats.streak}-day streak` : undefined}
      art={art}
      head={`Today’s ${name}`}
      status={rule}
      button={{ label: 'Play', onPress: onPlay }}
      stats={[
        [stats.streak, 'day streak'],
        [stats.best, 'best streak'],
        [stats.played, `${name}s played`],
      ]}
      how={HOW[type]}
      onBack={onBack}
    />
  );
}
