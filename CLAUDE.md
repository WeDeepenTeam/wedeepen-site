# wedeepen-site — Project Directives

This file is the entry point for AI agents (Claude Code, Cursor, etc.) working on wedeepen.com. Humans should read [README.md](./README.md) and [CONTRIBUTING.md](./CONTRIBUTING.md) instead.

---

## Identity

This repo deploys **wedeepen.com only.** It is the source of truth for the WeDeepen public website.

There is a sister repo, [`WeDeepenTeam/my-app`](https://github.com/WeDeepenTeam/my-app), that deploys **christinalweber.com** and hosts shared Supabase Edge Functions. The two repos are strictly separated — never move WeDeepen content into `my-app`, and never move personal-brand content here. If a feature legitimately needs a server endpoint, the endpoint lives in `my-app/supabase/functions/` and this repo calls its public URL.

---

## Mandatory behaviors

1. **After code changes, deploy by pushing.** GitHub Pages auto-deploys on push to `main` (~30 sec). There is no separate build step for HTML — Tailwind is loaded via CDN.
2. **Run gallery builds, never ask the user to.** If a gallery change needs `npm run gallery:build`, run it.
3. **Run SQL migrations directly** against Supabase, never paste them into chat and ask the user to run them.
4. **Verify deploy success after every push** via `gh run list --limit 3`.
5. **Use a feature branch for every non-trivial change.** Never push directly to `main` for content/code changes. Trivial typo fixes on `main` are OK.

---

## Code guards

- **Tailwind via CDN** — no build step, no `tailwind.config.js`. Use utility classes directly. Custom colors are defined inline in the `tailwind.config` script tag at the top of each page.
- **Paths:** Gallery lives at `/gallery/` — never `/wedeepen/gallery/`. The site is at the domain root, no subpath.
- **No personal info** in committed HTML (member names, emails, phone numbers, addresses).
- **OG images required** for every new top-level page. Generate at 1200×630 and put in `images/og/`.
- **Brand voice is canon** — see Editorial section in [README.md](./README.md#editorial--voice-guidelines).

---

## On-demand docs

Load these only when the task matches:

| File | Load when… |
|------|-----------|
| [`README.md`](./README.md) | Onboarding, directory structure, key pages, design system |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Branch naming, PR workflow, secrets policy, code review bar |
| [`scripts/gallery/README.md`](./scripts/gallery/README.md) | Anything gallery-related (download, upload, rebuild) |
| `GALLERY-PLAN.md` | Understanding gallery design decisions or scope |

---

## Quick refs

| | |
|---|---|
| **Tech stack** | Static HTML + Tailwind CDN + Vanilla JS |
| **Hosting** | GitHub Pages |
| **CDN / DNS** | Cloudflare |
| **Backend** | Supabase (gallery data, Edge Functions in sister repo) |
| **CMS / Community** | Circle.so |
| **Photo CDN** | Supabase Storage public bucket `gallery` |
| **Live URL** | https://wedeepen.com |
| **Sister repo** | https://github.com/WeDeepenTeam/my-app |

---

## Common operations

### Add a new page

1. Create directory: `mkdir new-page/`
2. Create `new-page/index.html` — start from any existing page as a template
3. Add OG image: `images/og/new-page.png` (1200×630)
4. Update homepage nav if it should be in the main menu
5. Update [README.md](./README.md) "Key pages" table
6. Commit + push

### Add a new photo gallery album

1. Get the public Google Drive folder URL from the photographer
2. Edit `scripts/gallery/albums.json` — add an entry with `slug`, `title`, `event_date`, `drive_folder_id`, `photographer`
3. Run the pipeline:
   ```bash
   npm run gallery:download     # pulls photos to tmp/gallery-source/<slug>/
   npm run gallery:process       # resizes + uploads to Supabase
   npm run gallery:build         # regenerates HTML
   npm run gallery:smoke         # verifies
   ```
4. Commit only the `gallery/` HTML changes (the photos themselves are in Supabase, not committed)
5. Push

### Update existing copy

1. Branch: `git checkout -b content/<short-name>`
2. Edit HTML directly
3. Preview locally: `python3 -m http.server 8000`
4. Commit, push, open PR (or push directly to `main` if it's a typo fix)

### Investigate a broken deploy

```bash
gh run list --limit 5
gh run view <run-id> --log-failed
```

Common failures: malformed HTML, missing referenced image, GitHub Pages quota (rare).

---

## Things to never do

- Push secrets, API keys, Supabase service-role keys, or `.env` files. Use `.env.example` only.
- Add a build step. The site is intentionally zero-build for fast contribution onboarding.
- Add JavaScript frameworks (React, Vue, etc.). Static HTML + Tailwind only.
- Modify someone else's branch without coordination.
- Force-push to `main`.
- Use the Edit/Write tools on `node_modules/` or `tmp/` files.
- Mirror WeDeepen content into `my-app` (or vice versa).
- Auto-merge a PR that touches pricing or CTA copy — require human review.

---

## When in doubt

If a task seems ambiguous about whether it belongs in this repo or `my-app`, ask:

- Does the change affect what visitors see on **wedeepen.com**? → This repo.
- Does the change affect what visitors see on **christinalweber.com**? → `my-app`.
- Is it a backend function called by either site? → `my-app/supabase/functions/`.
- Both? → Likely two separate PRs, one per repo, linked in their descriptions.

Default to asking before mixing concerns across repos.
