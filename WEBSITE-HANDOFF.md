# WeDeepen Website Handoff

How wedeepen.com is built, deployed and maintained, and how several people (and their Claude sessions) can work on it at the same time without stepping on each other.

- **Owner and final say:** Christina Weber. Her decisions override anything in this file.
- **Audience:** WeDeepen team members and the Claude sessions they run.
- **Last verified:** 2026-09-22, against `origin/main` at `665ec25d` and the live site.
- **Public file:** this repo is public, and GitHub Pages serves every committed file, so this doc is readable at `wedeepen.com/WEBSITE-HANDOFF.md`. It contains no passwords, keys or tokens, and must never get any.

Read with: [CLAUDE.md](./CLAUDE.md) (agent rules), [README.md](./README.md) (structure, design system, voice), [CONTRIBUTING.md](./CONTRIBUTING.md) (branches, PRs, secrets).

---

## 1. Working together without conflicts (read this first)

The site now has more than one human, and each human may run several Claude sessions. On top of that, Claude Code GitHub Actions agents push `claude/*` branches. Most problems in this repo's history came from two sessions editing the same thing at once. These rules keep that from happening.

### Who decides what

| Area | Who approves | Notes |
|---|---|---|
| Copy in Christina's voice, taglines, positioning | Christina | Team may draft; Christina approves before it ships. |
| Pricing, offers, coupons, CTA wording | Christina | Never auto-merge. Two reviewers per CONTRIBUTING. |
| `index.html`, `love-club/`, `membership/`, checkout links | Christina | Treat as high-risk. |
| Typos, broken links, image swaps she asked for, podcast episode adds, gallery albums | Any team member | Normal PR flow. |
| Tooling, generators, nav, sitemap, CSS build | Whoever owns the PR, with Christina told | These touch hundreds of files. Announce before starting. |

**Christina's Claude is the source of truth.** If a team session and Christina's session disagree about how something works, Christina's session wins, and the team session should update its notes rather than "correct" hers. Team Claudes support and extend: they pick up queued work, do recurring tasks, and prepare PRs for review.

### Before you start any task

1. `git fetch origin` and read what's in flight:
   ```bash
   gh pr list --limit 20
   git log --oneline -10 origin/main
   ```
2. If an open PR already covers your area, **don't start a parallel one.** Comment on it or ask its owner. (PR #483 sat unmerged for 8 days, went stale against ~198 files and had to be redone as #512 to #514.)
3. Claim the work: open a **draft PR early** with the title describing the area, e.g. `podcast: add ML 009`. A draft PR is the "I'm on it" signal everyone can see.
4. Work in a worktree off fresh `origin/main` (see section 5), never in the main checkout.

### While working

- **One area per PR.** Small PRs merge before they go stale. Origin moves several commits a day.
- **Announce big-diff work** (nav sync, generators, sitemap, CSS build, find-and-replace across pages) in the team channel before starting. Only one of these should be in flight at a time.
- **Don't edit someone else's branch or worktree.** Don't touch stashes, worktrees or branches you didn't create.
- **Generated files are shared ground.** Nav blocks, gallery pages, podcast episode pages, `sitemap.xml` and the Love Immersion hub are written by scripts. Edit the source (JSON or template) and rerun the script; never hand-edit the output.

### Before merging

- Rebase on `origin/main` right before you push: `git fetch origin main && git log --oneline HEAD..origin/main` should be empty.
- Run the drift checks from section 9 if you ran any generator.
- After merge: `gh run list --limit 3`, then curl the live page and grep for your change.
- Delete the remote branch only **after** confirming the PR merged (deleting first auto-closes it).

### Keeping everyone's Claude in sync

- Claude sessions each keep their own memory, and it doesn't sync between people. Anything the whole team needs to know goes **in this repo** (this file, CLAUDE.md, README), via PR.
- When you learn something non-obvious (a gotcha, a decision Christina made), add it to section 11 or 12 of this file in the same PR.
- If this file disagrees with the code, the code is current. Fix the file.

---

## 2. Accounts and services

No credentials here. **Bitwarden (WeDeepen org vault) is where every shared credential lives.** Ask Christina for access to only what you need.

