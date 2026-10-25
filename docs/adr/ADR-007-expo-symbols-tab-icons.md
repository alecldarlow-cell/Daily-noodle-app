# ADR-007: expo-symbols, for the tab bar's Android icons

- Status: accepted, 25 Oct 2026 (Alec approved it in chat; launch-crash fix)
- Adds: `expo-symbols` 58.0.4 (not on the Build brief's approved list; added with Alec's go-ahead)

## Context

The first preview build (EAS `0410537b`) crashed on launch on a Pixel 10 Pro. The phone's
crash log:

> NativeTabs.Trigger.Icon `md` icons on Android require 'expo-symbols'.

`src/app/(tabs)/_layout.tsx` gives each tab an SF Symbol (`sf`, iOS) and a Material
Symbol (`md`, Android). expo-router 58's native tabs draw `md` icons with
`expo-symbols`, an optional peer it doesn't install. Without it, the tab bar throws on its
first render, and expo-updates' error recovery then crashes the process. Jest doesn't
catch this because the tests don't render the real native tab bar.

The other way out is to drop `md` and give each tab an image (`src`) or a drawable
resource: four PNGs kept in step with the design by hand, which is a new asset pipeline
for four icons.

## Decision

- Add `expo-symbols` 58.0.4 (SDK 58's version, from `npx expo install`), pinned exactly.
  The tab layout is unchanged.
- On Android it brings the Material Symbols font
  (`@expo-google-fonts/material-symbols`) and no native module of its own. The build
  fingerprint didn't change (`e5567ad6…` before and after).

## Consequences

- No new native code, so an EAS Update could carry it to builds that have the same
  fingerprint. The build that crashed predates expo-haptics, though, so its fingerprint
  differs and it needs a new build anyway.
- Any new `NativeTabs.Trigger.Icon` with `md` works on Android with nothing more to add.
