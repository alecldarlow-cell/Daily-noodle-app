# ADR-010: expo-store-review, for the store's rating sheet

- Status: accepted, 10 Nov 2026 (Alec's go-ahead in the distribution review; project docs
  `claude/distribution-plan-2026-11-10.md` and `claude/distribution-status-2026-11-10.md`)
- Adds: `expo-store-review` 58.0.2 (native; ships in the next store build)

## Context

Google Play ranks a listing largely on its ratings, and a new production listing starts with
none. Players only rate when asked, and the only allowed way to ask inside an app is the
store's own sheet (Google's In-App Review, Apple's SKStoreReviewController). Alec doesn't want
the app to nag (5 Nov 2026: no reminder notifications), so the question was how rarely.

`expo-store-review` is Expo's wrapper for both stores' sheets. SDK 58's
`bundledNativeModules.json` asks for `~58.0.2`; the newest 58.0.x on npm on 10 Nov 2026 is
58.0.2. `npx expo install` can't reach Expo's version API from Claude's cloud workspace, so it
is pinned exactly by hand. It has no config plugin and asks for no permission.

## Decision

- Add `expo-store-review` 58.0.2.
- `src/shared/review`: `askForReview` asks **at most once per app version**, and only on a
  fresh win of **today's** puzzle that puts that type's day streak at **five or more**
  (`REVIEW_STREAK`), 2.5 s after the finish sheet rises so it never covers the result. Never
  after a loss, an archive puzzle, or a finished puzzle reopened.
- The version that asked is kept under `noodle-app-review` (a new key; disposable, since
  losing it costs one extra ask at most). It is written before the store is called.
- The store decides whether its sheet really shows and tells the app nothing, so there is no
  "did they rate" state and no fallback button.

## Consequences

- A native change: the runtime fingerprint moves, so this merges only with a new store build
  (as the `/tally` App Link on the same branch), then `store/runtime.json` records that build.
- The sheet never shows in preview or development builds (no store install), so it can only be
  seen on a Play install; Play's internal test track shows it without posting a review.
- Jest uses `test/mocks/expo-store-review.js`.
- iOS needs nothing more when an iPhone build exists.
