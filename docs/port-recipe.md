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

## What WP10 added (Link, Tangle)

- **Randomness stays in the screen.** Link deals and shuffles with `Math.random`; the
  model takes each order as part of the move, and the replay reads the page's order
  after loading and after every Shuffle and hands it over. Never seed the page.
- **Animations that gate the rules run on real time in the page** (Link's settle uses
  Web Animations, which the fake clock doesn't drive): the replay moves the fake clock
  by the animation's length, waits for it to land, then lets the rest of the step pass,
  and the native player stops its clock at the same moment.
- **Clocks that tick by `performance.now()` deltas** (Tangle's 100 ms tick, its saved
  `left` to the last float): port the tick as it is, run it on a fake clock with the
  page's timer order (`tangle/simulate.ts` FakeClock), and keep every move 50 ms off
  the tick so the order of a move against a tick is never a guess.
- **Pointer input** goes through the page's own pointer events in the replay, with the
  tiles' rectangles read from the page before each gesture and handed to the native
  engine with the same points, so its hit-testing is compared too.
- **An imperative engine is ported as an imperative engine** (`createTangle`), with
  storage, clock and timers handed in; the React hook only hosts it.
- **A site bug found by the replay is reported, not ported**: list it in the type's
  `KNOWN` table in its replay script with what it is; the run prints it as KNOWN and
  still fails on any other difference (Link: the replay's sheet after Play again).
- Long `--all` runs split with `--shard k/n`.

## What WP11 added (Doku)

- **A ship gate that needs data is vendored, not rewritten.** The Doku page proves each
  puzzle (word list, bands, uniqueness) before it renders; the model runs the same
  `validateLexi` on `engine-words.json`, written by `scripts/vendor-doku-words.js`
  (`--check` in the nightly), and the replay compares those tables with the page's own
  globals before it plays.
- **What the player sees is the last paint.** The engine changes state without
  repainting in one place (a typed letter the bank lacks moves its cursor, unpainted);
  the model keeps `view`, the cursor as last painted, and the board draws that.
- **The phone's own keyboard is a control.** A tapped empty square focuses the page's
  hidden input; the model tracks whether it has focus (`kbd`), the oracle types only
  while it does, the replay compares `document.activeElement`, and the screen focuses
  or blurs a hidden `TextInput` to match (letters and space by `onChangeText`, delete
  by `onKeyPress`).
- **Writes the page makes on opening are ported too**: Doku's streak is seeded from its
  results when it is first read (load, solve, reopen), and the replay compares the
  streak document right after load.
