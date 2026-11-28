/**
 * The league offer's rules (28 Nov 2026, Alec's go-ahead after mocks; the site's
 * dn-board.js section 4 and SITE.md › League offer, the same rules). A player in no league
 * whose puzzle saves (`digi-<type>-v1`) carry 3 or more different dates is asked, on a fresh
 * finish, to start a league: once, then once more 30 or more days later, and never after a
 * tap on Start or Join. Kept in `noodle-leagueoffer-v1` = {a: [ms of each ask], t: ms of a tap},
 * the site's key and shape (a dismissed prompt: a lost write only means asking again).
 */
import type { KV } from '@noodle/core';

export const OFFER_KEY = 'noodle-leagueoffer-v1';
export const MONTH_MS = 30 * 86_400_000;
/** Days played from which the card names them ("24 days of puzzles…"). */
export const LONG_DAYS = 7;

export interface OfferState {
  /** When each ask was made (ms). */
  a?: number[];
  /** When Start or Join was tapped (ms): no more asks. */
  t?: number;
}

/** The kept state; anything unreadable reads as never asked. */
export function readOffer(kv: Pick<KV, 'getItem'>): OfferState {
  try {
    const o: unknown = JSON.parse(kv.getItem(OFFER_KEY) ?? 'null');
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const s = o as { a?: unknown; t?: unknown };
    return {
      a: Array.isArray(s.a) ? s.a.filter((x): x is number => typeof x === 'number') : [],
      ...(typeof s.t === 'number' ? { t: s.t } : {}),
    };
  } catch {
    return {};
  }
}

/** Distinct days in the puzzle saves: ids and results carry ISO dates (dn-app.js `days`). */
export function playDays(kv: Pick<KV, 'getItem'> & { keys(): string[] }): number {
  const seen = new Set<string>();
  for (const k of kv.keys()) {
    if (!/^digi-[a-z]+-v1$/.test(k)) continue;
    for (const d of (kv.getItem(k) ?? '').match(/20\d\d-\d\d-\d\d/g) ?? []) seen.add(d);
  }
  return seen.size;
}

/** Whether to ask now: not in a league, 3+ days played, and the asks so far allow it. */
export function offerDue(s: OfferState, days: number, now: number, inLeague: boolean): boolean {
  const asks = s.a ?? [];
  if (inLeague || s.t || asks.length >= 2) return false;
  const first = asks[0];
  if (first !== undefined && now - first < MONTH_MS) return false;
  return days >= 3;
}

/** Records an ask; returns the event's props: {days: '3-6' | '7+', n: 1 | 2}. */
export function recordAsk(kv: KV, days: number, now: number): { days: string; n: number } {
  const s = readOffer(kv);
  const a = [...(s.a ?? []), now];
  kv.setItem(OFFER_KEY, JSON.stringify({ ...s, a }));
  return { days: days >= LONG_DAYS ? '7+' : '3-6', n: a.length };
}

/** Records a tap on Start or Join: no more asks. */
export function recordTap(kv: KV, now: number): void {
  kv.setItem(OFFER_KEY, JSON.stringify({ ...readOffer(kv), t: now }));
}

/** The card's words, as the site's (SITE.md › League offer). */
export function offerCopy(days: number): { title: string; body: string } {
  return days >= LONG_DAYS
    ? {
        title: `${days} days of puzzles. Bring your people in?`,
        body: 'Start a league for family or friends and see who’s quickest each day. Your past results go on the board too. No sign-up, just a nickname.',
      }
    : {
        title: 'Play with your family?',
        body: 'Start a league and you all play the same puzzles, with a table each day. No sign-up, just a nickname.',
      };
}
