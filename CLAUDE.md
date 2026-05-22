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
6. **Do the work in a worktree, not the main checkout.** See "Multi-session safety" below — multiple Claude sessions and GitHub Actions agents (`WeDeepenTeam/claude/*`) edit this repo in parallel.

---

## Multi-session safety

Multiple agents (local Claude sessions + Claude Code GitHub Actions on `WeDeepenTeam/claude/*` branches) routinely touch this repo at the same time. Skipping these rules causes lost work, duplicate commits, and stale-state corruption — all of which have happened.

### Preflight check at session start

Before any edit in this repo, run:

```bash
cd ~/Documents/Codingprojects/wedeepen-site
git fetch origin
[ -f .git/index.lock ] && echo "⚠️  STALE LOCK — investigate before any git op"
git stash list | head -10
git status --short | head -10
git log --oneline HEAD..origin/main | head -5
```

Stop and investigate if you see any of:

- A `.git/index.lock` file (another git op crashed or is mid-flight)
- Stashes named `wip-*`, `before-*`, or `parallel-*` (another session is mid-task)
- Uncommitted changes in the working tree you didn't make
- `HEAD` is more than ~2 commits behind `origin/main`

### Work in a worktree

For anything beyond a one-line copy edit, use a dedicated worktree branched off the latest `origin/main`. Never edit the main checkout if another session might be active there.

```bash
git fetch origin
git worktree add ../wedeepen-site-worktrees/<task-slug> \
    -b claude/<task-slug> origin/main
cd ../wedeepen-site-worktrees/<task-slug>
# ... edit, commit, push branch, open PR ...
git worktree remove ../wedeepen-site-worktrees/<task-slug>
```

Directory convention: `../wedeepen-site-worktrees/<task-slug>` (sibling to the repo, NOT under `/tmp` which is volatile across reboots).

### Re-fetch immediately before push

Origin moves fast on this repo. A 10-minute editing window can put `origin/main` 3+ commits ahead. Right before pushing:

```bash
git fetch origin main
git log --oneline HEAD..origin/main  # empty = clean fast-forward
```

If origin moved while you were editing, `git rebase origin/main` before pushing.

### Never run destructive ops without explicit confirmation

`git reset --hard`, `git push --force`, `git checkout -- .`, removing stashes you didn't create — these can wipe a parallel session's in-flight work. When in doubt, stash with a clearly-named label (`claude/<task>-<YYYY-MM-DD>`) and ask the user before doing anything destructive.

---

## Code guards

- **🔒 FAVICON IS LOCKED — DO NOT CHANGE.** The canonical favicon source is `/favicon-source.png` (500×500, WeDeepen circular wave mark). All `favicon-*.png`, `favicon.ico`, `favicon.svg`, and `apple-touch-icon.png` are generated from that source. **Do not regenerate, replace, or "improve" any favicon file without an explicit request from Christina that names the new source image.** If you see what looks like a generic or wrong favicon and feel the urge to "fix" it, stop — verify `favicon-source.png` matches what Christina wants first. This rule exists because multiple agents kept replacing the favicon and undoing each other.
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

---

## Common pitfalls (learned the hard way)

| Symptom | Cause | Fix |
|---|---|---|
| `git diff` shows 100+ unexpected files | Another session's uncommitted work in the main checkout | Don't edit. Switch to a fresh worktree off `origin/main`. |
| `pack file ... is far too short` | Interrupted fetch from a previous session | `git fetch origin --prune` to re-download |
| Local commit duplicates an `origin/main` commit (same message, different SHA) | You committed locally before the PR-based version landed via Actions | Reset to `origin/main` after verifying file contents match — ask user first |
| `.git/index.lock` exists and is > 1h old | Crashed git op from a prior session | Safe to `rm .git/index.lock` if no `git` process is running |
| Push rejected: non-fast-forward | Origin moved during your edit window | `git fetch && git rebase origin/main`, then push |
| Stash list has `wip-*` / `before-*` / `parallel-*` entries you don't recognize | Another session is mid-task | Don't touch those stashes. Coordinate with the user before any destructive op. |
