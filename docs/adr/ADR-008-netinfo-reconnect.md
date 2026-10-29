# ADR-008: @react-native-community/netinfo, so puzzles load when the connection returns

- Status: accepted, 29 Oct 2026 (Release B, hardening R6)
- Adds: `@react-native-community/netinfo` 12.0.1 (native; ships in the 0.3.0 store build)

## Context

The code review of 0.2.0 (finding R6) found that coming back online doesn't reload
anything by itself: only returning to the app is wired to React Query (`focusManager`
on `AppState`), so a player who opens Today on the Underground sits on "You're offline"
until they pull down or tap Try again. Release A (#74) made the wording honest about
that ("…pull down or tap Try again when you're back online"); the fix the review asks
for is a connectivity listener, which is a new native dependency, so it waited for this
store build.

`@react-native-community/netinfo` is the library TanStack Query's React Native guide uses
for `onlineManager`, and Expo SDK 58 vets it: `node_modules/expo/bundledNativeModules.json`
lists `12.0.1`. `npx expo install` can't reach Expo's version API from Claude's cloud
workspace, so that version is pinned exactly by hand. It needs no config plugin and no
permission beyond the `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` its own manifest
declares (both normal, install-time permissions; the Play listing's permission list
gains them).

The alternative in the review, a bounded retry loop while an error shows, would keep
asking the site every few seconds on a phone with no signal and still miss a quick
reconnect between attempts.

## Decision

- `shared/query` sets React Query's `onlineManager` from NetInfo's `isConnected`
  (`followNetwork`, wired in `QueryProvider`). Only `isConnected === false` counts as
  offline; an unknown (`null`) state counts as online.
- Every query and mutation uses `networkMode: 'always'`, so loads still run and fail as
  before whatever the reported status, and the screens keep saying "You're offline" from
  the failed fetch itself (`isConnectionError`). The network status is used only to
  reload: when it goes from offline to online, every query whose last load failed loads
  again at once (`refetchOnReconnect: 'always'` for those, the default stale-only rule
  for the rest).
- The offline wording on Today and Archive no longer asks for a tap: "Puzzles you've
  opened before still work; the rest load when you're back online." Try again stays.
- Jest maps the package to its own mock (`jest/netinfo-mock.js`, its docs' setup); the
  real module needs its native side.

## Consequences

- Native code changed: the fingerprint moves, so this ships only in a new store build
  (0.3.0). An over-the-air update can't bring it to 0.2.0 phones.
- A reload already waiting out a retry delay isn't hurried by the reconnect (React Query
  joins the pending attempt); Today's retries finish within about six seconds, after
  which the reconnect rule applies.
