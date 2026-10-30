import type { GridStreakType } from '@noodle/core';
import type { ReactNode } from 'react';

import { dayHead, longDate, useLondonDay } from '@/shared/time';

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
  /**
   * A round kept part-way (Link, engines/link.js resumeCard): the card reads "Today’s Link,
   * part-played", says where it was paused, and its button is Resume.
   */
  resume?: { head: string; status: string };
  onPlay: () => void;
  onBack: () => void;
}

/**
 * The card before a grid puzzle you haven't finished (engines/house.js, approved 18 Oct
 * 2026): back to Puzzles and your streak, the name and date, today's rule with Play,
 * your three numbers, and How to play.
 */
export function StartCard(props: StartCardProps) {
  const { type, n, date, rule, stats, art, resume, onPlay, onBack } = props;
  const name = nameOf(type);
  const today = useLondonDay();
  return (
    <StartLayout
      testID="start-card"
      title={name}
      dateLine={`No. ${n}, ${longDate(date)}`}
      streak={stats.streak >= 1 ? `${stats.streak}-day streak` : undefined}
      art={art}
      head={resume?.head ?? dayHead(name, date, today)}
      status={resume?.status ?? rule}
      button={{ label: resume ? 'Resume' : 'Play', onPress: onPlay }}
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
