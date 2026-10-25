# Getting the app onto phones

What Alec does once, then what happens on every change. Claude can do everything after
step 3 from its workspace; steps 1–3 need Alec's accounts.

## Once

1. **Accounts** (recurring costs are Alec's call):
   - Expo: free account at expo.dev.
   - Apple Developer Program (about £79 a year) for iPhone installs through TestFlight.
   - Google Play Console (a one-off $25) for the internal testing track. Android can also
     install a preview build straight from a link, without Play.
2. **Link the project to Expo.** On a computer with Node 22: clone the repo, then
   `npx eas-cli@latest login` and `npx eas-cli@latest init`. Commit the change it makes to
   `app.json` (the project id and updates URL) through a pull request, or send Claude the
   project id and it will.
3. **Let GitHub build.** expo.dev → Account settings → Access tokens → create one; add it
   to this repo as the Actions secret `EXPO_TOKEN` (Settings → Secrets and variables →
   Actions). The Release workflow wakes up.
4. **First iOS build, by hand, once.** `npx eas-cli@latest build -p ios --profile production`
   and sign in with the Apple ID when asked: EAS creates and stores the certificates.
   Then `npx eas-cli@latest submit -p ios --latest` to send it to TestFlight. After that,
   builds run from GitHub (Actions → Release → Run workflow).
5. **Testers.** App Store Connect → TestFlight → Internal testing: add the family's Apple
   IDs (up to 100). Android: either share the preview build's install link, or create the
   app in Play Console, upload the first production build by hand, and add testers'
   emails to the internal testing track.

## Every change

- Merging to `main` publishes an **EAS Update** to the `preview` channel; installed preview
  builds pick it up on next launch. The Account screen shows "Version · channel · update"
  so a report can name the exact build.
- A **native change** (a new native module, an Expo SDK upgrade, app.json native config)
  needs a new build: Actions → Release → Run workflow (profile, platform; tick submit for
  TestFlight). Updates never reach a build with different native code (fingerprint policy).

## Device tests

`.maestro/*.yaml` run against an installed build (`maestro test .maestro/today.yaml` with
`APP_ID=uk.co.dailynoodle.app`). Running them in CI needs either EAS Workflows' Maestro
step or a nightly macOS job; decide once builds exist (cost: macOS minutes are ~10× Linux).
