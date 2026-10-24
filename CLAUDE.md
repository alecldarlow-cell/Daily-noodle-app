# Daily Noodle app — instructions for Claude sessions

Read before working here:

1. The conversion plan doc, all three tabs (Plan, Build brief, Contracts):
   https://claude.ai/artifact/HmMQXKYfM23GanNGuV62zB — read it with the docs tools.
2. `docs/log.md`: take the first work package not marked done. One at a time.
3. A full clone of `alecldarlow-cell/dailynoodle` (the site): its `SITE.md` and the files
   the work package names. The site repo wins over the doc where they differ.

Rules (from the Build brief; follow them exactly):

- Every change goes on a branch and through a pull request; merge when CI (`check`) is
  green. Site-repo changes follow `SITE.md › Site code ships through a pull request`.
  A change touching both repos is two pull requests, site first.
- Never rename a storage key, puzzle id or puzzle path; never edit a test or baseline
  to get a check green; never run tests against the live Supabase database; never
  commit a secret.
- Tests with every change, GIVEN/WHEN/THEN, 80% line coverage; `npm run check` before
  pushing. Verify by running, not by reading.
- Approved dependencies only (Build brief › Rules). Ask Alec and write an ADR first
  for anything else. Pin exact versions.
- Expo changes every SDK: check the versioned docs for SDK 58
  (https://docs.expo.dev/versions/v58.0.0/) before using an Expo or React Native API.
  `npx expo install` cannot reach Expo's version API from Claude's cloud workspace;
  pin the version the SDK 58 template or docs give instead.
- Stop and report rather than force: a differential replay that differs, a contract
  that doesn't match the repo, a red check outside the change, anything needing the
  live database, a store account or money.
- Finish each session by appending to `docs/log.md` (date, WP, PR links, what tests
  proved, what's left, what needs Alec).
