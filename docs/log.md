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

### 26 Oct 2026, polish batch B1 (Mini, Doku, Sweep, Path, shared chrome)

- [#57](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/57) (not merged):
  - A Sweep from a past day says "A past puzzle — this one won't change your streak." in place of the site's "Today's result is already in — this is a replay". This changes only the text on screen; the model and the replay are untouched.
  - The bar's flame now shows each type's live streak, the same number as its start card.
  - The bar clocks all read "0:03".
  - The clock pauses while the app is in the background (shared `usePuzzleClock`).
  - Path shakes the square and buzzes on a rejected tap.
  - New shared helper `pressable()` in `@/shared/ui` gives every in-scope button a pressed look.
  - Contrast fixes on Mini, Doku, Path and Sweep.
  - Shared chrome: stat numbers stay on one line, the Share pill stacks under the share line at large text, the board bar's name is a heading, and a fresh finish is announced and focused for screen readers.
  - Boards are now sized from the space they actually get (`useBoardFit`).
- Tests proved:
  - Archive wording and the flame against a lapsed or live streak.
  - The clock pauses on background and on iOS's inactive state (AppState mocked).
  - Pressed looks on every in-scope button.
  - Mini, Doku and Path colours in light and dark, including contrast ratios.
  - Path shake and buzz, and the Sweep wrong-flag ring and pulse.
  - Boards shrink to fit a measured slot.
  - The finish announcement and focus.
  - `check` is green (916 tests, 98.31% lines).
- Left:
  - The gap above the board on tall phones. The board is as wide as the screen allows and stays centred in a taller space; closing the gap means changing the layout.
- Needs Alec:
  - Decide that tall-phone layout.
  - Phone checks: background pause, TalkBack/VoiceOver on a finish, font scale 2.0, dark mode.

- **Polish B2: Link/Tangle/Borders/Reckon** (26 Oct, branch `polish/batch-b2-puzzles`, PR linked from the branch):
  Link: an archive Link never played no longer says "· replay" / "Today's result is already in" (display only:
  `shownLabel`/`shownMsg`; the model's `msg`/`label` and the replay are untouched), the bar's flame is Link's live
  streak as on its start card, dark-mode board colours (g4 `#ECEEF4` on paper, soft red miss tint), one tile font
  per board (link.js fitFont), mistakes-left read with its count. Tangle: board capped by height, gold tokens,
  each tile a screen-reader button. Borders: text caps + scrolling column. Reckon: narrow top row, pip hitSlop,
  score label with its number. All four: pressed state; iOS announcements for the feedback line.
  Tests proved: each of these through the screens (GIVEN/WHEN/THEN), `check` green. Left: Borders map WebView still
  reloads per question (needs a phone to verify an injectJavaScript redraw). Needs the phone: VoiceOver on the
  four, Tangle on an SE-size phone, Borders at font scale 2.0, Link in dark mode.

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

### 26 Oct 2026, polish batch D (brand, saved progress, Tangle, tall phones, Back, small fixes)

- [#61](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/61) (not merged; stacked on #54, #53, #57):
  - Green DP icon, adaptive icon and splash, drawn by `scripts/make-icons.js` from Archivo ExtraBold. Light and dark splash. This needs a new native build.
  - Mini, Doku, Sweep and Path keep an unfinished round under `noodle-app-progress-<type>` (new app-only keys, approved by Alec). It is replayed through the model's own `init`/`apply`.
  - Tangle uses the site's blue thread and tiles.
  - On tall phones the four grid boards sit under the bar (`BOARD_SLOT`).
  - The tabs keep their default Back. `usePlayerExit` guards a double Back in all eight players.
  - Doku has bigger bank tiles, and Hints sits on the message line.
  - A cut card blurb ends in one ellipsis.
  - How to play and Privacy show one header.
  - Sweep draws its flag and mine as the site does.
  - Mini clue numbers are at least 10 pt.
  - Link, Tangle, Borders and Reckon use the shared `pressable()`.
- Tests proved: the router's Back in both cases, and the exit helper. Progress for all four types: restore, write, clear on finish, bad values, another puzzle. Colours and glyphs, layout, the blurb cut, and icons against the tokens and the script's output. `check` green (1132 tests, 98.73% lines).
- Left:
  - Date labels are unchanged: they already follow the site cards' `relTime` rule.
  - The Today card could show "In progress" for a kept round. The site shows it only for Tangle, Borders and Reckon.
- Needs Alec: a native build for the icon and splash, then the phone checks listed in the PR.

### 26 Oct 2026 — League joining: App Links and one way in ([#58](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/58), this PR; site [dailynoodle#37](https://github.com/alecldarlow-cell/dailynoodle/pull/37))

- Why: the league-joining review (Alec's go-ahead, 26 Oct). Six ways in became three: join (a link or a code, through
  one invite screen), "Already in X? Pick your name" with the PIN, and sign-in sync.
- **App Links** (#58, merged): invites are `https://dailynoodle.co.uk/join.html?c=CODE`. Android opens them in the app
  (`app.json` intentFilters, verified by the site's `/.well-known/assetlinks.json`, which is live with the EAS key's
  SHA-256); `+native-intent` → `systemPath()` → `/leagues?join=`. Never board.html (it carries the website's sign-in
  links). Browsers go on from join.html to `board.html?join=CODE&v=2`. Leaderboard shares keep board.html.
- **One way in** (this PR):
  - A typed code opens the invite screen (peek first): league name, "Already in X? Pick your name", and "No league has that code".
  - An invite that can't be fetched says "Couldn't reach the leagues" + Try again, not "expired". Back is there for players in no league too.
  - The personal link is gone from the app: PasteForm, "Send me my link" / "Paste a link", `?go=paste` (now just opens Leagues), `useHandoff`. `importMove` stays for sync.
  - Intro: no separate claim link. Account: "I have a league PIN", with sign-in as the way to bring leagues across.
  - After joining (sync builds): "Sign in on Account".
- Tests proved: the systemPath/decide rules (auth, board and other-host links untouched), the intent filter is exactly join.html, the join journeys above, offline vs. expired, the claim pending choice both ways. Changed on purpose: the invite share text, the Account button's label, PendCard's wording. `check` green.
- Left:
  - Play's app-signing fingerprint goes into assetlinks.json after the first Play upload (site PR).
  - Switching the website's own invites to join.html (Alec: later).
  - iOS universal links, with an iOS build.
- Needs Alec: a new native build for App Links. On the phone: `adb shell pm get-app-links uk.co.dailynoodle.app` shows verified; tapping a join.html invite in WhatsApp opens the app on the invite.

### 26 Oct 2026 — refinement session: review, batches, builds, Play closed test

- **Review:** five code-audit agents (app shell, shared chrome, both puzzle groups, Leagues/Account), plus a phone pass in dark, light and font scale 2.0 on old archive puzzles. Notes are outside the repo, in Claude's side-session notes.
- **Alec's calls:**
  - Past days' heading: kept #50's rule. App #35 was closed.
  - Mini's Check buttons sit below the clue bar ([#36](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/36)).
  - The flame shows that puzzle type's streak.
  - Borders: points everywhere, no run bonus (site [dailynoodle#35](https://github.com/alecldarlow-cell/dailynoodle/pull/35), app [#56](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/56)).
  - Warm paper in light mode; Tangle in the site's blue; save mid-puzzle progress; boards top-aligned on tall phones.
  - Icon: green **DN** ([#63](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/63)), after a DP version.
  - Version 0.2.0 ([#62](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/62)).
- **Merged:**
  - Polish C [#55](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/55), A [#54](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/54), B2 [#53](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/53), B1 [#57](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/57), D [#61](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/61).
  - Tangle replay seed fix [#59](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/59). The seeded "other day" was Tangle 1, which now has a data file.
  - Site [dailynoodle#36](https://github.com/alecldarlow-cell/dailynoodle/pull/36) (another session): data files for Tangle 1–9 and Borders 1–2.
  - League joining (another session): #58 and #60, site #37.
- **Proved on the phone** (preview build `8bd9988f`, installed over adb):
  - the green pill tabs;
  - `pm get-app-links`: dailynoodle.co.uk verified, and a `join.html` link opens the app;
  - Back from an archive board returns to Archive with its filters;
  - Mini 94 reopened with its letters and 0:10;
  - boards sit under the top bar.

  The launcher showed DP then; DN came after.

- **Play:**
  - New phone screenshots in `store/screenshots/new/` (untracked), saved as a store-listing draft. They show a real old-Mini-92 solve: 2:59, no checks; it now counts in Alec's played stats.
  - Closed testing – Alpha: United Kingdom; testers are the Google Group `dailynoodle-testers@googlegroups.com` (anyone can join, owner-only posting and member list).
  - The account is personal, so production needs 12 opted-in testers for 14 days.
- **Ops notes:**
  - `gh` isn't installed. PRs and merges go through the REST API with the git credential.
  - The Release workflow only queues EAS builds. Expo's free queue took about 2 hours this afternoon.
  - A stray jest process from a finished agent locked `node_modules` (EPERM on `npm ci`); stopping it fixed that.
- **Left:**
  - Borders cards still say "out of ten" / "Scored 5/10": the site's blurb and the app's result line.
  - Upload the DN 0.2.0 build (production EAS `2b29e8d6…`) to the closed track. It's over 10 MB, so Alec drags it in.
  - Send everything for review.
  - Add Play's app-signing SHA-256 to assetlinks.json.
  - Share the group link in WhatsApp once the release is live.

### 26 Oct 2026 — Borders rows say points (this PR; site [dailynoodle#38](https://github.com/alecldarlow-cell/dailynoodle/pull/38))

- Why: Borders scores in points since 26 Oct (100 a right answer, 50 with Show on map, no run bonus; site #35, app #56), but a phone check found "Scored 5/10" on the Today/Archive rows and "Your score is out of ten" in the Borders blurb.
- Site (#38, merged): every Borders file's standfirst now ends "100 points for each right answer." (past and forthcoming; the generator copies the newest file, so future days follow). Played cards on Puzzles show "650 points · 7/10".
- App (this PR): `@noodle/core` `resultText('borders')` matches: "650 points · 7/10", "Scored 7/10" only for a save with no points. Re-vendored the site at `cca96754` (only Borders' result line changed). The blurb comes from the site's feed, so it needs no app change.
- Tests proved: the four Borders wordings (`played.test.ts`); the Today row reads "Borders 20, 650 points · 7/10" (fails on the old wording); the differential test against the new front.js. `check` green (1152 tests, 98.76% lines).
- Left: nothing.
- Needs Alec: nothing (JS-only; reaches phones with the next build or update).

### 26 Oct 2026 — Production updates from CI (this PR)

- Why: an update published by hand from Alec's Windows PC (`eas update --channel production`, commit 5bb9ccf) got runtime `d75928f0…`, but the Play build (EAS `2b29e8d6`, versionCode 5) has `fa92e2c3…`, so it never reached the Play build. Fingerprints computed on Windows differ from Linux ones.
- New `.github/workflows/update-production.yml` ("Update production"): "Run workflow" on main publishes an EAS Update to the production channel from Linux, with the production profile's env, the same way release.yml publishes preview. It never runs on a merge. The message defaults to the commit's first line.
- Tests proved (`scripts/tests/release-workflows.test.ts`): the workflow has only a manual trigger (fails if a push trigger is added), stops off main, publishes to production with the production env from ubuntu, and uses release.yml's eas-cli pin; release.yml's automatic update still goes to preview only.
- `check` green (1158 tests, 98.76% lines).

### 27 Oct 2026 — Mini keyboard bottom row collapsed on older Pixels (this PR)

- **Bug** (tester via Alec, older non-flagship Pixel; tracker AF-009): the Mini's bottom keyboard row (Z–M and ⌫) drew as thin bars, so those letters and Delete couldn't be pressed.
- **Cause**: every key was `flex: 1` with `maxWidth: 40` (⌫ `flex: 1.5`, `maxWidth: 64`). Reproduced in Yoga 3.2.1 (scratch, not a repo dependency): when the keyboard slot is 367–372 pt, just under the bottom row's natural 372 pt, Yoga collapses every key in that row to its 2 pt border. The slot is the window less 24 pt, so phones about 391–396 pt wide (Pixel 4a/5 class, 393 pt) hit it; the top two rows never do.
- **Fix**: `keyWidths(width)` sets every letter key to one explicit width (the widest that fits ten keys, up to 40) and ⌫ to 1.5 keys (up to 64), from the keyboard's measured width (`onLayout`), estimated from the window on the first frame. No flex sizing left in the keyboard. Keys are now the same width on every row.
- **Tests proved** (`keyboard.test.tsx`): from 250 to 560 pt every row fits and no key is under 21 pt; at a 368.7 pt slot keys are 33 and ⌫ 50; after measuring, all 26 letters and ⌫ take those widths and still type. Checked separately in Yoga: fixed widths give no collapsed key and no overflowing row anywhere from 250 to 560 pt. `check` green (1163 tests).
- **Ship**: JS only; published to production with the Update production workflow after merge.

### 27 Oct 2026 — production updates weren't reaching the Play build (this PR)

- **Found while shipping #68**: main's Android fingerprint was `d75928f0…`; the Play build (0.2.0, versionCode 5, EAS `2b29e8d6`) is `fa92e2c3…`, the fingerprint of the DN icon commit 66127a6. Linux and Windows give the same `d75928f0…`, so the 26 Oct note blaming Windows fingerprints was wrong.
- **Cause**: 36c015f ("keep the four Play screenshots") added two ignore rules to the root `.gitignore`, which @expo/fingerprint hashes (`bareGitIgnore`). From then on every production update (the 26 Oct 19:25 run, and #68's this morning) went to a runtime no store build has.
- **Fix**: root `.gitignore` restored to its 66127a6 content; the two rules moved to `store/.gitignore` (checked: still ignored). Android fingerprint back to `fa92e2c3…`.
- **Guard**: `store/runtime.json` records the Play build's runtime; `scripts/tests/runtime.test.ts` fingerprints the checkout (≈1.5 s) and fails on any mismatch, so a native change can't silently cut Play phones off from updates. Proved: passes with the fix, fails with the old `.gitignore`. After a new store build, update `store/runtime.json`.
- `check` green (1164 tests).
- **Ship**: Update production run after merge, which also carries #66 (Borders points) and #68 (Mini keyboard) to Play phones.

### 27 Oct 2026 — Doku: the bank is the keyboard (this PR)

- **Feedback** (testers via Alec, tracker AF-014): tapping an empty (yellow) square brought the phone's keyboard up, which covered the letter bank, so players lost sight of which letters were left and had to close the keyboard to check.
- **Change** (screen only; the replay-proved model is untouched): the hidden TextInput is gone, so the phone's keyboard never opens. Where the model says the page would have the keyboard up (`state.kbd`, after a tap on an empty square), a bank tile sends the model a `key` move with its letter: it goes into the yellow square and the next tap fills the next empty square of the word, as typing did. Otherwise a tile tap is the page's `tile` move (pick up, then tap a square). Moves are the model's own, so play still replays identically.
- **Tests proved** (`DokuScreen.test.tsx`, replacing the phone-keyboard test): no text input exists after a square tap; square then tiles fill and run on with nothing left in the hand; tapping a placed letter sends it back; tile-then-square still works. The first two fail on the old screen. `check` green (1166 tests).
- **Not done**: a hardware keyboard no longer types into Doku (it went through the hidden input). The website on phones still raises the keyboard; same fix there is a site change if wanted.
- **Ship**: JS only; production update after merge.

### 29 Oct 2026 — unattended run: Release A (coordinator)

- **Scope** agreed with Alec on 28 Oct (plan › "Unattended run"): H1–H4 and the tracker's agreed proposals, as two releases. Three lane agents in worktrees opened eight app PRs; the coordinator merged them one at a time, each re-checked on top of the previous merge: #73, #72, #76, #77, #71, #74, #75, #78. Entries for each follow.
- **Website blocked:** this run could read `dailynoodle` but not push to it (the repo wasn't in the session's sources, and there was no tool to attach it). So everything website-first waits: S1 sync and A9 (R3, R4), S2 and A10 (Link timer R10, AF-028, Link's part of AF-029), S3 and A5 (finish sheet AF-019, AF-015, AF-022), S4 (AF-016 Borders map, AF-026 Path wording), AF-027 Tangle flash, AF-031 Mini typing, and the site's copy of AF-001, AF-004, AF-017 and AF-025. No live database change was made.
- **CI notes:**
  - #76 went red after #72 was merged into it: its new double-tap test looked the Try again button up again after the first press, and under coverage the screen had already switched to its loading view. The fix (beabde4) presses the same button twice in one act. It still proves one request.
  - #75's first `check` failed with an unreadable log; it passed twice locally in CI mode and on the one re-run.
  - The first Release run after #77 failed at its new gate: it checked out #76's merge commit, which has no `scripts/ci-gate.js` yet. It is a one-off at the switch to `workflow_run`. The next run (for #77's own commit) passed.
- **Fingerprint:** main `9db5eed` still matches `store/runtime.json` (runtime test green).
- **Release A publish:** this session's safety check refused the Update production dispatch, so it needs Alec's go-ahead or his own Run workflow. Status and the published commit are recorded in the next entry.
- **Needs Alec:**
  - G2: account deletion is a request emailed to contact@dailynoodle.co.uk, and nothing deletes the auth user automatically. Will he delete it by hand, and is that mailbox watched?
  - If the saves can never be read, the app offers only Try again (deliberately no "continue without saves"). OK?
  - Update production now waits up to 15 min for the commit's CI and refuses a red one. OK?
  - "Replace your round?" (AF-020) asks before replacing a kept round, rather than keeping both. OK?
  - Attach `dailynoodle` with push access for the next run.

### 29 Oct 2026 — H1 Safe saves (R1, R2) ([#73](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/73))

- **Why:** code review findings.
  - R1: a failed disk write was only logged and `flush()` still resolved, so a result could show as saved and be lost when the app closed.
  - R2: a failed read at launch was treated as an empty store, so the next save overwrote old history.
- **Change, R1:** failed writes stay queued (latest value per key). They retry after 2/5/15/30 s, on every later write, and when the app is put away. A quiet "Couldn't save, retrying" line shows while a critical key is unsaved, and `flush()` rejects. Results, streaks, rounds in progress and league identity are critical; caches are dropped on failure. Keys unchanged.
- **Change, R2:**
  - Hydration is all-or-nothing, and a throw or a partial read commits nothing.
  - No disk write happens before a successful read, and the disk wins over any earlier in-memory write.
  - A "Couldn't load your saves" screen with Try again replaces running on empty.
- **Tests proved:**
  - Fault injection: failed result and streak writes show the notice; when storage comes back the retry succeeds; a relaunch the next day keeps the original result and date.
  - Failed and partial launch reads followed by finishes: old results, `digi.aid`, the league board and streaks all survive.
  - The load-failure screen retries into the app.
  - `check` green (1177 tests, 98.7% lines); runtime fingerprint unchanged.
- **Left:** none of this has been seen on a real phone yet (the H5 device pass). If the saves can never be read, the player has only Try again and a relaunch; there is no "continue without saves", on purpose.
- **Needs Alec:** nothing (JS only; ships with the next update).

### 29 Oct 2026: Button rule and Daily Noodle header ([#72](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/72); tracker AF-019 rule, AF-002)

- **What:** the shared Button has filled, tonal and text variants. Every one is at least 48 × 48 with a pressed look. Destructive buttons are red and never filled. There is a loading spinner, automatic for promise-returning presses such as Share. The text field is 48 tall. Leagues and Account usages move to variants; Leave and Close league are red tonal. The masthead swaps DP/NoodlePuzzles for a code-drawn green DN mark and "Daily Noodle".
- **Why:** the AF-019 app-wide button rule; AF-002, three names for one app.
- **Tests proved:** variant styles and sizes, pressed, disabled, loading and accessibility (`Button.test.tsx`); the masthead (`Screen.test.tsx`); Share spins until the sheet opens, and Leave league is not filled (`LeaguesScreen.test.tsx`). `check` green (1180 tests, 98.69% lines); runtime fingerprint unchanged.
- **Left:** the finish sheet's buttons come with the AF-019 sheet redesign. Puzzle controls are unchanged. League invite text still says "on Noodle Puzzles", as the website's board.html does; change both together (site first).
- **Ship:** JS only, over the air.

### 29 Oct 2026 — H3 Recovery and privacy (R5, R7, R8, R9) ([#76](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/76))

- **R5:** `flush()` rechecks opt-out, and setting `digi.optout` drops the queue. Proved: no queued event is sent after opt-out, on the timer or on backgrounding.
- **R7:** with a connection error and no kept copy, the puzzle shows native "No connection" and Try again (a native refetch). The web player is only for pages without data and for refused data. Proved: offline → fail → reconnect → Try again plays natively and keeps the data.
- **R8:** the board id is in the board, records, mine and moment query keys; the moment is a minute fresh; old-id queries are dropped when the id changes. No storage key changed. Proved: after adopting another player in the same league and reopening a finished puzzle, the right board and records show and there's no stale trophy.
- **R9:** `parseFeedLite` checks the feed at download and on reading the cache. Non-lists are refused and the last good copy is kept; bad, mismatched and duplicate cards are dropped. Proved: Today and the Archive still render with the bad cards left out.
- Checks: `check` steps green (1185 tests, 98.68% lines); runtime fingerprint unchanged.
- **Left:** R6 (reloading by itself when the connection returns) needs a connectivity dependency: Release B, ADR first.
- **Needs Alec:** nothing (JS only).

### 29 Oct 2026 — Release safety (G1, G3) ([#77](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/77))

- **G1:**
  - release.yml now runs on `workflow_run` when CI completes, only for a push to main that CI passed, and checks out that exact commit. Before, it published preview on every push.
  - `scripts/ci-gate.js` runs before every `eas update` in release.yml and update-production.yml. It fails unless every CI run for that sha is green.
  - Release skips without going red if main has moved on.
  - Production is still Run workflow only, and waits up to 15 minutes for CI that's still running.
  - Both workflows have `actions: read`.
- **G3:** sign-in auto-refresh starts while the app is active and stops in the background (Supabase's React Native guide).
- **Tests proved:**
  - The gate refuses red, cancelled, running and missing CI; it publishes only when all green; the wait is bounded; API errors fail.
  - The workflow tests prove the gate exists, precedes `eas update` in both workflows and can't be bypassed, and that release.yml triggers on CI completion, not push.
  - Refresh pauses in the background.
  - `check` steps green (1187 tests); runtime fingerprint unchanged.
- **Left:** the first real run of the new release trigger happens on the first merge after this one. Check its "Only a green commit…" step publishes. `workflow_run` workflows run from the default branch's copy, so it takes effect once this is on main.
- **Needs Alec:** nothing to set up (the workflow token is enough). Update production may now say "CI for … is still in_progress" and wait, or refuse a red commit; re-run once CI is green.

### 29 Oct 2026 — A8 (b): rounds survive the app being closed (AF-029, Tangle/Borders/Reckon)

- Why: AF-029 asked whether Tangle, Borders and Reckon resume after the app is fully closed, not just backgrounded.
- Found: all three already do, from the site's own saves (`digi-tangle-v1` days, `digi-borders-v1`/`digi-reckon-v1` `cur`): reopening shows the start screen with Resume and the time unchanged. Gap: Tangle saved only on background and every 5 s, so closing from iOS's app switcher (inactive, no background) gave back up to 5 s.
- Change: `useTangleGame` also calls the engine's `leave()` (its pagehide save) when the app goes inactive. No model change; no new keys.
- Tests proved (`coldStart.test.tsx`, a new store hydrated from the fake phone storage, no unmount): each type reopens paused behind Resume with the same answers, score and time; the inactive case failed before the fix. `check` green (1170 tests, 98.79% lines); runtime test green.
- Left: Link (waits on the website keeping Link's round). Unchanged site behaviour noted, not touched: a Borders hint taken on the current question is not remembered across a reload (the site's `start()` resets `cur.hint`), same as on the website.
- Needs Alec: nothing. JS only; ships over the air.

### 29 Oct 2026 — A8 (a): Today and Archive (AF-020, AF-023, AF-030)

- Why: testers couldn't see a round waiting, could lose one by starting another of the type, were told puzzles would appear offline by themselves, and the Archive repeated today's set.
- AF-020: cards say "Continue" (was "In progress") with the round's time (grid types' clock from `noodle-app-progress-*`, Tangle's time left); grid types' part-way cards now get the dot mark too. Starting another puzzle of a one-round type (Mini, Doku, Sweep, Path, Borders, Reckon) while another holds the round asks first (Cancel / Go to the kept one / Start this one). Chose warn over keep-both: Borders/Reckon's single `cur` is the site's format, and keep-both for grid types needs new per-puzzle keys and a migration.
- AF-023: offline notes say "Puzzles you've opened before still work; pull down or tap Try again when you're back online." and no longer promise auto-reload; Today shows it over a kept list too; offline, opened puzzles' cards say "Downloaded".
- AF-030: Archive lists puzzles before today only, with "Today's puzzles are on the Today tab ›" at the top.
- Tests proved: see the PR (rounds, question, Today and Archive screens, PuzzleRow); "In progress" expectations changed to "Continue" on purpose. `check` green (1201 tests, 98.68% lines); runtime test green.
- Left: auto-reload when back online (R6, later store build). Link has no Continue until it keeps a round (website first). Whether the website's archive page should also start from yesterday (AF-030 says "if the website's archive page also starts with today, change it to match"): site change, not made this run.
- Needs Alec: nothing. JS only; ships over the air.

### 29 Oct 2026: Account screen redesign ([#75](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/75); tracker AF-018 with AF-001, AF-003, AF-004, AF-012, plan G2)

- **What:** Account rebuilt top to bottom:
  - the sign-in card: "Sign in or create an account", then "Check your email" with a 60 s Send again;
  - the signed-in status: tick, "Signed in", the email, and one line "Synced … · Sync now" that also carries errors and the league choice; Sign out is tonal;
  - SETTINGS: Vibration and Animations, app-wide, under the new key `noodle-app-settings`;
  - LEAGUES: "Join a league" / "Join with a code";
  - PRIVACY & DATA: "how to change it"; "Delete my saved data" as a plain row with a confirm screen and a red tonal Delete; "Request account deletion" emailing contact@dailynoodle.co.uk;
  - the version footer.
    Vibration gates every haptic, since all go through `buzz()`, and Reckon's saved `hap` is no longer read. `useReduceMotion()` honours the app's Reduced, and Link and Tangle now use it.
- **Tests proved:** signed-out and signed-in states, the 60 s resend countdown, the delete confirm flow (cancel, success, failure), the deletion-request mailto, the switches persisting, Vibration off silencing every buzz (Reckon included), and Reduced stopping motion even with the phone allowing it. Runtime fingerprint unchanged.
- **Left / needs Alec:**
  - G2: the request route is an email to contact@dailynoodle.co.uk. Nothing deletes the sign-in account automatically, so Alec deletes the Supabase auth user by hand on each request, and someone should check the mailbox is watched.
  - The website's account card and privacy page wording need a site PR to match.
  - The Sound switch comes with AF-013 (Release B).
- **Ship:** JS only, over the air.

### 29 Oct 2026: Leagues: compact controls, margins, Tangle without time ([#78](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/78); tracker AF-017, AF-007, AF-025, part of G5)

- **What:**
  - the league picker moves into the heading ("Family ▾"), with Start a new league and Join with a code in its menu, replacing the LEADERBOARD label and league chips;
  - the puzzle chips are 32 pt in one edge-to-edge row (44 pt tap targets via hitSlop);
  - the day is one slim line, "‹ Today · Wed 28 Oct ›", without "All eight puzzles";
  - board and record rows have 10 pt right padding;
  - Tangle's result has no time line (rows "29 pts", share "🥇 Martin 29 pts");
  - the controls are split into `BoardControls.tsx`.
- **Tests proved:** picker states and switching, chip sizes and tap targets, the day line wording, edge-to-edge chips, right padding on board and record rows, and Tangle's rows and share without the time (Borders and Reckon unchanged). Runtime fingerprint unchanged.
- **Left:** the optional sticky bar (skipped, not trivial); the Leagues scroll bar at the edge (AF-007 point 3); the website's dn-board.js and board.html need the same AF-025 and AF-017 change through a site PR; the rest of the G5 Board split.
- **Ship:** JS only, over the air.

### 29 Oct 2026 — Release A published (over the air)

- Update production run [40950996721](https://github.com/alecldarlow-cell/Daily-noodle-app/actions/runs/40950996721) published main `12ffc1e` (#71–#79) to the production channel at 20:43 UTC, after Alec's go-ahead in the session. Its new CI gate passed. Before the run, the fingerprint still matched the Play build (`fa92e2c3…`; runtime test green).
- This was the only production update of the run. None follows Release B.

### 29 Oct 2026 — Release B (0.3.0 store build): reconnect, sound, share links ([#80](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/80))

- **R6, reconnect:** NetInfo 12.0.1 (ADR-008) drives React Query's onlineManager. Failed queries reload when the connection returns, so Today, Archive and puzzle data load without a tap. The offline wording no longer asks for one.
- **AF-013/AF-012, sound:** expo-audio 58.0.10 (ADR-009, playback only, RECORD_AUDIO blocked). The website's tones for Tangle, Borders and Reckon are rendered to `assets/sounds` by `scripts/make-sounds.js`. A Sound switch sits on Account (on by default, `noodle-app-settings.sound`), and the phone's silent mode is followed. The finish fanfares are the three games' jingles. Models are untouched (saves identical with Sound on and off).
- **AF-010, share links:** App Links for `/<type>`, `/<type>/` and `/<type>/index.html` open today's puzzle of that type. `board.html?join=` is routed in JS, but board.html is not an App Link (the website's sign-in emails land there).
- **Version 0.3.0.** `store/runtime.json` android is `ea55e856…`, "0.3.0, pending Play upload".
- **Tests proved:** see the PR. `check` green, and runtime test green on the new fingerprint.
- **Left:**
  - The celebration jingle for Mini, Doku, Sweep, Path and Link. The website goes first (site PR), then the app adds the notes to `make-sounds.js`.
  - board.html as an App Link (needs the website's sign-in redirect moved off board.html first).
  - Play's app-signing SHA-256 in assetlinks.json (AF-024). It now lists two fingerprints, and it's unconfirmed whether either is Play's.
  - iOS universal links.
  - After the Play upload, confirm the build's runtime is `ea55e856…` (else correct `store/runtime.json`) and drop "pending".
- **Needs Alec:**
  - Build and upload 0.3.0 after Release A's update is published.
  - On the phone, check `adb shell pm get-app-links uk.co.dailynoodle.app` (verified), a WhatsApp tap on `dailynoodle.co.uk/mini`, and sound on and off, on silent, and with music playing.

- **Merged** 29 Oct after Release A was out. CI: `replay path` failed once with an unreadable log, then passed on the one re-run; it had been green on the same code before main's docs-only merge.
- **Store build:** queued through Release ("Run workflow", production, android) as run [40953273792](https://github.com/alecldarlow-cell/Daily-noodle-app/actions/runs/40953273792) on `78c26e1`. The EAS build id is only in that run's log, which this workspace can't read; find it on expo.dev. Alec uploads it to Play's closed track. After that, check the runtime is `ea55e856…` and drop "pending" from `store/runtime.json`.

### 30 Oct 2026 — Second unattended run: website S1–S6, app A5, A8, A9, A10, and one production update

The previous run couldn't push to the website. This one could, so the website went first, then the app.

- **Website (dailynoodle), all live 29 Oct, each Build feed run and live check green:**
  - [#40](https://github.com/alecldarlow-cell/dailynoodle/pull/40) S3: new finish screen (AF-019, AF-015, AF-022), rank line, and the celebration jingle with a Sound switch (AF-013, key `dn-sound`).
  - [#41](https://github.com/alecldarlow-cell/dailynoodle/pull/41) S5: Tangle without times (AF-025), slim day line (AF-017), "Daily Noodle" invites; join.html passes `p`/`d` on.
  - [#44](https://github.com/alecldarlow-cell/dailynoodle/pull/44) S2: Link pauses while away and keeps its round in `digi-link-v1.cur` (R10, AF-029), waiting clock (AF-028); Tangle green flash (AF-027); Mini skips filled squares (AF-031).
  - [#42](https://github.com/alecldarlow-cell/dailynoodle/pull/42) S1: sync revisions with compare-and-swap and pull-merge-retry (H2), plus the account wording (AF-001, AF-004).
  - [#45](https://github.com/alecldarlow-cell/dailynoodle/pull/45) S4: Borders big map (AF-016), Path "path" wording (AF-026; 657 forthcoming blurbs from 1 Nov).
  - [#46](https://github.com/alecldarlow-cell/dailynoodle/pull/46) S6: Path start card and guide wording; SITE.md assetlinks labels corrected.
- **Live database:** migration `sync_revision` (additive): `rev` column, `sync.rev_seq`, `sync_pull_rev`/`sync_push_rev` (signed-in only), old `sync_push` bumps the revision. Dry-run in a rolled-back transaction first; all 42 rows for 3 accounts kept. Security advisor: the same expected notices as 28 Oct.
- **App:**
  - [#82](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/82): leaderboard shares link join.html (AF-010).
  - [#83](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/83) A5: finish screen matching S3, plus the jingle.
  - [#85](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/85) A8: Borders map, Path wording, Tangle tile flash, Mini skip-filled.
  - [#86](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/86) A10: Link pause and resume. The round is kept in `digi-link-v1.cur`, the website's format, instead of a new key, so the replay can compare the whole save.
  - [#84](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/84) A9: sync revisions (R3), and "Keep this one" remembered under the new app-only key `noodle-app-league-keep` (R4).
  - A5, A8, A10 and A9 were stacked and merged together: once S2 and S4 were live, only the full stack could match the website. The stack top's CI was green on `check` and all eight replays; the tree merged to main ([07d8302](https://github.com/alecldarlow-cell/Daily-noodle-app/commit/07d8302d4033f80147c1966663b21a299d7b5290)) is identical to the one tested, and main's CI was green.
- **Replay expectations changed only for:** the Link timer pause and waiting clock, the Mini skip-filled rule, and the finish-screen readers (screen-reading only, no model change).
- **Release:** production update run [41005008387](https://github.com/alecldarlow-cell/Daily-noodle-app/actions/runs/41005008387) published main `07d8302` at 04:51 London, 30 Oct; its CI gate passed. It targets the 0.3.0 runtime (`ea55e856…`), so testers get it once the 0.3.0 Play build is installed. No store build.
- **Left / needs Alec:**
  - G2: automated deletion was parked by Alec (email route stays). Site PR #43 is closed unmerged; its branch and SQL are kept.
  - AF-024: Play's app signing key (`0A:E9:05:AD…`) is already in assetlinks.json; still to check `pm get-app-links` on a Play-installed phone.
  - Yarn still flashes rarer words yellow: change it?
  - Not seen on a real phone: the Borders big map, the jingle on silent, the Link pause through the lock screen, and two-device sync.

### 30 Oct 2026 — Boards in thumb reach on tall phones (this PR; tracker AF-032)

- **Feedback** (players via Alec): on tall phones boards sat under the top bar with a large empty gap above the controls (Sweep 106: about half a screen), so every tap was a stretch.
- **Change** (Alec's call 30 Oct, replacing his 26 Oct top alignment): the shared `BOARD_SLOT` now uses `justifyContent: 'flex-end'`, so Mini, Doku, Sweep and Path hold the board at the bottom of the spare height, just above their controls. Link's rows and Tangle's board do the same. On short phones there is no spare height, so nothing moves. Board sizing is unchanged.
- **Tests proved:** `layout.test.tsx` expects the bottom alignment for all four board players, and Link and Tangle (it failed on the old alignment). `check` green (1421 tests); runtime test green.
- **Ship:** JS only; production update after merge (reaches testers on 0.3.0).

### 30 Oct 2026 — Fixes from an outside code review ([#90](https://github.com/alecldarlow-cell/Daily-noodle-app/pull/90); website [#48](https://github.com/alecldarlow-cell/dailynoodle/pull/48))

Alec ran an outside review of the app and asked for its findings to be checked and fixed. All six held up when checked against the code (the trophy one only in the finish sheet; the Leagues screens rebuild their share text each time).

- **High — Link sync could undo newer progress.** The website's import has kept the round with the newer `at` since 29 Oct (AF-029), but `@noodle/core` `mergeMoved` was never given that line, so a phone holding an older Link round kept it on sync and pushed it over the account's newer one. Ported from dn-track.js; vendored copies refreshed (`dn-move.js`, `dn-board.js` were stale).
- **High — a finished Tangle round came back as "Resume".** A round paused mid-play reaches the account as `playing`; once finished, the account kept its own copy of that day (first-result rule) and the import kept the phone's. A new device then offered Resume with the old time left. Website first ([#48](https://github.com/alecldarlow-cell/dailynoodle/pull/48), merged, live with Build feed): a finished day beats the same day still in play, in `importData` and `forAccount`. The app takes the same rule in `mergeMoved` and `syncEngine` `forAccount`. Accounts already stuck at `playing` are repaired the next time the phone that finished syncs.
- **Medium — "Play more" skipped the replacement warning.** The finish sheet now asks "Replace your … in progress?" as the Today and Archive cards do (`openPuzzle` takes an opener, so the player replaces its screen).
- **Medium — late league answers for a previous player.** League refreshes, joins, leaves, owner actions, pins and the results backfill capture the player id when they start and write only if the install is still that player (`stillPlayer`).
- **Medium — reconnect missed Wi-Fi with the line down.** `isOnline` also reads `isInternetReachable` (false = offline; null = unknown = online), so reloads fire when the Internet returns on the same Wi-Fi.
- **Low — 🏆 stuck on the share line.** It now comes off when the record no longer stands (asked again after a minute) or the player leaves the league.
- **Tests proved:** each new test failed on the old code and passes now (sync engine 4, core differential vs dn-track.js 1, network 2, Today reconnect 1, leagues identity 2, backfill 1, Play more 3 + opener 1, trophy 2). Website: `tangle-day-sync.test.js` (3), unit suite 105/105, `regression` green.
- **Ship:** JS only; production update after merge (reaches testers on 0.3.0).
- **Needs Alec:** the site branch `fix/tangle-finished-day-sync` couldn't be deleted from here (proxy refused); delete it on GitHub when convenient. Not seen on a real phone: Play more's warning, and the Wi-Fi reconnect.

- **Release:** production update run [41167212864](https://github.com/alecldarlow-cell/Daily-noodle-app/actions/runs/41167212864) published main `5c31b39` (#90) at 04:07 London, 31 Oct, on Alec's go-ahead; its CI gate passed. JS only, 0.3.0 runtime. Still to see on a phone: Play more's warning and the Wi-Fi reconnect.
