# For Muse: add the sign-in code to Daily Noodle's sign-in emails (#215)

**What this is for.** The Daily Noodle app can now take the code from a sign-in email as well as
the link (app issue #215). Apple's reviewers need it to sign in on a review iPhone, and it helps
any player who reads their email on another device. Supabase only puts the code in the email if
the email template asks for it. This is a dashboard change, so it needs Alec's Supabase login.

**Where:** https://supabase.com/dashboard, signed in as Alec. Open the project whose URL is
`gnehttjheoyutrfsvslq.supabase.co`, then **Authentication › Emails** (the email templates page).

**Do, for both the "Magic link" template and the "Confirm signup" template:**

1. Leave everything already in the template exactly as it is, including the link
   (`{{ .ConfirmationURL }}`) and the subject.
2. Add this paragraph just after the paragraph that holds the link:

   ```html
   <p>
     Signing in on the Daily Noodle app? You can type this code instead:
     <strong>{{ .Token }}</strong>
   </p>
   ```

3. Save.

Then, under **Authentication › Sign In / Providers › Email**, read the **Email OTP Length**
setting and write down the number (6 is expected). Change nothing there.

**Check:** from the website's sign-in at https://dailynoodle.co.uk (or the app's Account tab), send
a sign-in email to Alec's own address. The email should still have its link, plus a line with a 6-digit code. Don't
use the code or the link; it expires by itself.

**Report back to Alec:** that both templates were changed, the OTP length you read, and a
screenshot of the test email with the code blurred.

**Do not:** change any other template, the sender (Resend), redirect URLs, rate limits or any
other setting.

After Alec confirms, Claude turns the app's code box on by setting `"signInCode": true` in the
site's `features.json` (no app update needed).
