# Google Play listing (drafted for Alec; nothing submitted)

Everything Play Console asks for, ready to paste. Internal testing can start before most of this is
filled in; Play Console's dashboard lists what it still needs at each step. Check every answer
against what the app does on the day you submit. The Data safety answers come from the
privacy page (dailynoodle.co.uk/privacy.html) and must change whenever it does.

## Store listing

**App name** (30 max): `Daily Noodle`

**Short description** (80 max, 74 used):

> Eight new puzzles every day. Play, share and compare results with friends.

**Full description** (4,000 max):

> The Daily Noodle is eight small puzzles, new every morning, from dailynoodle.co.uk.
>
> • Mini: a little daily crossword.
> • Doku: place the letter tiles so every row and column spells a word.
> • Sweep: clear the grid without opening a mine. Every grid is solvable by deduction.
> • Path: thread 1 to 36 through every square.
> • Link: find four hidden groups of four.
> • Tangle: find as many words as you can in ninety seconds.
> • Borders: identify ten countries from their outlines.
> • Reckon: estimate ten numbers, and score more the closer you get.
>
> Your streaks and results are kept on your phone. Share your result with one tap, or start a private league so friends and family can see each
> other's times on a daily leaderboard.
>
> Missed a day? Past puzzles are in the archive.
>
> No adverts and no account needed. You can sign in with your email (optional) to keep your
> results the same on every phone and browser.

**App category:** Games › Puzzle (or Word). **Tags:** Crossword, Word, Logic, Trivia.

**Contact email:** contact@dailynoodle.co.uk (the address on the privacy page). **Website:**
https://dailynoodle.co.uk. **Privacy policy:** https://dailynoodle.co.uk/privacy.html. The app
also links to the policy from Account › Privacy.

## Graphics

| Asset             | Size                                          | File                                                                                  |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| App icon          | 512 × 512 PNG                                 | `assets/images/play-store-icon.png` (the app's green DP, `scripts/make-icons.js`)     |
| Feature graphic   | 1024 × 500 PNG                                | `store/feature-graphic.png` (source: `store/feature-graphic.html`)                    |
| Phone screenshots | 2–8, 9:16, at least 1080 px on the short side | take from the first preview build: Today, a Mini mid-solve, the finish sheet, Leagues |

Screenshots need a running build, so they wait for the first Android build.

## App content declarations

- **Ads:** No.
- **App access:** All features are available without signing in. Sign-in is optional and only adds sync.
- **Content rating (IARC questionnaire):** category "Game" (puzzle). Answer No to violence, fear,
  sexuality, gambling, drugs, language and crude humour. Users can't talk to each other, but
  league nicknames are shown to the members of a league, so answer Yes to "users can
  interact/share content", limited to nicknames and results. This should rate as PEGI 3 or
  Everyone.
- **Target audience:** 13 and over. Choosing an under-13 group brings in Play's Families policy,
  and the app isn't built for it.
- **News app:** No. The app opens puzzles only.
- **Government app / financial features / health:** No.

## Data safety (draft, from the privacy page)

Data is encrypted in transit (HTTPS only). Nothing is sold, and nothing is shared with third parties,
because Supabase acts as our processor and Play doesn't count processors as sharing.

| Play data type                                                 | Collected?                                                                                   | Why                                    | Optional?                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| App activity › App interactions                                | Yes, for every puzzle, native or web page (opened, start and finish, time, checks and hints) | Analytics                              | Yes: the "Don't record my visits" switch on the privacy page in the app       |
| Device or other IDs                                            | Yes: a random visit code; a second random code if the player joins a league                  | Analytics; app functionality (leagues) | The visit code, yes; the league code only exists if the player joins a league |
| App activity › Other user-generated content                    | Yes, if the player joins a league: nickname and puzzle results, shown to that league         | App functionality                      | Yes (leagues are optional)                                                    |
| Personal info › Email address                                  | Yes, only when the player signs in to sync                                                   | Account management                     | Yes (sign-in is optional)                                                     |
| App info and performance                                       | No                                                                                           |                                        |                                                                               |
| Location, contacts, photos, files, messages, financial, health | No                                                                                           |                                        |                                                                               |

**Deletion:** a signed-in player can delete their synced results in Account. For league records
or anything else, the privacy page's contact address takes requests. Play asks for a web link where
people can request account deletion; use https://dailynoodle.co.uk/privacy.html, which gives
that contact.

Every puzzle counts the same since 25 Oct 2026 (Alec's call): the app records native puzzles
exactly as the website's pages (page view, start, finish), with one random visitor code shared by
native puzzles and the pages the app opens. The privacy page's switch, opened from Account ›
Privacy, stops it. So the "App interactions" row applies to every puzzle.
