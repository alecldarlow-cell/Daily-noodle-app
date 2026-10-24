# Build log

The plan, build brief and contracts live in the Claude doc
**The Daily Noodle app — conversion plan** (tabs: Plan, Build brief, Contracts):
https://claude.ai/artifact/HmMQXKYfM23GanNGuV62zB

Each session takes the first work package not marked done, and appends an entry
below when it finishes.

## Status

| WP  | Deliverable                                                   | Status      |
| --- | ------------------------------------------------------------- | ----------- |
| 0   | App repo scaffolded, CI green                                 | in review   |
| 1   | `@noodle/core` with differential test against `dn-core.js`    | not started |
| 2   | Site publishes `feed-lite.json` and per-puzzle JSON (site PR) | not started |
| 3   | Today and Archive screens, offline-capable                    | not started |
| 4   | WebView bridge: play, finish, share, saves                    | not started |
| 5   | Leagues: board, join, submit, first-run handoff               | not started |
| 6   | EAS builds, TestFlight and Play internal track                | not started |
| 7   | Optional sign-in and sync, web and app                        | not started |
| 8   | Port recipe, shared start card and finish sheet, Mini native  | not started |
| 9   | Sweep and Path native                                         | not started |
| 10  | Link, Tangle, Reckon, Borders native                          | not started |
| 11  | Doku native                                                   | not started |
| 12  | Polish, notifications decision, release decision              | not started |

## Entries

### 24 Oct 2026 — WP0

- Repo is `alecldarlow-cell/Daily-noodle-app` (the plan said `dailynoodle-app`; read the doc's name as this one). It is
  **public**; the plan assumed private. Nothing secret is or will be committed
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
