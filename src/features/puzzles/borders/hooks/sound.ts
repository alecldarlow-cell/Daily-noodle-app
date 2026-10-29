import type { Cue } from '@/shared/sound';

import type { BordersState } from '../model';

/** What the screen reads off a Borders state (its round changes in place) to hear a change. */
export interface BordersSoundSnap {
  quiz: boolean;
  /** Answers given this round, and whether the last was right. */
  answered: number;
  lastOk: boolean;
  /** The question on screen, and whether Show on map is used on it. */
  q: number;
  hint: boolean;
}

export function bordersSoundSnap(s: BordersState): BordersSoundSnap {
  const ans = s.cur?.ans ?? [];
  return {
    quiz: s.view === 'quiz',
    answered: ans.length,
    lastOk: !!ans[ans.length - 1]?.ok,
    q: s.cur?.i ?? -1,
    hint: !!s.cur?.hint,
  };
}

/**
 * What a Borders change sounds like, where engines/borders.js plays its sfx: right or wrong
 * as an answer goes in, a soft note for Show on map. (The finish chime is played by the
 * hook at the finish itself, as the page's finish does.) Opening or resuming a round is
 * never heard.
 */
export function bordersSound(prev: BordersSoundSnap, next: BordersSoundSnap): Cue[] {
  if (!(prev.quiz && next.quiz)) return [];
  const out: Cue[] = [];
  if (next.hint && !prev.hint && next.q === prev.q) out.push('borders-hint');
  if (next.answered > prev.answered) out.push(next.lastOk ? 'borders-right' : 'borders-wrong');
  return out;
}
