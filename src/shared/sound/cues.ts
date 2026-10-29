/**
 * The sound files (assets/sounds, rendered by scripts/make-sounds.js from the website's
 * notes), by cue. Metro needs each require spelled out; a test keeps this list and the
 * script's in step.
 */
export const SOUND_FILES = {
  'tangle-step-1': require('../../../assets/sounds/tangle-step-1.wav') as number,
  'tangle-step-2': require('../../../assets/sounds/tangle-step-2.wav') as number,
  'tangle-step-3': require('../../../assets/sounds/tangle-step-3.wav') as number,
  'tangle-step-4': require('../../../assets/sounds/tangle-step-4.wav') as number,
  'tangle-step-5': require('../../../assets/sounds/tangle-step-5.wav') as number,
  'tangle-step-6': require('../../../assets/sounds/tangle-step-6.wav') as number,
  'tangle-step-7': require('../../../assets/sounds/tangle-step-7.wav') as number,
  'tangle-step-8': require('../../../assets/sounds/tangle-step-8.wav') as number,
  'tangle-step-9': require('../../../assets/sounds/tangle-step-9.wav') as number,
  'tangle-step-10': require('../../../assets/sounds/tangle-step-10.wav') as number,
  'tangle-step-11': require('../../../assets/sounds/tangle-step-11.wav') as number,
  'tangle-step-12': require('../../../assets/sounds/tangle-step-12.wav') as number,
  'tangle-word-3': require('../../../assets/sounds/tangle-word-3.wav') as number,
  'tangle-word-4': require('../../../assets/sounds/tangle-word-4.wav') as number,
  'tangle-word-5': require('../../../assets/sounds/tangle-word-5.wav') as number,
  'tangle-word-6': require('../../../assets/sounds/tangle-word-6.wav') as number,
  'tangle-word-7': require('../../../assets/sounds/tangle-word-7.wav') as number,
  'tangle-word-8': require('../../../assets/sounds/tangle-word-8.wav') as number,
  'tangle-meh': require('../../../assets/sounds/tangle-meh.wav') as number,
  'tangle-tick': require('../../../assets/sounds/tangle-tick.wav') as number,
  'tangle-star': require('../../../assets/sounds/tangle-star.wav') as number,
  'tangle-done': require('../../../assets/sounds/tangle-done.wav') as number,
  'borders-right': require('../../../assets/sounds/borders-right.wav') as number,
  'borders-wrong': require('../../../assets/sounds/borders-wrong.wav') as number,
  'borders-hint': require('../../../assets/sounds/borders-hint.wav') as number,
  'borders-pass': require('../../../assets/sounds/borders-pass.wav') as number,
  'reckon-tick': require('../../../assets/sounds/reckon-tick.wav') as number,
  'reckon-lock-0': require('../../../assets/sounds/reckon-lock-0.wav') as number,
  'reckon-lock-1': require('../../../assets/sounds/reckon-lock-1.wav') as number,
  'reckon-lock-2': require('../../../assets/sounds/reckon-lock-2.wav') as number,
  'reckon-lock-3': require('../../../assets/sounds/reckon-lock-3.wav') as number,
  'reckon-lock-4': require('../../../assets/sounds/reckon-lock-4.wav') as number,
  'reckon-done': require('../../../assets/sounds/reckon-done.wav') as number,
} as const;

export type Cue = keyof typeof SOUND_FILES;
