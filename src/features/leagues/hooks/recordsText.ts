/** The Records pill's words and orderings, as board.html writes them (renderRecords, renderCard). */
import { BOARD_TYPES, type BoardTypeId } from '@noodle/core';

import type { LeagueRecord, Records, RecordsPlayer } from '../types';

type HonourKey = 'longest' | 'current' | 'wins' | 'titles' | 'perfect' | 'sweeps' | 'completed';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** The seven honours, in the site's order. Streaks are counted in days. */
export const HONOURS: { k: HonourKey; e: string; name: string; unit: (n: number) => string }[] = [
  { k: 'longest', e: '🔥', name: 'Longest streak', unit: days },
  { k: 'current', e: '🔥', name: 'Current streak', unit: days },
  { k: 'wins', e: '🥇', name: 'Daily wins', unit: String },
  { k: 'titles', e: '👑', name: 'Weekly titles', unit: String },
  { k: 'perfect', e: '⭐', name: 'Perfect days', unit: String },
  { k: 'sweeps', e: '🧹', name: 'Clean sweeps', unit: String },
  { k: 'completed', e: '📚', name: 'Puzzles finished', unit: String },
];

/** Each puzzle that has a record, in pill order. */
export function recordRows(
  d: Records,
): { type: BoardTypeId; emoji: string; name: string; r: LeagueRecord }[] {
  return BOARD_TYPES.flatMap((t) => {
    const r = d.records?.[t.id as BoardTypeId];
    return r ? [{ type: t.id as BoardTypeId, emoji: t.emoji, name: t.name, r }] : [];
  });
}

/** Who leads an honour, and the figure; nobody while the top figure is 0. */
export function leaders(
  players: readonly RecordsPlayer[],
  k: HonourKey,
): { top: number; who: string[] } {
  const top = Math.max(0, ...players.map((p) => p[k] || 0));
  return { top, who: top > 0 ? players.filter((p) => p[k] === top).map((p) => p.nick) : [] };
}

/** Players by puzzles finished, most first (joining order on a tie). */
export const byFinished = (players: readonly RecordsPlayer[]) =>
  players.slice().sort((a, b) => b.completed - a.completed);

/** The rank mark in the Players list: titles, else wins, else a dot. */
export const playerMark = (p: RecordsPlayer) => (p.titles ? '👑' : p.wins ? '🥇' : '·');

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "3 wins · 1 title · best streak 9" */
export const playerLine = (p: RecordsPlayer) =>
  `${plural(p.wins, 'win')} · ${plural(p.titles, 'title')} · best streak ${p.longest}`;

export const isCrowned = (d: Records | undefined, nick: string) => !!d?.crown?.includes(nick);

export const RECORDS_HOW =
  'Records count finished puzzles only; on a tie, whoever set it first keeps it. A daily win needs at least one ' +
  'other player to have finished that puzzle, and a weekly title (the All puzzles week) at least two players. A perfect day is every ' +
  'puzzle that day finished; a clean sweep is a perfect day winning all of them. A streak is days in a row with a puzzle finished. ' +
  '👑 marks last week’s champion. Tap a name to see their card.';
