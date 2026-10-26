# Google reviews → /reviews/

The "Google reviews" workflow (`.github/workflows/google-reviews.yml`) runs every morning. It pulls WeDeepen's Google reviews through the Google Business Profile API, adds new ones to `reviews/data/reviews.json`, re-renders `/reviews/`, and deploys. Until the five `GBP_*` secrets exist it does nothing, and stays green.

- `sync-google.mjs` pulls the reviews and merges them in. It never deletes anything, and it skips star-only reviews.
- `google-auth.mjs` is a one-time sign-in that saves the secrets.
- `../build-reviews.mjs` renders the cards.

## One-time setup

Sign in to Google as the account that owns the **WeDeepen Relationships** Business Profile for every step.

1. **Verify the Business Profile.** Search "WeDeepen Relationships" on Google, then click **Get verified** and follow Google's steps. The API only works for verified profiles.
2. **Create a Google Cloud project.** Go to https://console.cloud.google.com/projectcreate and name it something like `wedeepen-reviews`.
3. **Ask Google for API access.** Fill in https://support.google.com/business/contact/api_default with the project number from step 2. Approval usually takes a few days to a few weeks, and Google emails you when it's done. Until then every call fails with a quota error of 0.
4. **Turn on the APIs.** Once access is approved, enable these three in the project: *Google My Business API*, *My Business Account Management API*, and *My Business Business Information API*. All three are under **APIs & Services → Library**.
5. **Set up the consent screen.** Go to **APIs & Services → OAuth consent screen** (also called Google Auth Platform → Branding / Audience).
   - If your Google account is a wedeepen.com Google Workspace account, pick **Internal**.
   - Otherwise pick **External**, add yourself as a test user, then click **Publish app**. Leaving it in "Testing" makes the sign-in expire every 7 days, and the sync would stop.
6. **Create an OAuth client.** Go to **APIs & Services → Credentials → Create credentials → OAuth client ID** and choose type **Desktop app**. Copy the client ID and client secret.
7. **Sign in once.** In this repo on your computer (with `gh` logged in), run:
   ```bash
   GBP_CLIENT_ID='paste-id' GBP_CLIENT_SECRET='paste-secret' node scripts/reviews/google-auth.mjs --save
   ```
   A browser tab opens. Approve access, and the script saves all five secrets to GitHub.
8. **Test it.** Run `gh workflow run google-reviews.yml`, or go to GitHub → Actions → Google reviews → Run workflow. The log says how many reviews are new.

## Fixing it later

- **"Google sign-in failed … refresh token may have expired"**: rerun step 7. This happens if the consent screen was left in Testing, or if you revoked access.
- **A review was taken down on Google**: the log warns, but the review stays on the page. Delete it from `reviews/data/reviews.json` and run `npm run reviews:build`.
- **The AI summary card** is hand-written in `reviews/index.html`. Refresh it now and then if the reviews start saying something new.
