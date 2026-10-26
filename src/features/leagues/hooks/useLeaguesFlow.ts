/**
 * Which part of Leagues is showing, as board.html moves between them: the board (or the
 * intro for someone in no league), the start / join / invite / claim / PIN forms, and the
 * one-off card at the top of the board after something happened.
 */
import { BOARD_TYPE } from '@noodle/core';
import { useEffect, useState } from 'react';

import type { BoardView } from '../types';

import { codeFrom } from '../schemas';
import { currentLeague, setCurrent, useBoardState } from './boardStore';

export type View =
  | { k: 'home' }
  | { k: 'start'; from?: string }
  | { k: 'code' }
  | { k: 'invite'; code: string; typed?: boolean }
  | { k: 'claim'; code?: string; name?: string; players?: string[]; back?: View }
  | { k: 'pin'; fresh: boolean };

export type Notice =
  | { k: 'created'; code: string }
  | { k: 'joined' }
  | { k: 'moved' }
  | { k: 'claimed'; nick: string }
  | { k: 'pinSaved' };

/**
 * Route parameters: an invite's `join` code, `go` straight to a form (or `home`, the
 * board or a choice waiting there), or a board to show as board.html's query names it:
 * `p` the puzzle (or `all`), `d` the day (YYYY-MM-DD). `n` is any value that differs on
 * each tap, so asking for the same place twice still goes there.
 */
export interface LeaguesParams {
  join?: string;
  go?: string;
  p?: string;
  d?: string;
  n?: string;
}

/** Params for a tap into Leagues: the ask plus a fresh `n`, so a repeat tap still acts. */
let taps = 0;
export function leaguesParams(ask: Omit<LeaguesParams, 'n'>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ask)) if (v) out[k] = v;
  out.n = `${Date.now().toString(36)}.${(taps += 1)}`;
  return out;
}

/** True when the route asks for something (and the params should be cleared once read). */
export const asksAnything = (p: LeaguesParams): boolean => !!(p.join || p.go || p.p || p.d);

/** The board asked for: board.html takes `p` if it names a pill and `d` if it's a date. */
export interface BoardPick {
  view: BoardView | null;
  date: string | null;
}

export function pickFrom(p: LeaguesParams): BoardPick {
  const view =
    p.p === 'all' || p.p === 'records' || (!!p.p && p.p in BOARD_TYPE) ? (p.p as BoardView) : null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.d ?? '') ? p.d! : null;
  return { view, date };
}

function fromParams(p: LeaguesParams): View | null {
  const join = codeFrom(p.join ?? '');
  if (join) return { k: 'invite', code: join };
  if (p.go === 'claim') return { k: 'claim' };
  if (p.go === 'start') return { k: 'start' };
  if (p.go === 'code') return { k: 'code' };
  if (p.go === 'home') return { k: 'home' };
  const pick = pickFrom(p);
  if (pick.view || pick.date) return { k: 'home' };
  return null;
}

export function useLeaguesFlow(params: LeaguesParams) {
  const s = useBoardState();
  const [shown, setView] = useState<View>(() => fromParams(params) ?? { k: 'home' });
  const [notice, setNotice] = useState<Notice | null>(null);
  /** After "Use my link" on a claim that needs a new PIN. */
  const [needPin, setNeedPin] = useState(false);

  // A new invite or shortcut opened while the tab was already showing. The screen clears
  // the params once read, and app taps add `n`, so the same ask again is still new.
  const key = `${params.join ?? ''}|${params.go ?? ''}|${params.p ?? ''}|${params.d ?? ''}|${params.n ?? ''}`;
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    const v = fromParams(params);
    if (v) setView(v);
  }

  // An invite to a league this install is already in just opens its board.
  const inviteCode = shown.k === 'invite' ? shown.code : null;
  const alreadyIn = !!inviteCode && (s.leagues || []).some((l) => l.code === inviteCode);
  const view: View = alreadyIn ? { k: 'home' } : shown;
  useEffect(() => {
    if (alreadyIn && inviteCode) setCurrent(inviteCode);
  }, [alreadyIn, inviteCode]);

  const inAny = (s.leagues || []).length > 0;
  const home = () => setView({ k: 'home' });
  return {
    state: s,
    inAny,
    league: currentLeague(s),
    pending: s.pend ?? null,
    view,
    setView,
    home,
    /** The puzzle and day the route asked for; `key` changes with each new ask. */
    pick: { ...pickFrom(params), key },
    /** Back from a form: the board if in a league, else the intro (board.html data-go="back"). */
    back: home,
    notice,
    setNotice,
    needPin,
    setNeedPin,
  };
}

export type Flow = ReturnType<typeof useLeaguesFlow>;
