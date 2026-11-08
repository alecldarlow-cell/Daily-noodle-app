# Google Play listing (what is in Play Console)

Everything Play Console asks for, ready to paste. Internal testing can start before most of this is
filled in; Play Console's dashboard lists what it still needs at each step. Check every answer
against what the app does on the day you submit. The Data safety answers come from the
privacy page (dailynoodle.co.uk/privacy.html) and must change whenever it does.

## Store listing

**App name** (30 max): `Daily Noodle`

**Short description** (80 max; live in Play Console, copied 8 Nov 2026):

> Nine fresh puzzles every day. Build streaks and race friends in private leagues.

**Full description** (4,000 max; live in Play Console, copied 8 Nov 2026):

> The Daily Noodle is nine small puzzles, new every morning. Each one takes a few minutes, so they fit a coffee break, a commute or the wait for the kettle.
>
> TODAY'S NINE
> • Mini – a crossword small enough for a coffee break.
> • Doku – a crossword with no clues. Place every letter so each line spells a word.
> • Sweep – find the mines with logic alone. Every grid can be solved without guessing.
> • Path – one unbroken trail from 1 to 36.
> • Link – sixteen words, four hidden groups. Watch out for the tiles that bluff.
> • Tangle – find as many words as you can before the clock runs out.
> • Borders – name the country from its outline.
> • Reckon – guesstimate ten numbers. The closer you get, the more you score.
> • Tally – sudoku with a maths twist. Make every cage hit its number.
>
> PLAY WITH FRIENDS
> Start a private league for family, friends or colleagues and see everyone's results on a daily board, with gold, silver and bronze for the top three. Share your result with one tap. It's built for the group chat.
>
> KEEP YOUR STREAK
> Every puzzle keeps its own streak, and the finish page shows your personal bests and milestones. Missed a day? Past puzzles wait in the archive.
>
> NO ADVERTS
> No adverts and no account needed to play. Sign in with your email if you'd like your results and streaks on every phone and on dailynoodle.co.uk.
>
> Sound, vibration and animations can each be switched off in Account.

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
| App info and performance › Crash logs, Diagnostics             | Yes: the app's crash and save notes (`insights.app_errors`, since 5 Nov 2026), kept 90 days  | Analytics                              | Yes: the same "Don't record my visits" switch                                 |
| Location, contacts, photos, files, messages, financial, health | No                                                                                           |                                        |                                                                               |

**Deletion:** a signed-in player can delete their synced results in Account. For league records,
the email address or anything else, the privacy page's contact address takes requests. Play's
"Delete account URL" and "Delete data URL" are both https://dailynoodle.co.uk/privacy.html#delete
(set 8 Nov 2026), the page's "Delete your data" section.

**Updated in Play Console on 8 Nov 2026:** App info and performance (crash logs, diagnostics) and
the two deletion links, after the legal check (project doc `claude/legal-compliance-2026-11-08.md`).
Change this table and the Play Console form together, and whenever privacy.html changes.

Every puzzle counts the same since 25 Oct 2026 (Alec's call): the app records native puzzles
exactly as the website's pages (page view, start, finish), with one random visitor code shared by
native puzzles and the pages the app opens. The privacy page's switch, opened from Account ›
Privacy, stops it. So the "App interactions" row applies to every puzzle.
