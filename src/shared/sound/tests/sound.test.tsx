import { renderHook } from '@testing-library/react-native';
import * as Audio from 'expo-audio';

import { DEFAULT_SETTINGS, saveSettings } from '@/shared/settings';

import { SOUND_FILES, type Cue } from '../cues';
import { play, playAll, resetSound, soundOn, useSoundDiff } from '../sound';

const A = jest.mocked(Audio);
const played = (Audio as unknown as { __played: unknown[] }).__played;
const byFile = new Map<unknown, Cue>(
  Object.entries(SOUND_FILES).map(([cue, file]) => [file, cue as Cue]),
);
/** The cues played so far, in order. */
const heard = () => played.map((f) => byFile.get(f));

let clock = 1000;
beforeEach(() => {
  resetSound();
  played.length = 0;
  jest.clearAllMocks();
  jest.spyOn(globalThis.performance, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  saveSettings(DEFAULT_SETTINGS);
  jest.restoreAllMocks();
});

describe('GIVEN the app’s Sound switch on (the default)', () => {
  it('THEN soundOn says so', () => {
    expect(soundOn()).toBe(true);
  });

  describe('WHEN a cue is played, then played again', () => {
    it('THEN its file plays from the start each time, through one player', () => {
      play('borders-right');
      play('borders-right');
      expect(A.createAudioPlayer).toHaveBeenCalledTimes(1);
      expect(A.createAudioPlayer).toHaveBeenCalledWith(SOUND_FILES['borders-right']);
      const p = A.createAudioPlayer.mock.results[0]!.value as Audio.AudioPlayer;
      expect(p.seekTo).toHaveBeenCalledWith(0);
      expect(heard()).toEqual(['borders-right', 'borders-right']);
    });
  });

  describe('WHEN the first sound plays', () => {
    it('THEN the audio mode obeys the phone’s silent mode and mixes with other apps, once', () => {
      play('tangle-tick');
      play('tangle-meh');
      expect(A.setAudioModeAsync).toHaveBeenCalledTimes(1);
      expect(A.setAudioModeAsync).toHaveBeenCalledWith({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        allowsRecording: false,
      });
    });
  });

  describe('WHEN Reckon’s slider ticks faster than every 45 ms (the page’s limit)', () => {
    it('THEN the extra ticks are dropped, as on the page; other cues never are', () => {
      play('reckon-tick');
      clock += 20;
      play('reckon-tick');
      play('tangle-tick');
      play('tangle-tick');
      clock += 30;
      play('reckon-tick');
      expect(heard()).toEqual(['reckon-tick', 'tangle-tick', 'tangle-tick', 'reckon-tick']);
    });
  });

  describe('WHEN there is nothing to play, or several cues', () => {
    it('THEN nothing, or each in order', () => {
      play(null);
      play(undefined);
      playAll([null, 'borders-hint', false, 'borders-wrong', undefined]);
      expect(heard()).toEqual(['borders-hint', 'borders-wrong']);
    });
  });

  describe('WHEN the phone’s audio fails', () => {
    it('THEN the helper swallows it and the game plays on', () => {
      A.createAudioPlayer.mockImplementationOnce(() => {
        throw new Error('no audio');
      });
      A.setAudioModeAsync.mockImplementationOnce(() => Promise.reject(new Error('no')));
      expect(() => play('tangle-star')).not.toThrow();
    });
  });
});

describe('GIVEN the app’s Sound switch off (Account › Settings)', () => {
  describe('WHEN a game asks for sounds', () => {
    it('THEN nothing plays, no player is made and the audio session is left alone', () => {
      saveSettings({ sound: false });
      expect(soundOn()).toBe(false);
      play('borders-pass');
      playAll(['tangle-done', 'reckon-done']);
      expect(played).toEqual([]);
      expect(A.createAudioPlayer).not.toHaveBeenCalled();
      expect(A.setAudioModeAsync).not.toHaveBeenCalled();
    });
  });

  describe('WHEN it is switched back on', () => {
    it('THEN sounds play again', () => {
      saveSettings({ sound: false });
      play('borders-hint');
      saveSettings({ sound: true });
      play('borders-hint');
      expect(heard()).toEqual(['borders-hint']);
    });
  });
});

describe('GIVEN a screen hearing its state change (useSoundDiff)', () => {
  const classify = (a: number, b: number): Cue[] => (b > a ? ['tangle-tick'] : []);

  it('THEN the state it opens with is silent, and each change plays what the rule says', async () => {
    const { rerender } = await renderHook(({ n }: { n: number }) => useSoundDiff(n, classify), {
      initialProps: { n: 1 },
    });
    expect(played).toEqual([]);
    await rerender({ n: 2 });
    await rerender({ n: 2 });
    await rerender({ n: 1 });
    expect(heard()).toEqual(['tangle-tick']);
  });
});
