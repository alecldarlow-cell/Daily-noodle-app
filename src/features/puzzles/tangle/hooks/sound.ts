import type { Cue } from '@/shared/sound';

import { MINLEN, type TangleEngine } from '../model';

/** What the screen reads off the engine (which changes in place) to hear a change. */
export interface TangleSoundSnap {
  /** The board is up (not home, not the result). */
  play: boolean;
  pathLen: number;
  /** The path's first tile: a new word started elsewhere is a new first step. */
  pathFirst: number;
  found: number;
  /** The last word found, and whether it was the star. */
  lastLen: number;
  star: boolean;
  /** The toast on show (a new object each time the engine raises one). */
  toast: { text: string; cls: string };
  /** The count-in's beat ('' when hidden). */
  count: string;
  /** Whole seconds left while the round runs, else null. */
  secs: number | null;
  round: string | null;
}

export function tangleSoundSnap(e: TangleEngine): TangleSoundSnap {
  const s = e.s;
  const R = s.R;
  const last = R?.found[R.found.length - 1];
  const running = s.view === 'play' && !!R && R.state === 'playing';
  return {
    play: s.view === 'play',
    pathLen: s.path.length,
    pathFirst: s.path[0] ?? -1,
    found: R?.found.length ?? 0,
    lastLen: last?.length ?? 0,
    star: !!last && last === e.P.star,
    toast: s.toast,
    count: s.count,
    secs: running && !s.paused && !s.counting ? Math.ceil(R.left) : null,
    round: R?.state ?? null,
  };
}

/** The site's "meh" toasts (engines/tangle.js submit: too short, not a word). */
const MEH = new Set(['Too short', "Not in today's list"]);

/**
 * What a Tangle change sounds like, where engines/tangle.js plays its sfx: a step as each
 * letter joins the path (rising with its length), a word's chime (rising with the word's
 * length) or the star's run, "meh" for a short or unknown word, a tick on each count-in
 * beat and each of the last five seconds, and the finish fanfare when the round ends.
 * Opening the board (Play, Resume) is never heard as words found.
 */
export function tangleSound(prev: TangleSoundSnap, next: TangleSoundSnap): Cue[] {
  const out: Cue[] = [];
  if (prev.round === 'playing' && next.round === 'done') out.push('tangle-done');
  // The count-in's first beat comes with the board itself (Play, Resume).
  if (next.play && next.count !== prev.count && next.count.length === 1) out.push('tangle-tick');
  if (!(prev.play && next.play)) return out;
  if (next.found > prev.found)
    out.push(
      next.star
        ? 'tangle-star'
        : (`tangle-word-${Math.min(8, Math.max(MINLEN, next.lastLen))}` as Cue),
    );
  if (next.toast !== prev.toast && next.toast.cls.startsWith('on') && MEH.has(next.toast.text))
    out.push('tangle-meh');
  // One step per letter added, as the page's add() plays them (a drag's first move adds two).
  const from = next.pathFirst !== prev.pathFirst ? 0 : prev.pathLen;
  for (let k = from + 1; k <= next.pathLen; k++) out.push(`tangle-step-${Math.min(12, k)}` as Cue);
  if (
    next.secs !== null &&
    prev.secs !== null &&
    next.secs < prev.secs &&
    next.secs <= 5 &&
    next.secs > 0
  )
    out.push('tangle-tick');
  return out;
}
