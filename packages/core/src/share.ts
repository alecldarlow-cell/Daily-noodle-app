/**
 * Share lines, character for character as the site's players write them
 * (engines/*.js dnTime, dnStreak, dnNum, dnSweepDay, dnSweep, dnLink, and the
 * Tangle, Borders and Reckon shareText). The finish sheet sends the line, a newline,
 * then `dailynoodle.co.uk/<type>`.
 */
import type { PuzzleType } from './ids';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A timer's text with leading zeros dropped: "01:27" → "1:27". */
export function dnTime(t: unknown): string {
  return String(t || '')
    .trim()
    .replace(/^0+(\d)/, '$1');
}

/** " · 🔥n" for a streak of 2 or more, else nothing. Accepts the streak as shown. */
export function dnStreak(n: unknown): string {
  const v = parseInt(String(n || '').replace(/\D/g, ''), 10) || 0;
  return v >= 2 ? ` · 🔥${v}` : '';
}

/** "#105" from "DP·MINI·0105"; empty when the id has no number. */
export function dnNum(id: string): string {
  const n = parseInt(String(id).split('·').pop() ?? '', 10);
  return Number.isNaN(n) ? '' : `#${n}`;
}

/** Sweep's day from its id: "DP·SWEEP·2026-10-13" → "13 Oct". */
export function dnSweepDay(id: string): string {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(id));
  return m ? `${+m[3]!} ${MONTHS[+m[2]! - 1]}` : dnNum(id);
}

export function shareMini(id: string, time: string, streak: unknown): string {
  return `✏️ Mini ${dnNum(id)} — ${dnTime(time)}${dnStreak(streak)}`;
}
export function shareDoku(id: string, time: string, streak: unknown): string {
  return `🔢 Doku ${dnNum(id)} — ${dnTime(time)}${dnStreak(streak)}`;
}
export function sharePath(id: string, time: string, streak: unknown): string {
  return `〰️ Path ${dnNum(id)} — ${dnTime(time)}${dnStreak(streak)}`;
}

/** Sweep: "win" swept in a time, "loss" boom, anything else revealed. */
export function shareSweep(outcome: string, time: string, streak: unknown, id: string): string {
  const d = dnSweepDay(id);
  if (outcome === 'win') return `💣 Sweep ${d} — swept in ${dnTime(time)}${dnStreak(streak)}`;
  if (outcome === 'loss') return `💥 Sweep ${d} — boom`;
  return `💣 Sweep ${d} — revealed`;
}

const LINK_GLYPH: Record<number, string> = { 1: '🟩', 2: '🟦', 3: '🟨', 4: '⬛' };

/** One square per guess: the rank's colour when all four tiles share a rank, else ❌. */
export function linkRow(guesses: unknown): string {
  return (Array.isArray(guesses) ? guesses : [])
    .filter((x): x is number[] => Array.isArray(x) && x.length === 4)
    .map((x) => (x.every((v) => v === x[0]) && LINK_GLYPH[x[0]!] ? LINK_GLYPH[x[0]!] : '❌'))
    .join('');
}

export function shareLink(
  guesses: unknown,
  won: boolean,
  time: string,
  streak: unknown,
  id: string,
): string {
  return `🔗 Link ${dnNum(id)} — ${linkRow(guesses)}${won ? ` · ${dnTime(time)}` : ''}${won ? dnStreak(streak) : ''}`;
}

const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;

/** Tangle: no streak, a ★ when the board's longest word was found. */
export function shareTangle(n: number, score: number, words: number, star: boolean): string {
  return `🧶 Tangle #${n} — ${plural(score, 'point', 'points')}, ${plural(words, 'word', 'words')}${star ? ' ★' : ''}`;
}

/** Borders: `liveStreak` is the round streak while alive (today or yesterday). */
export function shareBorders(
  id: string,
  correct: number,
  of: number,
  points: number,
  liveStreak: number,
): string {
  const num = parseInt(String(id).slice(-4), 10);
  return `🌍 Borders ${Number.isNaN(num) ? '' : `#${num} `}— ${correct}/${of} · ${points} pts${liveStreak >= 2 ? ` · 🔥${liveStreak}` : ''}`;
}

const RECKON_SQ = ['🎯', '🟩', '🟨', '🟧', '⬜'];

/** Reckon: one square per question by zone (0 bullseye … 4 miss). */
export function shareReckon(
  id: string,
  zones: number[],
  points: number,
  liveStreak: number,
): string {
  const serial = parseInt(String(id).slice(-4), 10);
  return `🎯 Reckon #${serial} — ${zones.map((z) => RECKON_SQ[z]).join('')} · ${points} pts${liveStreak >= 2 ? ` · 🔥${liveStreak}` : ''}`;
}

/** The short link the finish sheet adds under the line. */
export function shortLink(type: PuzzleType): string {
  return `dailynoodle.co.uk/${type}`;
}

/** The whole shared message: the line, then the short link. */
export function shareMessage(type: PuzzleType, line: string): string {
  return `${line}\n${shortLink(type)}`;
}
