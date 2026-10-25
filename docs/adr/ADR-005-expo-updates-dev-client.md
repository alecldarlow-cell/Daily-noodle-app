# ADR-005: expo-updates and expo-dev-client

- Status: accepted, 25 Oct 2026 (WP6)
- Adds to: the Build brief's approved dependency list

## Context

WP6 (Build brief) calls for EAS Build development/preview/production profiles and EAS
Update for JavaScript-only changes. Those need two of Expo's own modules that the brief's
list didn't name: `expo-updates` (receives updates; its `channel`/`updateId` also name the
running build on the Account screen) and `expo-dev-client` (development builds). Both are
first-party, pinned at SDK 58's vetted versions from `expo/bundledNativeModules.json`.

## Decision

Add both. No other modules. Runtime versions use the `fingerprint` policy, so an update is
only offered to builds whose native code matches it.

## Consequences

Native code changed: the first EAS builds include them. Builds without an EAS project id
(`eas init`, docs/install.md) run with updates disabled, as before.
