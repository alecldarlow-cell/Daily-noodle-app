# ADR-006: expo-haptics, and the finish sheet's entrance on React Native's Animated

- Status: accepted, 25 Oct 2026 (WP12)
- Adds: `expo-haptics` 58.0.7 (on the Build brief's approved list)

## Context

WP12 asks for haptics (a light tap, a success, an error) and a short entrance for the
finish sheet that respects the phone's reduce-motion setting.

`expo-haptics` is on the Build brief's approved list. `npx expo install` can't reach
Expo's version API from Claude's cloud workspace, so the version is SDK 58's own pin
from `node_modules/expo/bundledNativeModules.json` (`~58.0.7`), pinned exactly. The SDK
58 docs advise `performAndroidHapticsAsync` on Android over the `Vibrator`-simulated
`impactAsync` / `notificationAsync`, so `shared/haptics` uses the system effects there
(Keyboard tap, Confirm, Reject). `android.permission.VIBRATE` was already declared.

`react-native-reanimated` 4.7.1 is in the template's dependencies but nothing in the app
uses it, and under jest-expo 58 neither the library nor its own `mock.js` loads
(`react-native-worklets` needs its native module; the mock then fails in
`setCSSEventHandler`). Making it testable would mean new global Jest mocks for one
fade.

## Decision

- Add `expo-haptics` 58.0.7. Screens and hooks call `shared/haptics` (`buzz`,
  `useHapticDiff`); puzzle models never do. Each type reads a move's feel from its
  state before and after (`features/puzzles/<type>/hooks/feel.ts`), so the replay-proved
  models are untouched. One switch, `HAPTICS_ON`, on for now; a type whose own saved
  setting turns haptics off (Reckon's `hap`, when it lands) passes `allowed = false`.
- The finish sheet's entrance uses React Native's built-in `Animated` (native driver),
  with `AccessibilityInfo` for reduce motion (`shared/motion`). No confetti library.

## Consequences

- Native code changed: the next EAS build includes expo-haptics; an EAS Update alone
  won't bring haptics to builds made before it (the fingerprint runtime policy keeps
  such an update off those builds).
- Reanimated stays unused. If a later package needs it, set up its Jest mocks then.
