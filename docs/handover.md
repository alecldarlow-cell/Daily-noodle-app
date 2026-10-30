# Handover: Daily Noodle app (26 Oct 2026, evening)

For the next Claude session on the app. Read `CLAUDE.md` first; its rules still apply. `docs/log.md` has the history,
including the 26 Oct entries. This file is the short version of where things stand.

## Where things stand

- `main` has the full polish (A–D, #53–#61), saved progress for Mini/Doku/Sweep/Path, Borders in points (no run bonus,
  site first), Tangle in the site's blue, the green **DN** icon (#63), league App Links and one way to join (#58, #60),
  and version **0.2.0** (#62).
- **Native build needed for app.json changes.** App Links, the icon and the splash changed the runtime fingerprint, so
  OTA updates from #58 on reach only builds made after it:
  - Alec's phone runs preview build `8bd9988f` (0.1.0, after #61, with the DP icon).
  - The Play build is 0.3.0 (version code 7), from Release run 40953273792 on `78c26e1`, live on Alpha 30 Oct 2026.
    Runtime `ea55e856…` (`store/runtime.json`). Before it: EAS `2b29e8d6-c3e1-4fa3-8191-246c88ff14ea`, 0.2.0.
- **Builds:** run the Release workflow (`workflow_dispatch`, profile/platform). It only queues on EAS, and the free
  queue can take one to two hours. `npx eas-cli@25.3.0 build:view <id> --json` shows the status (EAS is logged in on
  this PC).

## Google Play (developer 6855067210108057426, app 4972303615566008433)

- **Personal account:** production needs a closed test with 12 or more opted-in testers for 14 days.
- **Closed testing – Alpha:** country United Kingdom. Testers are the Google Group
  `dailynoodle-testers@googlegroups.com` (anyone can join, owner-only posting and members list), whose description holds
  the opt-in link `https://play.google.com/apps/testing/uk.co.dailynoodle.app`.
  - Alec shares one link in WhatsApp: https://groups.google.com/g/dailynoodle-testers
  - The "Family" email list is no longer attached; those two people join the group.
- **Store listing:** the four new phone screenshots (`store/screenshots/`, 1080 × 1920, dark) are saved as a draft.
  - They show a real solve of old Mini 92 (2:59, no checks) and Alec's real times.
  - Full-size originals stay local in `store/screenshots/raw/` (ignored).
- **Sign-in details** (Play's App access): "restricted", one entry saying sign-in is optional, magic-link only, adds
  sync and leagues, and everything works signed out (30 Oct 2026; Play blocked 0.3.0 until it was filled in). Alec
  ticks its full-access box himself.
- **Next steps:** after 14 days with 12 or more opted-in testers, apply for production (12 testers for 3 days on
  30 Oct).
- **App Links on Play installs:** add Play's **app-signing** SHA-256 (Play Console › App integrity) to the site's
  `.well-known/assetlinks.json` (site PR). Without it, Play-installed copies open invites in the browser. The EAS key
  is already there and verified.

## Open items

- Borders wording: cards say "out of ten" and rows "Scored 5/10". A separate session is fixing it, site first.
- Date labels mix "4d ago" and dates. That's the site cards' rule, so it can only change site first.
- An "In progress" mark on Today/Archive for a kept Mini/Doku/Sweep/Path round. The site marks only Tangle, Borders
  and Reckon.
- Borders' map WebView still reloads per question.
- iOS: universal links and a first build, later.

## Working notes

- **PRs:** `gh` isn't installed. Use the GitHub REST API through a helper that reads the git credential and never
  prints it, for example `printf 'protocol=https\nhost=github.com\n\n' | git credential fill`, then curl with that
  token. Alec approved merging green PRs in the polish process. Site PRs follow SITE.md (Claude merges green ones).
- **Phone:** wireless adb; run `pair-phone.ps1` in a terminal tab and Alec types the code. Ask before using the phone.
  - Never play today's puzzles. Old archive puzzles are fine; finishing one counts in "played".
  - Check light/dark and font size with Alec, who changes system settings himself.
- **Before deleting:** a finished subagent can leave jest running and lock `node_modules` (EPERM on `npm ci`). Stop
  only that worktree's node processes.
- `daily-noodle-checklist.md` is excluded locally and fails prettier. Move it aside to run `npm run check` in the
  main checkout.
