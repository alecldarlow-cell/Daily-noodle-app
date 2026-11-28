# App Store listing (what goes in App Store Connect)

Everything App Store Connect asks for, ready to paste, drafted on 28 Nov 2026 (#216) from
`docs/play-listing.md`, the code and the privacy page. Nothing here is live yet: the app isn't on
the App Store. Check every answer against what the app does on the day you submit, and against
https://dailynoodle.co.uk/privacy.html; the App Privacy answers must change whenever that page
does. Tracker: #218.

## Before the first submission

- **#188 in-app account deletion** must be in the build. Apple requires deletion to start inside
  the app; an email request is not enough.
- **#215 sign-in code** should be in the build, so the reviewer can sign in with a code typed on
  the review iPhone (the review notes below assume it).
- **Sign in with Apple** is not needed: Apple asks for it only when an app offers a third-party
  or social login. Daily Noodle's sign-in is email only.
- **Export compliance** is already answered by the build (`ios.config.usesNonExemptEncryption:
false` in `app.json`), so App Store Connect won't ask.

## Product page

**Name** (30 max): `Daily Noodle: Daily Puzzles` (the Play title). App Store names must be unique;
if it's taken, `Daily Noodle` or `The Daily Noodle`.

**Subtitle** (30 max): `Mini crossword, sudoku & more`

**Keywords** (100 max, commas, no spaces; words already in the name and subtitle count without
being repeated here):

> word,logic,brain,minesweeper,trivia,geography,quiz,maths,streak,league,mines,groups,teaser,anagram

**Promotional text** (170 max; can change at any time without a new version):

> Nine fresh puzzles every morning. Build streaks and race friends in private leagues. No adverts.

**Description** (4,000 max; changes need a new version): the Play full description in
`docs/play-listing.md`, as it is. It names no other platform, which Apple doesn't allow. Check the
puzzle count against Today before pasting.

**Category:** Games, with Puzzle and Word as the game subcategories. Not the Kids category: the
app isn't built for under-13s (Play's target audience is 13 and over too).

**Support URL:** https://dailynoodle.co.uk (contact address on the privacy page).
**Marketing URL:** https://dailynoodle.co.uk. **Privacy policy URL:**
https://dailynoodle.co.uk/privacy.html.

**Copyright:** `2026` and your name as it appears on the Apple Developer account.

**Price:** Free. No in-app purchases. **Availability:** the same countries as Play (check Play
Console's list).

## Screenshots

- iPhone 6.9-inch display, portrait, 1320 × 2868 px: 3 to 10 of them. App Store Connect scales
  them down for smaller iPhones. No iPad screenshots: the app is iPhone only
  (`ios.supportsTablet: false`).
- Raw captures come from the iOS simulator run (`.github/workflows/ios-simulator.yml`, artifact
  `ios-results/store-light` and `store-dark`): Doku finished, Today, a Mini board, Archive,
  Leagues. Framed versions (brand green, caption, the Play set's style) live in
  `store/screenshots/appstore-*.png`.
- Screenshots must show the app as it runs on iPhone: never the Play set's Android captures.

## App Privacy ("nutrition label")

From the privacy page and the Play Data safety table. No tracking: nothing is used to track people
across other companies' apps or websites, there's no advertising, and nothing is sold. Supabase
is our processor.

Data collected, as App Store Connect groups it:

- **Contact info › Email address.** Only when a player signs in. Purpose: App functionality
  (sign-in and sync). Linked to the user: yes.
- **User content › Gameplay content.** A signed-in player's synced saves, streaks and stars.
  Purpose: App functionality. Linked: yes.
- **User content › Other user content.** A league nickname and puzzle results, shown to that
  league's members, only if the player joins a league. Purpose: App functionality. Linked: yes
  (to the league code, and to the account if signed in).
- **Identifiers › Device ID.** The random visit code (not the advertising identifier; the app
  never asks for it). Purpose: Analytics. Linked: no.
- **Identifiers › User ID.** The random league code, only if the player joins a league. Purpose:
  App functionality. Linked: yes.
- **Usage data › Product interaction.** Each puzzle's open, start, finish, time, checks and hints,
  and anonymous Lab votes (one per device per trial puzzle). Purpose: Analytics. Linked: no.
  Stopped by the privacy page's "Don't record my visits" switch.
- **Diagnostics › Crash data and Other diagnostic data.** The app's crash and save notes
  (`insights.app_errors`, kept 90 days; what broke, never who). Purpose: App functionality and
  Analytics. Linked: no. Stopped by the same switch.

Not collected: location, contacts, photos, files, messages, browsing or search history, health,
financial info, purchases, sensitive info.

Check against the privacy page before submitting: the Lab votes line, and whether rewards (stars)
sync for signed-in players by then.

## Age rating questionnaire

Answer for what's in the app on the day:

- **Content descriptors:** None for all of them (violence, horror, profanity, mature or suggestive
  themes, sexual content, drugs, alcohol and tobacco, medical information, simulated gambling,
  gambling, loot boxes).
- **Contests:** None. Leagues show gold, silver and bronze for the day's top three, with no
  prizes; check Apple's definition on the day.
- **Unrestricted web access:** No. The app's web views only open dailynoodle.co.uk pages (how to
  play, privacy, the board); every other link goes to the phone's browser
  (`src/shared/webview/navigation.ts`).
- **User-generated content and social features:** Yes, limited. League members see each other's
  nicknames and results. There are no profiles, messages, feeds, followers or photos. League
  rules must be ticked before joining; players can Report and Hide others.
- **Messaging and chat:** No. **Advertising:** No. **Age assurance or parental controls:** No.

Expect the lowest or a low band. If it comes out higher, re-check the user-generated content
answers.

## App Review information

**Sign-in required:** No; all puzzles play without an account. Leave the demo account fields empty
and explain in the notes.

**Notes** (paste; assumes #188 and #215 are in the build):

> Daily Noodle is a free set of daily puzzles: no adverts, no purchases, no tracking. Every puzzle
> plays without an account. Signing in is optional: it syncs results and streaks across devices
> and is needed only for Leagues.
>
> To sign in: open Account, enter any email address you can read and tap "Email me a sign-in
> link", then type the 6-digit code from the email into the app (or tap the link in the email on
> this iPhone). There is no password.
>
> To try Leagues after signing in: Leagues › Start a league, then play any puzzle on Today; the
> result appears on the league's board.
>
> To delete an account: Account › Your account › Delete your account.

**Contact:** your name, contact@dailynoodle.co.uk and a phone number Apple can reach.

## EU Digital Services Act

App Store Connect asks whether you're a trader before the app can be offered in the EU. A free
hobby app with no income is likely non-trader. If you declare trader status (for example once it
starts charging), Apple shows your address, phone and email on the EU product page.

## Content rights

"Does your app contain, show, or access third-party content?" Yes: fonts, word lists and map
outlines, used under their licences (Account › Open-source licences, `THIRD-PARTY-NOTICES.md`). You
hold the rights to use them.
