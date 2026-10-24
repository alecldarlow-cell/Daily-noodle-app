# Daily Noodle — the puzzle app

The Daily Noodle's eight daily puzzles as an iPhone and Android app: Today, Archive,
streaks, leagues and optional sign-in. Built with Expo (React Native, TypeScript).
The website, [dailynoodle.co.uk](https://dailynoodle.co.uk), stays as it is; this app
reads what its build publishes and talks to the same Supabase backend.

- Plan, build brief and data contracts: [the conversion plan](https://claude.ai/artifact/HmMQXKYfM23GanNGuV62zB)
- What has been built, session by session: [`docs/log.md`](docs/log.md)
- Decisions that depart from the standard: [`docs/adr/`](docs/adr)
- Site and content repo: [`alecldarlow-cell/dailynoodle`](https://github.com/alecldarlow-cell/dailynoodle)
  (start with its `SITE.md`)

## Setup

Node 22 or later.

```sh
npm ci
```

## Run

```sh
npm start          # Expo dev server; press i (iOS simulator) or a (Android emulator)
```

Native modules are added over the build (WebView, storage), so from WP4 the app needs
a development build rather than Expo Go: `npx eas-cli@latest build --profile development`.

## Test

```sh
npm run check      # everything CI runs: format, lint, boundary self-test, typecheck, tests + coverage
npm test           # unit and component tests only (Jest, jest-expo preset)
npm run test:watch
```

Tests follow `describe('GIVEN …') / describe('WHEN …') / it('THEN …')` and CI enforces
80% line coverage.

## Layout

```
src/
  app/                 routes only (Expo Router); each file re-exports a feature screen
  features/<feature>/  components/ hooks/ api/ schemas/ types/ tests/
  shared/              theme (house tokens), ui, and later storage and the WebView bridge
packages/core/         @noodle/core: London days, saves, streaks, share lines
scripts/               tooling: boundary self-test, vendor-site (copies the site's rules for differential tests)
docs/                  build log and ADRs
```

A feature imports only itself, `src/shared` and `@noodle/core`; routes import a feature
only through its `index.ts`; `shared` never imports a feature. ESLint enforces this and
`npm run lint:selftest` proves it still does.

## Architecture

```
dailynoodle (site repo)  ──build──▶  dailynoodle.co.uk
                                     puzzles-today.json, feed-lite.json, reports/*.json
                                              │
                                              ▼
                       Daily Noodle app (this repo, Expo)
                       Today · Archive · play (native or WebView) · Leagues · Account
                                              │  RPC
                                              ▼
                       Supabase `digi`: board_* (leagues), log_events, Auth, sync
```

Contracts the app must never break (storage keys, puzzle ids, London days, first
result kept) are listed in the plan's Contracts tab.