| Service | What it does for the site | Account / identifier |
|---|---|---|
| **GitHub** | Source code, PRs, hosting | Org `WeDeepenTeam`. Repo `WeDeepenTeam/wedeepen-site` (public). Most commits go through the `WeDeepenTeam` bot identity (team@wedeepen.com). |
| **GitHub Pages** | Hosts the site | Source: `main`, root. Custom domain `wedeepen.com` via `CNAME`. Enforce HTTPS on. |
| **Cloudflare** | DNS, proxy, SSL, HTTPS redirect, HSTS | Zone `wedeepen.com`, nameservers `kobe` / `val.ns.cloudflare.com`. See section 6. |
| **Supabase** | Gallery database + photo storage, Edge Functions | Public Storage bucket `gallery`. Tables `gallery_albums`, `gallery_media` (schema in `supabase/migrations/`). Functions `circle-events`, `drop-a-line`. |
| **Sister repo** | christinalweber.com + the shared Edge Function source | `WeDeepenTeam/christinalweber-site` (older docs call it `my-app`; GitHub redirects the old name). |
| **Circle.so** | Community, member login, member calendar, Love Club checkout | `circle.wedeepen.com` (member calendar, login). `circle.wedeepenloveclub.com` (checkout pages). |
| **SimpleTexting** | SMS/email list behind the "COUNT ME IN" popup | List `COUNTMEIN`, web form "WebSite Pop-up". |
| **Google Apps Script + Sheets** | Backup log for lead-capture signups | Script project "WeDeepen HOmepage", sheet "WeDeepen Leads", both owned by c@wedeepen.com. Source mirrored in `scripts/lead-capture/`. |
| **Google Analytics 4** | Site analytics | Measurement ID `G-LZ0EY5X593`, property "WeDeepen". Two dead properties sit in the same account; ignore them. |
| **Google Search Console** | Search indexing | Use the `wedeepen.com` **Domain** property, not the URL-prefix one. |
| **Google Drive / Docs** | Photographer photo folders; voice guide; testimonials doc | "Christina Voice Guide" and "WeDeepen Testimonials" Google Docs (ask Christina for links). |
| **TicketSpice** | Love Immersion ticket checkout | `wedeepen.ticketspice.com` |
| **Eventbrite** | Some in-person event tickets | |
| **Acuity Scheduling** | Booking embeds on `/schedule-with-christina/` and `/book-session-with-christina/` | |
| **Libsyn** | Podcast host and RSS | Feed `https://yourloveaccomplice.libsyn.com/rss` |
| **Apple Podcasts / Spotify / YouTube** | Episode links on podcast pages | Apple show id `1267527313`. |
| **Zoom** | `/zoom/` redirects to the live room | |
| **Bitwarden** | Credential vault | WeDeepen org vault |
| **Claude Code** | Local sessions + GitHub Actions agents | Actions agents push `claude/*` branches. |

---

## 3. Repo and branches

- **Repo:** https://github.com/WeDeepenTeam/wedeepen-site (public).
- **Default branch:** `main`. It is **not branch-protected** today, so discipline is the only guard. Never force-push to `main`.
- **Local checkout (Christina):** `~/Code/wedeepen-site`, worktrees in `~/Code/wedeepen-site-worktrees/<task>`.
- **Branch prefixes:** `feature/`, `fix/`, `content/`, `docs/`, `chore/`, and `claude/` for agent work. Team members can prefix with their name (`firstname/...`).
- **PR flow:** branch, PR (template in `.github/pull_request_template.md`), squash merge. Christina also ships small approved copy changes as direct commits to `main` during live editing sessions. That is her call; team members should use PRs.
- **Other repos in the org:** `christinalweber-site` (sister site), `wedeepen-kashf`, `yourmajestylovesyou`. None deploy wedeepen.com.

---

## 4. Tech stack

