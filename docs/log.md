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
