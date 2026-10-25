# Handover: further refinement of the mobile app (25 Oct 2026)

For the next Claude session working on the app. Read `CLAUDE.md` first (its rules still apply:
branch and PR for every change, merge only when CI `check` is green and Alec says so, tests with
every change, no live database, no secrets). `docs/log.md` has the history; this file is the
short version of where things stand and what is left.

## Where things stand

- `main` has everything: the site-style Today and Archive (#30), build settings in release
  builds (#31), LF line endings so CI's runtime matches a Windows build (#32), Tangle's count-in
  fix (#33), and the visual polish of all eight puzzles (#34: Instrument Serif and Archivo,
  one shared `StartLayout`, the finish sheet to finish.css values, board refinements).
- **Updates reach phones automatically.** Merging to `main` runs Release, which publishes an EAS
  Update to the `preview` channel. The runtime is `b28b8de9…` (fingerprint policy); a change to
  native code or `app.json` changes it and needs a new build (`eas build --profile preview`).
  To publish by hand: `eval "$(node scripts/eas-profile-env.js preview)"` then
  `npx eas-cli@25.3.0 update --channel preview --environment preview --message "…" --non-interactive`
  (without the env export, leagues and sign-in break in that update).
- **Google Play:** internal testing release 3 (version 0.1.0) is available to testers. Nothing has
  gone to production review. The listing text and declarations are in `docs/play-listing.md`.
- Sign-in is on in both the app and the website (`EXPO_PUBLIC_SYNC=1`; site `dn-sync.js ON`).

## 1. Finalise the Play Store screenshots (first job)

The four in `store/screenshots/` (untracked, 1080 × 1920) are **out of date and must be retaken**:

- they show the old design, before #34;
- three show "Solved in 0:18" / a 0:18 finish (a test solve by someone who knew the answers).
  Alec: "18 seconds isn't realistic". Use believable times (a Mini in roughly 2–4 minutes).

How:

- **Finish sheet:** solve an _old_ archive Mini at a normal pace (Mini 100 is started and
  untouched) and capture the sheet. Never fabricate or edit a result into an image.
- **Today and Archive:** take them before Alec plays that day (nothing solved yet), or on a day
  whose times look normal. Today's puzzles must never be played for testing.
- **A board mid-solve** (Mini or another), and optionally Leagues. No real nicknames on any
  leaderboard shot (Alec's rule): use a test league or crop it out.
- Phone screenshots are 1080 × 2410; Play needs 9:16, so crop to 1080 × 1920 (keep the status
  bar out or tidy). Check them in both dark and light mode and pick one look for the set.
- Then replace the screenshots in Play Console › Grow › Store presence › Main store listing
  (developer 6855067210108057426, app 4972303615566008433). Ask Alec before saving changes there,
  and decide with him whether to commit `store/screenshots/`.

## 2. Design refinements still open

From comparing the app with the website (in the browser pane at 412 × 900, dark mode, on old
puzzles; the site lives at `dailynoodle.co.uk/reports/<path>.html`):

- **Verify on the phone:** Sweep's start square ring (fixed in the last commit of #34, not yet
  seen on a phone; it should be a full marigold ring with a soft pulse).
- **Light mode was not checked.** Every screen was reviewed in dark mode only; go through all
  eight start cards, boards and finish sheets in light.
- Start cards say "Today’s Mini" (etc.) on archive puzzles too. The site does the same; ask Alec
  whether the app should say something else for past days.
- Mini's Check word / Check all / Reveal word sit above the grid; the site puts them below the
  clue bar. Decide with Alec.
- Tangle's and Borders' date lines have a comma ("Friday, 23 October") unlike the rest; the
  Tangle test pins that text, so change it only deliberately, with the test.
- Doku's bank tiles look small next to the grid on a phone.
- Font scale: Alec's phone runs at 115%. Check large text (Android font size max) on the start
  card title, the 112 pt finish hero and Reckon's centred guess.

## 3. Other things Alec may raise

- **"Item not found" installing from Play:** the tester must accept
  https://play.google.com/apps/internaltest/4701406289038565770 in Chrome on the phone, signed in
  with the tester account. The preview build on Alec's phone has a different signing key from
  the Play build, so it must be uninstalled before the Play version can install.
- Try sign-in end to end (Account › email link on the phone, then board.html on a laptop).

## Testing on Alec's phone

- No emulator (Snapdragon laptop). Use the real phone over Wi-Fi adb: Alec turns on wireless
  debugging and pairs; the address changes each time (last: `192.168.86.250:41403`). Ask before
  using the phone; Alec uses it.
- Device 1080 × 2410, font scale 1.15, dark mode. App package `uk.co.dailynoodle.app`.
- After publishing an update, force-stop and open the app twice (download, then apply).
- Navigate to old puzzles through Archive: restart the app (so the search box is empty), tap the
  Archive tab, a type chip, then the search box, type the number, and screenshot the list
  **before** tapping anything. A stray "back" from a board can land on Today and the next tap can
  open today's puzzle (it happened once with Doku 104: no moves, one `start` analytics event).
- Old Tangles may be played for testing (Alec agreed); avoid finishing other old puzzles unless
  needed, since a finish counts in "played".
- Helper used this session (`$TEMP/claude/phone.sh`): taps and swipes in device pixels via
  `adb shell input`, then `adb exec-out screencap -p` shrunk to half size for viewing. Pass
  `</dev/null` to adb inside loops or it eats the script's stdin.

## Fonts and styles (for any new screen)

- Families in `src/shared/theme/fonts.ts`: `FONT.serif` / `serifItalic` (Instrument Serif) for
  names, results and stats; `FONT.sans` / `sansMedium` / `sansSemi` (Archivo) for interface text;
  `display`/`body` families for Today and Archive. Never set `fontWeight` or `'Georgia'` in the
  players: `src/shared/theme/tests/fonts.test.ts` fails on either (Android drops a custom face
  under a weight).
- Colours: `usePuzzleTokens()` (house.css values, including `sheet`, `rule`, `hair`, `brand`,
  `onBrand`, `gold*`); Borders and Reckon keep their own palettes in their `colors.ts`.
- Start cards: `StartLayout` in `src/shared/start-card`; finish: `FinishSheet`. Icons:
  `Chevron` and `ShareGlyph` in `src/shared/ui` (there is no SVG library).
