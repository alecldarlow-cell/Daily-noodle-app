/**
 * Sound for the native players (tracker AF-013, ADR-009): the website's in-play tones for
 * Tangle, Borders and Reckon, rendered to small files (assets/sounds) and played through
 * expo-audio. One app-wide switch, Account › Settings › Sound (AF-012), on by default;
 * the phone's silent mode is obeyed (`playsInSilentMode: false`: on iPhone the ring/silent
 * switch, on Android ringer mode silent or vibrate), and other apps' audio keeps playing
 * (`mixWithOthers`).
 *
 * Screens and hooks call this; puzzle models never do (they are proved identical to the
 * website by replay, and know nothing of the phone), so sound never changes a move, a
 * score or a time.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef } from 'react';

import { readSettings } from '@/shared/settings';

import { SOUND_FILES, type Cue } from './cues';

/** The app's Sound switch. Every sound in the app comes through `play`, so this gates them all. */
export function soundOn(): boolean {
  return readSettings().sound;
}

const players = new Map<Cue, AudioPlayer>();
let mode: Promise<void> | null = null;

/** Cues the site keeps apart (engines/reckon.js: a slider tick at most every 45 ms). */
const MIN_GAP_MS: Partial<Record<Cue, number>> = { 'reckon-tick': 45 };
const lastPlayed = new Map<Cue, number>();
const now = () => globalThis.performance.now();

/** Sound effects: never over the phone's silent mode, never stopping the player's music. */
function audioMode(): void {
  if (mode) return;
  mode = Promise.resolve(
    setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
    }),
  ).catch(() => undefined);
}

function player(cue: Cue): AudioPlayer {
  let p = players.get(cue);
  if (!p) {
    p = createAudioPlayer(SOUND_FILES[cue]);
    players.set(cue, p);
  }
  return p;
}

/** Play one cue from its start, unless the Sound switch is off. Never throws. */
export function play(cue: Cue | null | undefined): void {
  if (!cue || !soundOn()) return;
  const gap = MIN_GAP_MS[cue];
  if (gap !== undefined) {
    const t = now();
    if (t - (lastPlayed.get(cue) ?? -Infinity) < gap) return;
    lastPlayed.set(cue, t);
  }
  try {
    audioMode();
    const p = player(cue);
    // A cue played again (Tangle's steps, Reckon's ticks) starts over.
    void Promise.resolve(p.seekTo(0)).catch(() => undefined);
    p.play();
  } catch {
    // No audio on this phone just now: play on in silence.
  }
}

/** Every cue a change asks for, in order. */
export function playAll(cues: readonly (Cue | null | false | undefined)[]): void {
  for (const c of cues) if (c) play(c);
}

/**
 * Play what changed between one snapshot and the next, as `classify` reads it (pure: the
 * type's own rule, e.g. "a word was found" → its chime). The snapshot a screen opens with
 * never plays, so a finished puzzle reopened is silent.
 */
export function useSoundDiff<S>(
  snap: S,
  classify: (prev: S, next: S) => readonly (Cue | null | false | undefined)[],
): void {
  const prev = useRef(snap);
  useEffect(() => {
    const was = prev.current;
    prev.current = snap;
    if (was === snap) return;
    playAll(classify(was, snap));
  }, [snap, classify]);
}

/** Test seam: forget the players and the audio mode, as on a fresh launch. */
export function resetSound(): void {
  for (const p of players.values()) {
    try {
      p.remove();
    } catch {
      /* already gone */
    }
  }
  players.clear();
  lastPlayed.clear();
  mode = null;
}
