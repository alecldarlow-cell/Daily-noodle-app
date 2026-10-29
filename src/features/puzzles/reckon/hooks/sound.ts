import type { Cue } from '@/shared/sound';

import type { ReckonState } from '../model';

/** What the screen reads off a Reckon state to hear a change. */
export interface ReckonSoundSnap {
  play: boolean;
  /** Answers locked in this round, and the last one's zone (0 bullseye … 4 far off). */
  locked: number;
  zone: number;
  /** The question on screen and the slider's ladder index. */
  q: number;
  ci: number;
}

export function reckonSoundSnap(s: ReckonState): ReckonSoundSnap {
  const z = s.R?.z ?? [];
  return {
    play: s.view === 'play',
    locked: z.length,
    zone: z[z.length - 1] ?? 4,
    q: s.Q,
    ci: s.CI,
  };
}

/**
 * What a Reckon change sounds like, where engines/reckon.js plays its SND: a tick as the
 * slider moves a step (the helper keeps them 45 ms apart, as the page does), Lock in with
 * its result's chime 120 ms later (one file per zone). Moving to another question moves
 * the slider silently, as the page's quiet setIdx; the finish chime is played by the hook
 * at the finish itself. Opening or resuming a round is never heard.
 */
export function reckonSound(prev: ReckonSoundSnap, next: ReckonSoundSnap): Cue[] {
  if (!(prev.play && next.play)) return [];
  if (next.locked > prev.locked)
    return [`reckon-lock-${Math.max(0, Math.min(4, next.zone))}` as Cue];
  if (next.q === prev.q && next.ci !== prev.ci) return ['reckon-tick'];
  return [];
}
