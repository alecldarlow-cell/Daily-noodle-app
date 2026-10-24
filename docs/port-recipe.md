# Porting a puzzle engine to native

How a type moves from the WebView bridge to a native player (WP8, proved on the Mini).
The site's `engines/<type>.js` stays the reference: the native player is a port of it,
and the replay is the proof.

1. **Read the engine whole**, with `dn-track.js`'s puzzle block (how it counts Check,
   Reveal and Hint presses and names the outcome) and `engines/<type>.css`. Note which
   controls a phone actually has: the CSS hides some (on the Mini: Reveal all, Reset,
   the keyboard toggle everywhere, the clue list on phones). Port those, nothing else.
2. **`src/features/puzzles/<type>/model.ts`**, pure TypeScript, no React or storage:
   `validate(data)` (the engine's ship gate check for check; where the engine has none,
   the conditions under which its code throws or can never finish), `init`, `apply`
   (one move, returning a new state), `status`, `finish(state, clock)` →
   `{rec, outcome, end}`, and `hint` with the engine's wording where it has one.
   Port the rules from the code, line by line, with the engine's names.
3. **`oracle.ts`**: deterministic move lists from the puzzle data. A plain solve plus
   variants that use every control and help the type has (and the site's own variants
   from `tools/tests/play.js`). Give each variant its starting saves and clock: a fresh
   save, a live streak, an old pre-`tz` streak, a lapsed one, a game across midnight.
4. **`finishing.ts`**: what the finish writes (`saves.putDone`, the streak rule from
   `@noodle/core`, the share line) and what a reopened puzzle shows. The screen and the
   replay both call it.
5. **`simulate.ts`**: the model on a fake clock, as the screen runs it, reporting the
   board after every move in the shape the replay reads from the page.
6. **`scripts/replay.js`**: add the type's controls (`drive`), board reader and finish
   reader. Run `--all` locally; every difference is a porting bug until proven
   otherwise. Break the model on purpose once and see the replay catch it.
7. **Screen**: `components/` on `@/shared/start-card` and `@/shared/finish-sheet`
   (house.js and finish.js, already built). The clock starts when the engine's does.
   On a first finish, `announceFinish` with the tracker's detail; a reopened puzzle
   shows its sheet and never announces again.
8. **Data**: `NativePlay` loads `reports/<file>.json`, validates, and falls back to the
   bridge. Add the type to `hasNativePlayer`.
9. **`index.ts` `enabled = true`** only after `replay --all` is green on every puzzle of
   the type; add the type to the nightly `Replay nightly` workflow and the PR sample.
10. **Tests** GIVEN/WHEN/THEN: model, oracle, finishing, screen (RNTL), `NativePlay`;
    `.maestro/<type>.yaml` for the device run.
