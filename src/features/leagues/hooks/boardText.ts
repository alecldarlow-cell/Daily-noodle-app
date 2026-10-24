/** The board's words and numbers, as board.html writes them. */
import { BOARD_TYPE, dayBefore, type BoardTypeId } from '@noodle/core';

import { shortDate } from '@/shared/time';

import type { DayRow, OverallRow, PuzzleCard } from '../types';

/** Invite links carry the link-preview version (board.html PREVIEW_V). */
export const PREVIEW_V = '2';

export function inviteLink(code: string): string {
  return `https://dailynoodle.co.uk/board.html?join=${encodeURIComponent(code)}&v=${PREVIEW_V}`;
}

export function inviteText(name: string): string {
  return `Join ${name} on Noodle Puzzles: tap the link, pick a nickname, and your results go on our daily leaderboards.`;
}

export const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Today", "Yesterday" or "Thu 22 Oct". */
export function dayName(iso: string, today: string): string {
  return iso === today ? 'Today' : iso === dayBefore(today) ? 'Yesterday' : shortDate(iso);
}

/** Seconds as m:ss (h:mm:ss from an hour). */
export function mmss(s: number | null | undefined): string {
  if (s == null) return '';
  const x = Math.round(s);
  const h = Math.floor(x / 3600);
  const m = Math.floor((x % 3600) / 60);
  const sec = x % 60;
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}`;
}

const SCORED = new Set<BoardTypeId>(['tangle', 'borders', 'reckon']);

/** A row's result: the big figure and the small line under it. */
export function result(t: BoardTypeId, r: DayRow): { big: string; small: string } {
  if (SCORED.has(t))
    return { big: `${r.score == null ? '–' : r.score} pts`, small: r.secs ? mmss(r.secs) : '' };
  if (r.outcome === 'failed')
    return { big: t === 'link' ? 'Out of guesses' : 'Didn’t finish', small: '' };
  if (r.outcome === 'revealed') return { big: 'Revealed', small: '' };
  const small =
    t === 'link' ? (r.mistakes === 1 ? '1 mistake' : `${r.mistakes || 0} mistakes`) : '';
  return { big: mmss(r.secs), small };
}

export const pts = (n: number) => `${n}${n === 1 ? ' pt' : ' pts'}`;

/** "19 Oct – 25 Oct" */
export function weekLabel(from: string, to: string): string {
  const dm = (iso: string) => shortDate(iso).split(' ').slice(1).join(' ');
  return `${dm(from)} – ${dm(to)}`;
}

/** Puzzles so far this week: 8 a day, up to the chosen day. */
export function weekDays(date: string, weekFrom: string): number {
  const n =
    Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${weekFrom}T12:00:00Z`)) / 864e5) + 1;
  return 8 * Math.max(1, Math.min(7, n));
}

/** The puzzle of a type on a day, from the site's cards. */
export function puzzleOn(
  cards: readonly PuzzleCard[] | undefined,
  type: BoardTypeId,
  date: string,
) {
  return (cards || []).find((c) => c.type === type && c.date === date) ?? null;
}

/** "Share leaderboard" for one puzzle: the top five, then the league's link. */
export function shareDay(
  t: BoardTypeId,
  headline: string | null,
  date: string,
  ranked: DayRow[],
  league: { name: string; code: string },
): string {
  const T = BOARD_TYPE[t];
  const lines = [`🏆 ${T.emoji} ${headline ?? T.name} · ${shortDate(date)}`];
  for (const r of ranked.slice(0, 5)) {
    const res = result(t, r);
    lines.push(
      `${MEDAL[r.rank!] ?? `${r.rank}.`} ${r.nick} ${res.big}${res.small ? ` (${res.small})` : ''}`,
    );
  }
  if (ranked.length > 5) lines.push(`+${ranked.length - 5} more`);
  lines.push(`${league.name} leaderboard:`);
  return `${lines.join('\n')}\n${inviteLink(league.code)}&p=${t}&d=${date}`;
}

/** "Share leaderboard" for All puzzles. */
export function shareAll(
  date: string,
  day: OverallRow[],
  league: { name: string; code: string },
): string {
  const lines = [`🏆 All puzzles · ${shortDate(date)}`];
  for (const r of day.slice(0, 5))
    lines.push(`${MEDAL[r.rank] ?? `${r.rank}.`} ${r.nick} ${pts(r.points)} (${r.completed}/8)`);
  if (day.length > 5) lines.push(`+${day.length - 5} more`);
  lines.push(`${league.name} leaderboard:`);
  return `${lines.join('\n')}\n${inviteLink(league.code)}&p=all&d=${date}`;
}