- Static HTML + vanilla JS. No framework, ever.
- **Tailwind:** on `main` today every page loads the **Tailwind CDN** script, with colors in an inline `tailwind.config` block per page. [PR #514](https://github.com/WeDeepenTeam/wedeepen-site/pull/514) (open) switches to a compiled `/css/wedeepen.css` built by `npm run css:build`, with theme values in `scripts/css/themes.mjs`. Christina approved that build step. **Check whether #514 has merged before touching Tailwind classes.** Once it has, run `npm run css:build` after any class change and `npm run css:classes` to catch missing classes.
- Fonts: Playfair Display + DM Sans (Google Fonts); Vilonti self-hosted in `/fonts/` for Love Immersion only.
- Node scripts (ESM) and Python 3 scripts generate nav, gallery, podcast pages, sitemap.
- Shared JS in `js/`: `lead-capture.js` (announcement bar + popup), `live-dates.js`, `optin.js`.

---

## 5. Running it locally

```bash
git clone https://github.com/WeDeepenTeam/wedeepen-site.git
cd wedeepen-site
python3 -m http.server 8000     # open http://localhost:8000
```

Start every task in a worktree:

```bash
git fetch origin
git worktree add ../wedeepen-site-worktrees/<task> -b <prefix>/<task> origin/main
cd ../wedeepen-site-worktrees/<task>
# edit, commit, push, PR
git worktree remove ../wedeepen-site-worktrees/<task>   # after merge
```

- Gallery scripts need `npm run gallery:install` once, and a local `scripts/gallery/.env` (gitignored) with the Supabase service-role key from Bitwarden.
- Test mobile at ~375px. The lead popup has a QA override: `?wd-view=mobile` or `?wd-view=desktop`.
- Christina's Mac is an 8 GB M1 Air with a near-full disk. On her machine, keep temp files small, delete them after, and avoid big parallel jobs.

---

## 6. Deploys and Cloudflare

### Deploy

1. Merge or push to `main`.
2. GitHub's built-in "pages build and deployment" runs (about 30 seconds). There are no custom workflow files.
3. Verify:
   ```bash
   gh run list --limit 3
   curl -s https://wedeepen.com/<page>/ | grep "<something you changed>"
   ```
4. If a deploy fails: `gh run view <id> --log-failed`. Usual causes are broken HTML or a missing referenced file.

### Cloudflare (as verified 2026-09-22)

- **DNS:** Cloudflare nameservers; apex `wedeepen.com` is proxied (orange cloud) to GitHub Pages.
- **Not Cloudflare Pages or Workers.** Cloudflare is only DNS + proxy in front of GitHub Pages.
- **SSL:** encryption mode Full. **Always Use HTTPS** on (`http://` returns 301). **HSTS** `max-age=31536000; includeSubDomains`, preload deliberately off. Set up with Christina on 2026-09-18; before that, most traffic arrived over plain HTTP.
- **www:** `https://www.wedeepen.com/` 301s to `https://wedeepen.com/`.
- **Caching:** HTML comes back `cf-cache-status: DYNAMIC` (not edge-cached) with GitHub's `cache-control: max-age=600`, so browsers may show the old version for up to 10 minutes. Hard-refresh first; purge in the Cloudflare dashboard only if it sticks.
- **Redirects:** no Cloudflare redirect rules are in use. Short links are stub pages in the repo using meta refresh:
  - `/sms/`, `/text/` → `/join/`
  - `/bi/`, `/bl/` → `/biohacking-love/`
  - `/ipo/` → `/inpersonoffer/`
  - `/eo/` → an external Energy Orgasms workshop page
  - `/zoom/` → the live Zoom room
  - `404.html` is branded and sends visitors back to `/`.
  To add a short link, copy one of those stub folders. A `/love-immersion/` Cloudflare rule was tried once and deleted in favor of a real hub page.
- **Changing Cloudflare settings:** only Christina, or someone she explicitly delegates, in the dashboard. Note any change in this section.

---

## 7. Where content and images live

| Content | Location |
|---|---|
| Pages | One folder per URL, each with `index.html` (e.g. `love-club/index.html` → `/love-club/`). |
| Site nav + header Log In / Join buttons | `scripts/nav/links.json` → `npm run nav:sync`. |
| Images | `images/` (WebP preferred, JPG fallback). `images/og/` for 1200×630 share images, `images/strategists/` for faculty headshots, `images/press-logos/`. |
| Favicon | **Locked.** Generated from `favicon-source.png`. Do not change without Christina naming a new source image. |
| Gallery photos | Photographer's Google Drive → Supabase Storage bucket `gallery` → generated HTML in `gallery/`. Photos are never committed. Album list in `scripts/gallery/albums.json`. |
| Podcast | `podcast/data/episodes.json` → generator writes `deepen-with-christina/<slug>/` pages. |
| Events | Live from Circle via the `circle-events` Edge Function; `events/events.json` is a static snapshot. |
| Love Immersion retreats | Dated pages under `love-immersion/<month-year>/`. Hub at `/love-immersion/` (see section 8). |
| Legal | `/terms/` (source of truth for membership tier names and prices), `/privacy/`. |
| SEO files | `sitemap.xml` (from `scripts/build-sitemap.mjs`), `robots.txt`, `llms.txt`. |
| Lead capture | `js/lead-capture.js`. Bump the `?v=N` on its script tag after every change to bust caches. |

---

## 8. Recurring tasks

### Add a podcast episode
1. Prepend the entry to `podcast/data/episodes.json` (title, episode, date, date_pretty, duration, description, image, link, audio; optional `apple`, `spotify`, `youtube_id`).
2. `python3 podcast/data/generate_episode_pages.py`, then `node scripts/build-sitemap.mjs`.
3. **Diff an old episode page** (e.g. dwc-001). Only the "More episodes" sidebar should change.
4. Bump the hardcoded episode count on `/podcast/` (visible copy **and** JSON-LD).
- The show is **Mastering Love with Christina Weber** (renamed Aug 2026 from Deepen with Christina). URLs stay under `/deepen-with-christina/`. Keep the "formerly Deepen with Christina" continuity lines.

### Add a gallery album
1. Add the album to `scripts/gallery/albums.json`.
2. `npm run gallery:download`, `gallery:process`, `gallery:build`, `gallery:smoke`.
3. Run the gallery drift checks (section 9), fix `sitemap.xml` by hand, commit only `gallery/` + the one sitemap entry.
- If Drive download fails or a folder has more than 50 photos, see section 11.

### Change the nav
Edit `scripts/nav/links.json`, `npm run nav:sync`, commit all ~230 touched files. `npm run nav:check` reports drift. Announce first: this collides with every other open PR.

### Add a Love Immersion retreat
Create the dated page with correct Event JSON-LD and run `npm run li:hub` (arrives with [PR #515](https://github.com/WeDeepenTeam/wedeepen-site/pull/515), still open as of 2026-09-22). Generic "Love Immersion" links point at `/love-immersion/`, never a dated URL. Until #515 merges, the nav still points at `/love-immersion/october-2026/`. The `EVENTS` array in `love-immersion/_generate_event_pages.py` is stale; don't trust it.

### New top-level page
Folder + `index.html` (copy a current page), OG image at `images/og/<page>.png` 1200×630, GA4 tag `G-LZ0EY5X593`, canonical `https://wedeepen.com/<page>/`, add to sitemap, add to README's key pages table.

### Copy sessions with Christina
- Propose exact copy in chat or design as a screenshot, wait for her explicit yes, then ship.
- She supplies copy verbatim. Apply it exactly, but flag anything garbled (e.g. 9pm vs 9am) with your assumed fix.
- Ship each approved change right away and verify live, because she reviews the live page between requests.

---

## 9. Mandatory checks after running a generator

Several generators rewrite *every* page they own from a template. If someone changed those pages by hand without updating the template, a rebuild silently reverts that change across dozens or hundreds of pages. This has happened at least four times.

- **Gallery:** after `gallery:build`, `git diff gallery/aboutly-training/index.html` (an album you didn't touch). Any nav/footer/head diff = drift. Check a hand-maintained page like `index.html` to see which side is current, then fix `scripts/gallery/lib/page-shell.js`. Then `git checkout sitemap.xml` and add the one new `<url>` by hand (the builder appends duplicates).
- **Podcast:** after the generator, diff `dwc-001`. Only the sidebar should change.
- **Nav:** `npm run nav:check` should be clean.
- **Tailwind (after #514 merges):** `npm run css:classes`.

---

## 10. Conventions

### Copy and voice
- Voice: provocative, intellectual, sensual, direct. Address the reader as "you." Full rules in README's Editorial section; the "Christina Voice Guide" Google Doc is canonical.
- **No em dashes** in visible page copy. Use colons, commas or periods. Titles use `|` as separator. (Testimonial quotes and meta titles are exempt.)
- **Never use "grab."** Use pick, choose, book, get.
- Banned: "empower," "journey," "unlock your potential," "comfort zone." Never call people "single" (use individual / sovereign being). No urgency countdowns; scarcity is spatial ("space for 40").
- "Love is the next frontier," not "final."
- Lead with the benefit, then the feature, then logistics.

### CTAs and naming
- **"COUNT ME IN"** is only for the lead-capture popup (`data-lead-popup`). Ticket links say "Sign Me Up," "Get Tickets," "Reserve My Spot." One deliberate exception on `/inperson/`; leave it.
- **"Become a Member,"** never "Join WeDeepen." WeDeepen is the platform; WeDeepen Membership is the product.
- Christina is **Christina Weber** in membership details. **Annie Lalla** (not Lolla). **Eva Mullen** (the testimonials doc's "Ava" is a typo).

### Offers and pricing
- **WeDeepen Membership:** $99/month or $990/year. Virtual, weekly.
- **Love Club:** single tier, **show $9,997.** The homepage button carries the `INPERSON` coupon but the site never shows the discounted price or a "$2,000 off" line. `/love-club/` and `/invest-in-love/` may still show the old two-tier model.
- **Read the Circle checkout page's "What's included" before writing Love Club copy.** The site has drifted from it before.
- Coupons pass through the URL, never hardcoded on public CTAs. `/inpersonoffer/` has one CTA per tier, each carrying `?ip=<code>`; the sales page whitelists the code and pre-fills TicketSpice's coupon field (field name differs per event; find it by curling the checkout HTML for `coupon_code`).

### Events
- Circle topics drive the `/events/` filters. "Love Club" is tagged on every event by design; don't remove it. Love Club-only events (e.g. Office Hours) never appear on the public site. Keep `data-filter` values equal to the exact Circle topic names.

### Code
- No personal info in committed HTML. No secrets anywhere. Paths are root-relative; gallery is `/gallery/`, never `/wedeepen/gallery/`.
- Every indexable page needs a unique title, meta description, canonical, og:image, alt text on images, and one `<h1>`.

---

## 11. Past problems and fixes

| Problem | Cause | Fix / prevention |
|---|---|---|
| Gallery rebuild stripped the Love Immersion nav dropdown and footer links from ~24 pages (Jul 2026) | Site-wide change hand-edited into gallery HTML, template left stale | Synced template (PR #205). Diff-an-untouched-album check. |
| Gallery rebuild would have brought back a removed footer opt-in (Aug 2026) | Template changed but never rebuilt | Removed from shell (PR #442). |
| `sitemap.xml` doubled its gallery URLs | Builder's autogen markers no longer exist in the sitemap | Revert sitemap after gallery builds; hand-add the new URL. |
| Podcast regen would have dropped the new nav button and the GA4 tag from 182 pages | Generator template stale | PRs #432 and #480. Diff dwc-001 every time. |
| gdown failed on every Drive file, and caps folders at 50 | Stale gdown cookies / API limits | List via `drive.google.com/embeddedfolderview?id=<folder>`, download each file with plain `curl` (`uc?export=download&id=`), check it's an image. Watch macOS case collisions (`-9.jpg` vs `-9.JPG`). |
| Analytics numbers looked wrong | Pages reported to an old GA4 property until 2026-09-08 | Always confirm `G-LZ0EY5X593`. |
| Over half of traffic arrived over plain HTTP | Always Use HTTPS was off | Turned on + HSTS (2026-09-18). |
| SEO PR #483 went stale, conflicted with ~198 files | Sat unreviewed 8 days while nav templating landed | Closed; redone as #512 to #514. Check `gh pr list` before starting. |
| Love Club copy promised things the product doesn't include | Site copy written from dictation, checkout had changed | Checkout page is source of truth. |
| "Current retreat" link hardcoded in five places went stale | Manual rotation | Hub page generated from retreat JSON-LD (PR #515). |
| Lead-capture Apps Script edits didn't go live | Saving the script isn't deploying | Deploy → Manage deployments → edit → New version. "New deployment" creates a new URL that would need rewiring in `js/lead-capture.js`. |
| Favicon kept getting replaced by different agents | Agents "fixing" what looked wrong | Favicon locked in CLAUDE.md. |
| Duplicate commits, lost work, `index.lock` left behind | Parallel sessions in one checkout | Worktrees, fetch before push, preflight check in CLAUDE.md. |
| Remote branch deleted, PR auto-closed unmerged | Branch deleted before merge confirmed | Confirm merge first. |

---

## 12. Open items as of 2026-09-22

- **Open PRs:** #512 (SEO technical), #513 (SEO copy), #514 (compile Tailwind), #515 (Love Immersion hub), #518 (social proof ticker). Older ones that may be stale: #428, #354, #214. Christina decides what merges or closes.
- **Docs out of date once #514 merges:** CLAUDE.md, README and `package.json` still describe "Tailwind via CDN, no build step." Update them in the same PR or right after.
- **Sister repo name:** CLAUDE.md, README and CONTRIBUTING say `my-app`; the repo is now `christinalweber-site`.
- `/love-club/` and `/invest-in-love/` may still show the old $4,997 / $9,997 two-tier pricing.
- `/kashf/` is indexable but nothing links to it: link it from `/events/` or noindex it.
- `/events/` is client-rendered only (thin for SEO).
- Off-site SEO: Google Business Profile (Austin), Bing Webmaster Tools, podcast directories.
- `main` has no branch protection. Consider requiring a PR + 1 review now that the team is growing (GitHub settings, Christina's call).
