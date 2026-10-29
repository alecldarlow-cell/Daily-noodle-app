/** The board's words and numbers, as board.html writes them. */
import { BOARD_TYPE, dayBefore, type BoardTypeId } from '@noodle/core';

import { shortDate } from '@/shared/time';

import type { DayRow, Outcome, OverallRow, PuzzleCard, RecordResult } from '../types';

/** Board links carry the link-preview version (board.html PREVIEW_V). */
export const PREVIEW_V = '2';

/** A league's board on the website, as leaderboard shares link it (board.html's invite link). */
export function boardLink(code: string): string {
  return `https://dailynoodle.co.uk/board.html?join=${encodeURIComponent(code)}&v=${PREVIEW_V}`;
}

/**
 * The app's invite link (site SITE.md › App links): Android opens it in the app; a browser goes
 * on from join.html to board.html?join=CODE&v=2, as the website's own invite.
 */
export function inviteLink(code: string): string {
  return `https://dailynoodle.co.uk/join.html?c=${encodeURIComponent(code)}`;
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

/** A row's result: the big figure and the small line under it. Records carry no outcome: finished. */
export function result(
  t: BoardTypeId,
  r: Pick<RecordResult, 'secs' | 'score' | 'mistakes'> & { outcome?: Outcome },
): { big: string; small: string } {
  // Tangle is a fixed 90-second round, so its time says nothing: points only (AF-025).
  if (SCORED.has(t))
    return {
      big: `${r.score == null ? '–' : r.score} pts`,
      small: t !== 'tangle' && r.secs ? mmss(r.secs) : '',
    };
  if (r.outcome === 'failed')
    return { big: t === 'link' ? 'Out of guesses' : 'Didn’t finish', small: '' };
  if (r.outcome === 'revealed') return { big: 'Revealed', small: '' };
  const small =
    t === 'link' ? (r.mistakes === 1 ? '1 mistake' : `${r.mistakes || 0} mistakes`) : '';
  return { big: mmss(r.secs), small };
}

/** "18 Oct", as the records write a day. */
export const dayMonth = (iso: string) => shortDate(iso).split(' ').slice(1).join(' ');

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
  return `${lines.join('\n')}\n${boardLink(league.code)}&p=${t}&d=${date}`;
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
  return `${lines.join('\n')}\n${boardLink(league.code)}&p=all&d=${date}`;
}

/**
 * The finish sheet's line about a result once it's on the board (dn-board.js showMoment):
 * a league record ("New" on the puzzle's own London day), else a personal best, else none.
 */
export function momentLine(
  m: { pb?: boolean; records?: readonly { name: string }[] | null } | null | undefined,
  typeName: string,
  fresh: boolean,
): { text: string; record: boolean } | null {
  if (!m) return null;
  if (m.records && m.records.length)
    return {
      text: `🏆 ${fresh ? 'New league record' : 'League record'} in ${m.records.map((l) => l.name).join(', ')}!`,
      record: true,
    };
  if (m.pb)
    return {
      text: `⭐ ${fresh ? 'New personal best' : 'Your personal best'} at ${typeName}!`,
      record: false,
    };
  return null;
}
