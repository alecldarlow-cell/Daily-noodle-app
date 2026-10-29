# ADR-009: expo-audio, for the website's game sounds

- Status: accepted, 29 Oct 2026 (Release B; tracker AF-012, AF-013)
- Adds: `expo-audio` 58.0.10 (native; ships in the 0.3.0 store build)

## Context

On the website, Tangle, Borders and Reckon play short synthesized tones (right and wrong
answers, a word found, ticks, a finish fanfare), on by default with a Sound switch. The
app's native versions dropped them. Alec's decision (27 Oct 2026, AF-012/AF-013): the
three games keep the website's in-play tones, their finish fanfares are their celebration
jingles, one app-wide Sound switch on Account (on by default), following the phone's
silent mode, in the next store build. The five grid puzzles' new jingle goes to the
website first (site PR) and to the app after.

React Native has no Web Audio, so the app plays files. `expo-audio` is Expo's audio
library (expo-av is not among SDK 58's bundled modules). SDK 58's `bundledNativeModules.json` asks for
`~58.0.10`; the newest 58.0.x on npm on 29 Oct 2026 is 58.0.10, and the SDK 58 docs
(https://docs.expo.dev/versions/v58.0.0/sdk/audio/) recommend `~58.0.10`. `npx expo
install` can't reach Expo's version API from Claude's cloud workspace, so it is pinned
exactly by hand.

Its config plugin, unconfigured, asks for the microphone: `RECORD_AUDIO` on Android
(`recordAudioAndroid` defaults to true), a microphone usage string on iOS, and adds a
media-playback foreground service (`enableBackgroundPlayback` defaults to true). The app
records nothing and plays nothing in the background.

## Decision

- Add `expo-audio` 58.0.10 with its plugin set to `microphonePermission: false`,
  `recordAudioAndroid: false`, `enableBackgroundPlayback: false`, and
  `android.permission.RECORD_AUDIO` in `blockedPermissions` as well. Only the library's
  own `MODIFY_AUDIO_SETTINGS` (a normal permission) is added.
- `scripts/make-sounds.js` renders the website's notes (engines/tangle.js, borders.js,
  reckon.js: each sound's oscillators, waves, gains and timings, copied as numbers) to
  33 small WAV files in `assets/sounds/` (16-bit mono, 22,050 Hz, under a second each,
  about 530 KB together): band-limited waves as Web Audio plays them, under the same
  two exponential ramps. No randomness, so `--check` (and `scripts/tests/sounds.test.ts`)
  proves the committed files are what the notes give. Where a sound varies with play
  (Tangle's rising step and word chime; Reckon's zone) there is one file per value the
  page can play.
- `shared/sound` is the one way to play: `play(cue)` checks the app's Sound switch
  (`noodle-app-settings`, now `{ vibration, sound, motion }`; a save without `sound`
  reads as on), sets the audio mode once (`playsInSilentMode: false`, so the iPhone's
  silent switch and Android's silent or vibrate ringer mute it; `mixWithOthers`, so a
  player's music keeps going), and plays the cue's player from the start. With the
  switch off no player is ever made. Errors are swallowed.
- Each game reads its sounds off its state after each change (`<type>/hooks/sound.ts`,
  pure rules, as `feel.ts` does for haptics); the finish chimes are played by the hooks
  where they commit the finish. Models never play anything, so moves, scores, times and
  saves are as before and the replays are untouched.
- Jest maps `expo-audio` to a small stand-in (`test/mocks/expo-audio.js`; the real module
  can't load without its native side), and a `.wav` require becomes its cue's name
  (`test/wav-transformer.js`) so tests can say which sound played.

## Consequences

- Native code changed: sound arrives only with the 0.3.0 store build.
- Not done: the grid puzzles' celebration jingle (Mini, Doku, Sweep, Path, Link). The
  agreed order is the website first, and the website couldn't be changed this run; the
  app renders the site's notes once they exist (add them to `make-sounds.js`).
- Android's "silent" is the ringer mode; a phone on ring with its media volume down is
  quiet too, by the media volume.
