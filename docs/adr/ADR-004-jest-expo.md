# ADR-004: jest-expo is the single test runner (not Vitest)

- Status: accepted, 24 Oct 2026 (WP0)
- Deviates from: Piers' Technical Requirements §1.6 (Frontend: Vitest / Testing Library)

## Context

Piers' doc names Vitest for the Next.js frontend; the mobile section names no runner.
Two facts settled it during WP0:

1. React Native Testing Library 14 (the current release) declares `jest >=29` as a
   peer dependency; it is built on Jest's module system and timers.
2. Vitest cannot load React Native's own source (Flow-typed, Metro-specific
   resolution) without aliasing it to `react-native-web`, which would test a
   different renderer from the one players run.

Expo documents `jest-expo` as its supported unit-testing preset.

## Decision

One runner for everything in this repo, app and `packages/core`: Jest with the
`jest-expo` preset and React Native Testing Library. Everything else in §4 stands:
GIVEN/WHEN/THEN structure, behaviour over implementation, 80% line coverage enforced
in CI, tests written with every change.

## Consequences

- `test/resolve-lazy-globals.js` works around Expo's lazily installed globals
  (`fetch`, `structuredClone`, `URL`…) being read during Jest 30's teardown.
  Re-check it on every Expo SDK upgrade; delete it once Expo fixes the interaction.
- Device-level end-to-end flows use Maestro (WP3 onward), since Playwright has no
  native mobile target.
