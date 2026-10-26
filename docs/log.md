# Build log

The plan, build brief and contracts live in the Claude doc
**The Daily Noodle app — conversion plan** (tabs: Plan, Build brief, Contracts):
https://claude.ai/artifact/HmMQXKYfM23GanNGuV62zB

Each session takes the first work package not marked done, and appends an entry
below when it finishes.

## Status

| WP  | Deliverable                                                   | Status                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | App repo scaffolded, CI green                                 | done ([#1](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/1))                                                                                                                                        |
| 1   | `@noodle/core` with differential test against `dn-core.js`    | done ([#2](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/2))                                                                                                                                        |
| 2   | Site publishes `feed-lite.json` and per-puzzle JSON (site PR) | done ([site #21](https://github.com/alecldarlow-cell/dailynoodle/pull/21))                                                                                                                                      |
| 3   | Today and Archive screens, offline-capable                    | done ([#3](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/3))                                                                                                                                        |
| 4   | WebView bridge: play, finish, share, saves                    | done ([#5](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/5))                                                                                                                                        |
| 5   | Leagues: board, join, submit, first-run handoff               | done ([#8](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/8))                                                                                                                                        |
| 6   | EAS builds, TestFlight and Play internal track                | config ready; needs Alec’s accounts ([guide](https://claude.ai/artifact/CpiPm7oB6wtisZ8x9DDbtm))                                                                                                                |
| 7   | Optional sign-in and sync, web and app                        | built in app, site and database; switched off until Resend + redirect URLs                                                                                                                                      |
| 8   | Port recipe, shared start card and finish sheet, Mini native  | done ([#7](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/7))                                                                                                                                        |
| 9   | Sweep and Path native                                         | done ([#11](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/11))                                                                                                                                      |
| 10  | Link, Tangle, Reckon, Borders native                          | done ([#12](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/12), [#18](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/18)); full replay passed 25 Oct                                      |
| 11  | Doku native                                                   | done ([#15](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/15), [#22](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/22)); full replay passed 25 Oct                                      |
| 12  | Polish, notifications decision, release decision              | polish and board link done ([#26](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/26), [#25](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/25)); notifications and release decisions open |

## Entries

### 24 Oct 2026 — WP0

- Repo is `alecldarlow-cell/Daily-noodle-app` (the plan said `dailynoodle-app`; read the doc's name as this one). It is
  **public** at first; the plan assumed private. Alec made it private on 24 Oct 2026. Nothing secret is or will be committed
  (only the Supabase anon key, already public in the site), but Alec may want it
  private before WP5.
- Expo SDK 58 (`expo` 58.0.19, React Native 0.88, React 19.3, Expo Router 58 with
  native tabs), TypeScript 6 strict with `noUncheckedIndexedAccess`. Versions pinned
  exactly from the SDK 58 template, because `expo install` needs Expo's version API,
  which this workspace's network blocks.
- Feature-first layout per Piers §3.3: routes in `src/app/` (thin re-exports),
  `src/features/{today,archive,leagues,account}`, `src/shared/{theme,ui}`,
  `packages/core` (`@noodle/core`, npm workspace).
- ESLint (Expo config + Prettier + `eslint-plugin-boundaries`); `npm run lint:selftest`
  proves the boundaries bite (cross-feature, shared→feature, route→feature internals).
- Tests: jest-expo + React Native Testing Library, not Vitest (ADR-004); 14 tests,
  100% lines. Expo's lazy globals vs Jest 30 teardown needed `test/resolve-lazy-globals.js`.
- CI: `.github/workflows/ci.yml` runs format, lint, boundary self-test, typecheck, tests
  with coverage on every PR and on `main`.
- Placeholder screens for the four tabs, house colour tokens from `front.css`, site icons.
- Needs Alec: turn on branch protection for `main` requiring the `check` job.

### 24 Oct 2026 — WP1

- `@noodle/core` (`packages/core/src`): `london` (londonDay, dayBefore), `ids` (types,
  `TYPE_OF_ID`, player numbers, storage keys), `saves` (a save store over any
  Web-Storage-shaped KV: getDone, putDone, saveProgress, saveStreak, failure notices
  and retry; mergeStreak, mergeProgress, same, progressOnly), `streaks`, `played`
  (resultText, playedState, clock, overall run), `share` (all eight lines + short
  link), `today` (acceptToday).
- **Streaks are three rules, not one** (found reading the engines): Mini/Doku bump on a
  solve; Sweep/Link also reset to 0 on a loss; Path has no pre-18-Oct grace day. Plus
  Doku's seed-from-results and the `{last, n, best}` round streak (Tangle, Borders,
  Reckon; Tangle and Reckon count only on the puzzle's own day — the caller decides).
- **Differential tests** against the site's own code, vendored by
  `scripts/vendor-site.js` from dailynoodle@c26f3ba (dn-core.js verbatim; functions
  lifted by name from front.js and the engines): 10,000 instants (a third within 90
  min of London midnight, a third within 48 h of a clock change) for londonDay and
  dayBefore; 2,000 seeded cases each for mergeStreak, mergeProgress, saveProgress with
  write failures, putDone/getDone with failure and retry, the Mini/Doku, Sweep, Link and
  Path streak updates, Path's live count, Doku's seed, card wording and played state,
  clocks, and Sweep/Link share lines. All identical. Mutation check: breaking the
  grace-day rule or the 🔥 threshold fails the suite.
- Tangle, Borders and Reckon share lines are tested against the agreed examples (their
  engine functions close over page state, so they can't be lifted).
- **Contract correction:** Tangle's share line ends ` ★` when the star word was found
  (`engines/tangle.js` shareLine). The plan's Contracts tab omitted it; fixed there.
- Nightly `Site drift` workflow: clones the site, fails if the vendored copies are stale,
  and reruns the differential tests against the new site code.
- 74 tests, 97.7% lines. `dn-core.js`'s `saveStreak` also tries an async external store
  (`window.storage`, a Claude-artifact API); the app has no such store, so the port
  writes to its KV only.
- Not done here (deferred by design): the site adopting `@noodle/core` (open decision on
  the Plan tab; WP3 or later).

### 24 Oct 2026 — WP2 (site repo)

- [dailynoodle #21](https://github.com/alecldarlow-cell/dailynoodle/pull/21), merged and
  deployed: `tools/puzzle-json.js` writes `reports/<page>.json` for every released puzzle
  page with a `DN_PUZZLE` object (475 of 525 released cards; the 50 without are older
  self-contained pages) and `feed-lite.json` (180 KB). Evaluated in an empty `vm` sandbox
  with a 200 ms limit; plain data only. All 5,182 pages in `reports/` parse.
- Site regression check green; Build feed's live health check (now including today's
  eight data files and feed-lite) passed after deploy. `SITE.md` › _Puzzle data for the app_.
- Claude's workspace can't reach dailynoodle.co.uk directly (network allowlist); live
  checks are read from the site's own post-deploy step.

### 24 Oct 2026 — WP3

- `shared/storage`: AsyncStorage (SDK 58's vetted 2.2.0) behind a synchronous in-memory
  cache, hydrated at launch before the first screen, written through; per-key change
  subscriptions; `saves` = @noodle/core's save store over it. **Not MMKV**: v4 needs
  `react-native-nitro-modules`, which SDK 58 doesn't vet; the brief allowed either.
- `shared/query` (React Query, refetch on returning to the app), `shared/time`
  (London-day hook that ticks over at midnight and on resume; dates with a fixed month
  table — Node's Intl writes "Sept", the site writes "Sep"), `shared/played`
  (played states + overall run from saves), `shared/ui` (PuzzleRow, Note, Screen).
- **Today**: today's eight in the daily order; a list is used only if dated today in
  London; yesterday's list → "Nearly ready" with retries at 1, 5, 15 min; no signal →
  last accepted list for today, else "No connection" at the first failure (not after
  the retries); Try again cancels a pending retry and asks now (React Query otherwise
  waits out the backoff). Results in the site's words; run chip from 2 days.
- **Archive**: `feed-lite.json`, kept for offline; chips by type, find by number, months
  newest first; results on each row.
- Routes: root stack with the tab group and `play/[type]/[file]` (placeholder until WP4).
- 103 tests, 97% lines. One cosmetic `act()` warning from SectionList virtualisation.
- **Maestro**: flows written (`.maestro/today|archive|offline.yaml`). The CI job is
  deferred to WP6: Maestro needs an installed build, which EAS produces there. Running
  iOS simulators on GitHub's macOS runners for every PR would also cost about 10× Linux
  minutes for a hobby project; WP6 should decide between EAS Workflows' Maestro step
  and a nightly macOS job.

### 24 Oct 2026 — housekeeping

- Repo made private by Alec. Branch protection for `main` can't be set from Claude's
  workspace (GitHub settings writes are blocked), and GitHub Free doesn't offer it on
  private repos. Merges stay gated by the session rule: only when `check` is green.
- Expo SDK 58 confirmed as the current stable SDK (npm `latest`, 24 Oct 2026; 59 is canary only).
- Merged topic branches can't be deleted from the workspace either (the proxy refuses
  ref deletes); `wp0-scaffold`, `wp1-core`, `wp3-today` remain on GitHub, harmless.

### 24 Oct 2026 — WP4

- `shared/webview`: every puzzle plays through its live page in `react-native-webview`
  14.0.1 (SDK 58's vetted version), at `…/reports/<file>.html?via=app`.
- **Injected before the page's scripts** (`injection.ts`, ES5, tested by running it in a
  browser-shaped Node sandbox): `window.__DN_APP = 2`; the app's puzzle saves written into
  the page's localStorage (the app is the source of truth); any saves only the page had
  sent up once; every later write to a puzzle key (`digi-<type>-v1|streak`) reported with
  the open puzzle's id; `navigator.share` → the phone's share sheet; `dn:puzzle_end`
  forwarded (for WP5). Seeds are escaped so a value can't end the script. Game and board
  keys are never touched.
- **Merging page writes** (`messages.ts`): result docs through @noodle/core's
  `saveProgress` (a result the app holds is kept; new ones come in; the open puzzle's
  unfinished round takes the page's newer state); streak docs replace the app's.
- **Navigation** (`navigation.ts`): the page's own assets, the guide and privacy page load
  in place; "← Puzzles" and home go back; the finish sheet's Next opens that puzzle in the
  app; the board, games, other pages and other sites open in the browser (board moves in
  app with WP5). A failed load offers Try again.
- **Site** ([dailynoodle #22](https://github.com/alecldarlow-cell/dailynoodle/pull/22),
  merged and deployed): `page_view.inst` is 2 inside the app; browser test `track:app-inst`.
- `.maestro/bridge.yaml` added (runs from WP6). 151 tests, 97.8% lines.
- Can't be proven from here: real-phone behaviour of the injected script (iOS WKWebView
  and Android WebView both run `injectedJavaScriptBeforeContentLoaded` before page
  scripts, per the library). First hand check on Alec's phone once WP6 builds exist.

### 24 Oct 2026 — parallel lanes

- Alec allowed parallel work. `shared/results` (`announceFinish` / `onFinish`) is the seam
  between lanes: the bridge (and native players from WP8) announce a finish with the
  page path and the site's `dn:puzzle_end` detail; leagues (WP5) subscribe. Features
  still never import each other.

### 24 Oct 2026 — WP5

- [#8](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/8), merged. Leagues tab: league switcher, All puzzles
  (board_overall: day and Monday–Sunday week), each puzzle's day board with the day bar, start / join (code, pasted
  invite link, or `/leagues?join=<code>`) / leave, League settings (PIN, Send me my link / Paste a link; owners:
  rename, Let back in, Remove, New join code, Close), invites and board shares through the share sheet
  (`…board.html?join=<code>&v=2`). Wording from board.html ("this browser" read as "this app").
- `@noodle/core` `board.ts` and `handoff.ts`: ports of dn-board.js (noodle-board-v1 in the browser's shape, pid as
  uuid v4, submit mapping, claim, settlePending, backfillPlan, moveLink) and dn-track.js's #dnmove= import.
  Personal-link merges use dn-track's mergeObj (the site's rule; first result kept).
- Differential against the site's own code (dn-board.js and dn-track's import block vendored, watched by Site
  drift): 600 seeded cases each — identical storage after a link import, identical links, identical
  board_backfill / board_submit calls, identical claim state. Five deliberately broken rules each fail the suite.
- `features/leagues`: typed rpc over @supabase/supabase-js 2.118.0 (EXPO*PUBLIC_SUPABASE_URL / \_ANON_KEY; without
  them every call fails `not_configured`, so no test can reach the live project), 16 board*\* wrappers with argument
  names pinned by a test, React Query hooks, Yup 1.7.1 schemas. `LeagueResults` (mounted in `src/app/_layout.tsx`)
  submits every `onFinish` for members; backfill when the board opens.
- "Already a player?" (Leagues intro, Account): code or invite → nickname → PIN → board_claim, or "Which leagues
  should this app use?"; or a personal link → saves merge, board adopted. Identity is never inferred.
- 213 tests at merge. Deferred: CI job with a local Supabase stack (needs WP6 builds for its Maestro step); the
  finish sheet's "See today's board" (bridge and native) still not routed to the Leagues tab — follow-up.
- Contracts tab correction: noodle-board-v1 leagues also hold `members` and `pin`, as the site saves them.

### 25 Oct 2026 — WP8

- [#7](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/7), merged: the port recipe
  (`docs/port-recipe.md`), shared `start-card` (house.js) and `finish-sheet` (finish.js: kicker, result, note,
  share line + `dailynoodle.co.uk/<type>` through the share sheet, stats, Next row, board slot, countdown and
  run, recap), and the Mini played natively (`features/puzzles/mini`: model, oracle, finishing, simulate, screen).
- **Differential replay** (`scripts/replay.js`): the oracle's moves through the page's real controls (site
  harness, headless Chromium, paused fake clock, jittered taps) and through the native model; board compared after
  every move, then both saves, the `dn:puzzle_end` detail, share line, sheet text, and the reopened sheet.
  `--all`: 761 Minis × 4 variants (fresh, live streak across London midnight, pre-tz grace, lapsed): 3,044/3,044
  identical, 144,956 moves. Mutation check catches broken delete-back and Check-all counting. CI job `replay`
  (`--sample 50`); nightly `Replay nightly` runs `--all` (~100 min).
- `enabled = true` for the Mini; other types stay on the bridge. Data from `reports/<file>.json`, kept as
  `noodle-app-puzzle:<file>`; no data, refused data or offline without a copy → the bridge.
- Site wins over the brief: the Mini's clock starts on the first letter, delete or reveal, not on Play. Reveal all,
  Reset and the keyboard toggle are hidden on every device on the site, so not ported; outcome always "solved".
- No new dependencies. Celebration and haptics left for WP12. Today's list fetch moved to `shared/today`.
- `.maestro/mini.yaml` written; `bridge.yaml` now opens the Doku.

### 25 Oct 2026 — WP6 (preparation)

- Alec's calls: home-screen name **Daily Noodle**; bundle id / package **uk.co.dailynoodle.app**.
- `app.json`: bundle ids, `runtimeVersion` fingerprint policy, `expo-updates` plugin, iOS export-compliance flag.
  `eas.json`: development / preview / production profiles extending a base that carries the public Supabase
  values. ADR-005: `expo-updates` 58.0.18 and `expo-dev-client` 58.0.15 (first-party, SDK-vetted).
- `.github/workflows/release.yml`: on every merge, an EAS Update to `preview`; "Run workflow" builds (profile,
  platform, optional TestFlight submit). Every job skips until the `EXPO_TOKEN` secret exists.
- Account screen shows "Version · channel · update" (`shared/build`).
- `docs/install.md`: Alec's one-off steps (Expo, Apple, Play accounts; `eas init`; `EXPO_TOKEN`; first iOS build
  by hand for certificates; testers). Config validated with `expo config`; both bundles build.
- Open: Maestro in CI once builds exist (EAS Workflows step vs nightly macOS job).

### 25 Oct 2026 — WP7

- **Database** (site [#23](https://github.com/alecldarlow-cell/dailynoodle/pull/23), docs
  [#24](https://github.com/alecldarlow-cell/dailynoodle/pull/24)): `toolchain/sql/2026-10-25-sync.sql`, a private
  `sync` schema storing a signed-in player's save documents verbatim, reached only through `sync_pull` /
  `sync_push` / `sync_forget`, callable only by the signed-in user on their own rows; puzzle keys and
  `noodle-board-v1` only; 256 KB per document. PGlite tests SYNC-01..04. **Applied to the live project** with
  Alec's go-ahead after a rolled-back dry run; advisors show only the expected notices.
- **Design change from the plan:** no `user_id` on `board.players` and no `board_claim` variant. The league
  identity syncs as the `noodle-board-v1` document, and pulling runs the personal-link import (`importMove`), so
  a phone in no league becomes the account's player, and a phone playing as someone else asks ("Which leagues
  should this app use?") instead of switching. The board schema is untouched.
- **App** (`features/account`): sign-in by email link (`signInWithOtp`, back to `dailynoodle://auth`, the
  `/auth` route sets the session); session in the secure store, chunked under 2 KB per item
  (`expo-secure-store` 58.0.2); its own Supabase client, separate from the anonymous leagues client. Sync is
  always pull → merge → push (`runSync`), so two phones never overwrite each other; it runs on opening the app,
  on returning to it, on signing in, and 3 s after every finish (`SyncRunner`, mounted at the root). Account
  card: email form (Yup), "Check your email", signed in as …, last synced, Sync now, Sign out, Delete my synced
  copy (asks first; keeps this phone's saves). Off unless the build sets `EXPO_PUBLIC_SYNC=1`.
- 317 tests, 97.8% lines.
- **Before turning it on** (Alec): Resend account, verify dailynoodle.co.uk with its DNS records in Cloudflare,
  Supabase Auth › SMTP (smtp.resend.com, 465, user `resend`, the API key, sender e.g.
  `noreply@dailynoodle.co.uk`), and `dailynoodle://auth` in Auth › URL Configuration › Redirect URLs. Then set
  `EXPO_PUBLIC_SYNC=1` in `eas.json`. Supabase only emails its own organisation's members without a custom sender.
- Not yet: website sign-in (the site's half of WP7). It can follow once email works, reusing the same functions
  and the site's dn-track import.

### 25 Oct 2026 — WP9

- [#11](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/11), merged: Sweep and Path native, ported line for line from `engines/sweep.js` and `engines/path.js` following `docs/port-recipe.md`. Both on.
- **Sweep**: the engine's gate (`deduceStep` with `why`, `solveNoGuess`, `countSolutions`) refuses what the page refuses; dig, long-press flag, Dig/Flag modes, crossed-out numbers, the all-36-called nudge. One mine ends it (`{o:'loss', s, b}`, streak to 0 via `recordResultStreak`); "Play again (not recorded)" replays as the page does. Hint with `provable()`, the wrong-flag line, the page's wording, ringed numbers and a 2.4 s mark. `shareSweep` with the day from the id.
- **Path**: the two-end tap rules unchanged (Alec's call), Undo, Hint's forced square; clock starts on Play; `{t:'m:ss'}`, `bumpPathStreak`, `sharePath`.
- **Replay**: one runner, `scripts/replay/<type>.js` modules, `--shard k/n`. `--all`: Sweep 731 pages, 4,386 runs, 162,973 moves; Path 760 pages, 3,040 runs, 130,476 moves; all identical. The 30 older Sweep pages without `DN_PUZZLE` stay on the bridge. Breaking the model on purpose fails the replay.
- **Site findings**: (1) after Play again, `finish.js show()` dropped the adopted title, time and streak ids (Sweep and Link): fixed on the site, [site #31](https://github.com/alecldarlow-cell/dailynoodle/pull/31); (2) Path doesn't repaint after a refused tap, so when Hint switches ends the old end stays lit (ported as painted; Alec's call whether to fix on the site).

### 25 Oct 2026 — WP10 (Link, Tangle)

- [#12](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/12) merged: Link and Tangle native; [#16](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/16): their screen tests get the Mini's 30 s timeout. Both on.
- **Link**: `engines/link.js` ported line for line (gate, toggle, submit in board order, one away, free repeats, the settle, four mistakes and the reveal, restoreDone, replay label, Play again (not recorded)). Random deals and shuffles are passed in as moves; the replay reads each order from the page. Record `{o,t,m,r,g}`, `recordResultStreak` on today's first go only, `shareLink`.
- **Tangle**: `engines/tangle.js` ported as an engine with storage, clock and timers handed in: gate, save via `saveProgress`, drag and tap tracing with the page's hit-testing, 3-2-1 then 90 s on the page's 100 ms tick, scoring, pause on back or leaving the app, endRound `{o:'played',s,w,st,d}`, best, own-day streak.
- **Replay** `--all` identical: Link 347 pages, 2,082 runs, 72,870 moves; Tangle 671 pages, 3,355 runs, 70,455 moves; confirmed again on `main` (run 40189412051, which also passed Mini: 761 pages, 3,044 runs, 144,916 moves).
- Left: haptics (WP12), Tangle's settings switches, hardware-keyboard typing and Yesterday's answers.

### 25 Oct 2026 — WP11 (Doku)

- [#15](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/15) merged off (the lane stopped at the usage limit before its full replay); [#22](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/22) switches it on after a sample proof (Alec's call: native now, sample first, full overnight).
- Ported line for line from `engines/doku.js`: tile-then-square and type-on-keyboard placing, send back, Hints switch, the full-grid note, the clock from the first tile or delete, `putDone {s}`, `bumpSolveStreak` in `digi-doku-streak` seeded by `seedDokuStreak`, `shareDoku`.
- Replay (`scripts/replay-doku.js`): five variants per Doku; CI samples 20. Sample proof for switching on: today and the next three days, 20/20 runs identical (493 moves). Full replay of every Doku dispatched on GitHub on the evening of 25 Oct.
- Not ported (hidden on the page on every device): Reveal all, Reset, drag and drop from touch.

### 25 Oct 2026 — WP10 (Reckon, Borders)

- [#18](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/18): Reckon and Borders native. The lane stopped mid-way; Claude rebased it onto Sweep/Path and Doku (merging both lanes' replay runners: `begin`/`probe` hooks for players with their own home screen and a frame-timed clock), wired their starts to the visit recorder, and switched both on after a sample proof (Alec's call): today and the next three days, every variant, identical (Reckon 16/16 runs, 640 moves; Borders 16/16, 396 moves), plus CI's 20 each. Full replay of every Reckon (438) and Borders (680) dispatched on GitHub the same evening.
- Reckon: Ballpark's two-decade scale and wording, scoring 100/75/50/25, `{p,b,z,g,secs,d}`, `cur` resumed exactly, own-day streak, `shareReckon`, "Today's ten".
- Borders: four names in the page's stamped order, Show on map halves the base, run bonus, `{c,p,secs,ans,on}`, Borderline's atlas updated in place, streak on every finished round, `shareBorders`; outlines drawn by the engine's own drawing code in a WebView loaded on first use (no new dependency).

### 25 Oct 2026 — sign-in, recording, CI and the site

- **Website sign-in** (site [#28](https://github.com/alecldarlow-cell/dailynoodle/pull/28), [#30](https://github.com/alecldarlow-cell/dailynoodle/pull/30), [#32](https://github.com/alecldarlow-cell/dailynoodle/pull/32)): `dn-sync.js`, a card under the board, sync = pull → `dnMove.importData` (dn-track's `#dnmove=` rules, exposed unchanged) → push; puzzle pages pull on open and push after the finish; switched off (`ON = false`) until Resend and the redirect URLs. App [#17](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/17): the same league rules in the app (skip the account's own player; hold back the board while a choice is pending) and a re-vendor.
- **App plays recorded like website plays** (Alec's call): app [#19](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/19), site [#29](https://github.com/alecldarlow-cell/dailynoodle/pull/29) (privacy wording). Native puzzles send page_view / puzzle_start / puzzle_end exactly as dn-track.js, `inst: 2`; one visitor code (`digi.aid`/`sid`/`last`/`optout`) shared both ways with every page the app opens; the privacy page's switch stops native recording too; nothing from development builds.
- **Play listing** ([#14](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/14)): `docs/play-listing.md`, `store/feature-graphic.png`, Account › Privacy opens the privacy page in the app.
- **Publishing outage, 11:33–13:40**: a race in the new SYNC-WEB-08 test (a step during the board's one reload after a sync) failed every release; fixed by a settled marker the tests wait for (site #32), which also turns CI failures into annotations Claude can read. Then BOARD-E2E-01 (records) raced two phones; with Alec's go-ahead the phones now finish in turn, every check unchanged ([site #33](https://github.com/alecldarlow-cell/dailynoodle/pull/33)).
- **CI cost and speed** (Alec's call: a sample does): app [#20](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/20) replays only the types a change touches, each on its own runner at once (about 7 minutes, from 20); [#21](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/21) the nightly replays new or edited puzzles (≤10 a type) and a type in full only when the site changes its engine. The old full nightly was disabled.
- **Rule from Alec**: touch the site only when the app needs it or he asks; site bugs the app's testing finds are reported, and fixed when tested and harmless (site #31).
- **Alec's to-do guide**: https://claude.ai/artifact/CpiPm7oB6wtisZ8x9DDbtm (first Android build, EXPO_TOKEN, phone test, Resend, Play internal testing, branch protection, tidy-ups, iPhone without a Mac).
- **Actions minutes**: the app repo was private, so its runs counted against 2,000 free minutes a month; 1,786 were used by mid-afternoon (the lanes' full replays 779, CI 993 before #20). Alec made the repo public on 25 Oct (history checked first: only the public Supabase key), so Actions are free; the nightly is back on.

### 25 Oct 2026 — full proof of Doku, Reckon and Borders

- Replay nightly, dispatched with types `doku reckon borders` (run 40208602946): every Doku (2 shards), Reckon (4)
  and Borders (6) identical. All eight native types are now proved on every puzzle with data. The run recorded
  the engine hashes as verified, so later nights replay only new or edited puzzles unless an engine changes.

### 25 Oct 2026 — See today's board

- [#25](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/25): members see "🏆 See today's board" on every
  native finish sheet, opening Leagues on that puzzle and day (`p`, `d` params, as board.html). Once the result is
  on the board, `board_moment` gives the league-record or personal-best line (site wording), and a league record
  adds 🏆 to the share line (finish.js `tagged`). Shared reaches leagues only through a `BoardSlotProvider` at the
  root. A bridged page's board.html link opens Leagues too.
- Started by a lane that was stopped; finished by Claude (an un-awaited unmount in the new test left the next
  render inside an open act), rebased over polish. 778 tests, 98.18% lines; CI replayed all eight types (one
  Link timing blip on CI, 120/120 identical locally on the same sample, green on rerun).

### 25 Oct 2026 — WP12 (polish)

- [#26](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/26), merged; no model changes.
- **Haptics** (`shared/haptics`, expo-haptics 58.0.7, ADR-006): each type's `hooks/feel.ts` rule compares the
  state before and after a move (tap / error / success), so the replay-proved models are untouched and opening a
  screen never buzzes; Reckon honours its saved `hap` setting (read, never written).
- **Finish entrance**: a short fade-and-rise on a fresh finish only, still under reduce motion (built-in Animated).
- **Accessibility**: a quiet timer clock, stat and Back labels, 44 pt Play/Share, Link groups and the Tangle grid
  labelled, font-scale caps on fixed grids. **Small phones**: Mini, Doku, Sweep and Path boards fit 320 wide.
- Left for a real phone: buzz strength, entrance timing, TalkBack on the clock, largest text sizes, Mini at
  568 pt height. Haptics need a new EAS build (native module).

### 25 Oct 2026 — Expo project linked

- [#27](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/27): project id `e45ae724-8006-40ea-87ac-45ef75ceef81`,
  owner `smellyoldog`, EAS Update URL, from Alec's `eas init` on his PC. Alec's first Android preview build was
  started from his PC the same afternoon (before polish merged, so without haptics).
- **Needs Alec**: EXPO_TOKEN secret (then Claude runs a second build with everything), the phone test, Resend and
  the two redirect URLs, Play internal testing, branch protection and auto-delete of merged branches (now free).

### 25 Oct 2026 — first phone test (Pixel 10 Pro)

- Branch `fix/android-tab-icons-crash`. Tested on Alec's phone over Wi-Fi debugging (adb): install, crash log,
  screenshots and taps.
- **Launch crash fixed**: preview build `0410537b` crashed on open; the native tabs' `md` icons need
  `expo-symbols` on Android. Added 58.0.4 with Alec's approval (ADR-007). Preview build `31289795` (commit
  3371b13) opens with no crash.
- **Phone checks**: Today lists the eight puzzles; Mini and Sweep native; a Mini solved by tapping (0:18, streak
  1, Share opens Android's sheet, "Next: Doku"); Leagues and Account render; Account › Privacy opens in the app.
- **Archive chips clipped** at 115% font size: the row could shrink under the list. `flexShrink: 0` plus a test;
  checked on the phone through an EAS Update to preview.
- **Release workflow**: eas-cli 25.3.0 refuses `update --non-interactive` without `--environment` (seen running it
  by hand), so the first run with EXPO_TOKEN would have failed. Added `--environment preview`, and the commit
  message now goes through an env var (first line only).
- The 17:19 build failure was a stale `node_modules` on Alec's PC (expo-haptics not installed yet, so the local
  fingerprint differed). Run `npm ci` after pulling, before `eas build`.
- Set up by Claude in Alec's browser: Resend domain verified (DKIM, two forge CNAMEs, DMARC on Cloudflare);
  Supabase custom SMTP through Resend (Alec pasted the key); redirect URLs `dailynoodle://auth` and
  `https://dailynoodle.co.uk/board.html` added; merged branches auto-delete in both repos.
- **Not yet**: sign-in stays off (Alec's call; switching it on means site `dn-sync.js` ON = true with SYNC-WEB-01
  updated, then `EXPO_PUBLIC_SYNC=1`). Left for Alec: airplane-mode check and "Bring my leagues here" with his
  personal link; deleting the 43 already-merged branches.
- **Leagues broken by a hand-published update, then fixed**: `eas update` doesn't read eas.json's build env, so
  the first chip-fix update shipped without `EXPO_PUBLIC_SUPABASE_*` ("Leagues aren't available in this build").
  Republished with the preview profile's env; Alec then added his league. Release now evals
  `scripts/eas-profile-env.js preview` before `eas update` (tested). Publish updates by hand the same way.

### 25 Oct 2026 — build settings on phones; sign-in on

- **Release builds never saw the Supabase settings in two places**: `shared/track/app.ts` (visit recording) and
  `authClient.syncEnabled` read `process.env` through a default parameter, and Expo only fills in
  `process.env.EXPO_PUBLIC_NAME` written out in full (a release build's `process.env` is just NODE_ENV). So app
  plays were never recorded from phones (since #19) and sign-in could not be switched on. Found by exporting a
  bundle with `--no-bytecode`; `shared/env` BUILD_ENV fixes both, and a test refuses any other `process.env` use.
- **Sign-in on** (Alec's call, after seeing the website card on his phone): site
  [#34](https://github.com/alecldarlow-cell/dailynoodle/pull/34) (`ON = true`, SYNC-WEB-01 now tests the
  published card, with his approval) first, then `EXPO_PUBLIC_SYNC=1` in eas.json here.
- **Left for Alec**: try sign-in once both are live (Account › email link on the phone; then board.html on the
  laptop) and check results appear on both.

### 25 Oct 2026 — puzzle visual polish

- Earlier today, also merged: app #31 (BUILD_ENV), #32 (`.gitattributes` LF, so CI builds the same fingerprint as
  a Windows clone and updates reach phones), #33 (Tangle screens opt out of React Compiler; count-in froze on 3).
  Play internal testing release 3 (0.1.0) is out to testers.
- **Polish** ([#34](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/34)): Instrument Serif and
  Archivo bundled (OFL); one shared `StartLayout` for all eight start cards (Tangle, Borders, Reckon homes rebuilt
  on it); finish sheet to finish.css values; Tangle word chips; Sweep raised squares and start pulse; Link words
  no longer break mid-word; Reckon's guess big and centred. Checked on the phone over EAS Update against the site
  (old archive puzzles; one accidental open of today's Doku 104 with no moves, a stray `start` event only).
- Tests proved: every font family bundled; no Georgia or `fontWeight` left in the players; `splitHero`;
  `tileLines`; the Sweep start pulse appears once and stops after the first dig. 810 tests pass.
- **Left**: start cards say "Today’s Mini" on archive puzzles too (as the site's house.js does); Mini's Check
  buttons sit above the grid where the site puts them below.

### 26 Oct 2026 — sign-in link stuck on "Signing in"

- **Bug** (Alec, Pixel): tapping the email link opened the app's auth screen but the spinner never ended.
  `AuthLinkScreen` read the link with expo-linking's `useURL()`, which only sees the launch URL or link events
  after mount. With the app already open, the link arrives as a new intent and expo-router navigates to `/auth`
  before the screen mounts, so the URL stayed null. Supabase's side was fine (`redirect_to=dailynoodle://auth`).
- **Fix** ([#37](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/37)): `useLinkingURL()`, which reads
  the latest link expo-linking tracks natively (updated on new intents). Shipped to preview over EAS Update.
- **Process slip**: #37 was merged before its CI finished; CI then passed on the PR and on main, and
  `npm run check` passed locally afterwards (810 tests). The `fix/auth-link-warm-start` branch needs deleting by
  hand (the session couldn't).
- **Left for Alec**: try the email link on the Pixel with the app already open, and again with it closed.

### 26 Oct 2026 — polish from Alec's Pixel test (celebration, records, finish sheets)

- **Win celebration** ([#39](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/39)): the site's board
  wave (Mini/Doku/Sweep diagonal, Path all at once) and confetti at the site's moments, from a root layer so it
  carries on over the sheet; fresh wins only, nothing under reduced motion; built-in Animated, no new dependency.
  Bursts trimmed to 150/60 (site 200/80). #39 was merged before its CI finished; CI then passed.
- **Archive** ([#40](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/40)): find-by-number box removed
  (Alec's call).
- **Leagues Records pill** ([#41](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/41)): `board_records`
  — league records, honours, players, player cards, `?p=records`. LeaguesScreen.test's "unknown puzzle" example
  was `?p=records`; now `?p=crossword` (same intent). Not ported yet: the daily board's "🏅 League record" line,
  "🏆 New league record" on a row, 👑 after names on the daily/All boards.
- **Tangle** ([#42](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/42)): letter board no longer moves
  (fixed-height word list, word line and toast line).
- **Finish sheets** ([#44](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/44),
  [#45](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/45)), from a side-by-side review against
  finish.js/finish.css: Link squares/bands/marks (drawn ✓ ✕: the bundled fonts have no ✓ ✕ ⚑ ★), dark-mode group 4,
  one `FinishLink` style, bold note runs (Tangle, Reckon), sheet colours; `RecapGrid` at the site's 300 wide for
  Mini/Doku/Sweep, Path's thread line and pills, Sweep drawn flags, Reckon badges, equal Tangle chips, Borders
  recap palette. Dropped: no-wrap emoji in the share line (would make the shown line differ from the sent one).
- **Link in play** ([#46](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/46)): miss wobble + red,
  spent pip flash, the settle (tiles turn one by one, fly to the band's row), band landing swell; timed to the
  model's SETTLE_MS, so the model and replay are untouched.
- **Sign-in link fix** (morning, [#37](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/37)) is logged above.
- Tests proved: confetti physics against the site's per-frame loop; burst timing/aim/cancel; reduced motion off
  everywhere; boards wave the right squares; records tab end to end; Tangle heights constant through a round;
  sheet parts in light and dark; Link motion on miss, repeat, settle and landing. `check` green on every PR.
- **Needs Alec**:
  - **App icon** ([#43](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/43), merged on Alec's go-ahead):
    DN inside Android's safe zone, opaque iOS square, themed monochrome. It changed the fingerprint, so JS updates
    no longer reach the current install: a new preview build (Release › Run workflow, Android) is needed.
  - On the Pixel (EAS Update, reopen twice): the celebration, Records, Tangle, the finish sheets, Link's motion.
- **Small bits** ([#48](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/48), Alec's go-ahead): records
  load with every board view: 👑 for last week's champion, "🏆 New league record" on the row, the "🏅 League record"
  line under each daily board, tap a name for their card; Tangle's "Play more boards in Yarn".

### 26 Oct 2026 · Polish batch A: shell, Today, Archive ([#54](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/54))

- Status bar from the scheme; tab bar and stack headers themed from tokens (green Android pill, Archivo labels);
  light puzzle paper = house canvas `#FCFCFB` (Alec's call), light `sheet` `#F1F0EC` so cards still show; masthead
  and PuzzleRow hold at font scale 2.0; 44–48 pt targets (chips, Done switch, Note buttons); real pull-to-refresh
  state + themed spinner on Today and Archive; skeleton rows; site `.note` look; "No connection" only when offline.
- Back-to-Today bug: a second Back after a puzzle closed fell through to the tabs (`backBehavior` 'initialRoute').
  Now 'none' (test reproduces it on the old value); tabs anchored under every screen; +not-found and error boundary.
- Tests proved: router flows via `renderRouter` (Archive → puzzle → Back ×2, cold deep link, not-found, crash/retry),
  tokens, large-text layout maths, skeleton motion/reduce-motion, refresh spinner lifecycle. `check` green locally.
- **Needs Alec**: Android Back on a non-Today tab now exits the app (trade-off of the fix); phone pass in light/dark
  and at 2.0 (list in the PR). Optional players follow-up: `router.dismiss()` instead of `router.back()` in the eight
  `*Screen.tsx` `back` helpers.

### 26 Oct 2026 — Polish C: Leagues and Account ([#55](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/55))

- Fixed:
  - Settings' rename box now follows the league picked. Before this, Save could rename a league to another league's name.
  - Pull to refresh reloads the boards, with a themed spinner.
  - A failed board has Try again and tells offline apart from a server fault (`BoardError('offline')`).
  - No raw Supabase text reaches players (`sayError`, `authMessage`).
  - Account points to a league choice left pending by sync.
  - Repeat taps into Leagues act again (an `n` param, and the route is cleared once read).
  - The sign-in screen has Cancel and a 15 s give-up.
  - Shared `Button`/`TextField` (44 pt, field edge 3:1), the app's fonts and 44 pt targets throughout.
  - `keyboardShouldPersistTaps="handled"` on the shared `Screen`.
- Tests proved: the rename test fails without the fix; refresh, offline/retry, repeat asks, the pending pointer, the auth timeout, button/field contrast, no `fontWeight` in either feature. `check` green.
- Left: the offline invite still reads as "expired" (joining review); `/auth` header (router).
- Needs Alec (phone): the keyboard taps on iOS's number pad; `setParams` clearing under NativeTabs (repeat "Bring my leagues here", reopen an invite after "Not now"); the fonts and spinner in dark mode.
