# Contributing to wedeepen.com

Welcome. This guide is for anyone touching wedeepen.com — Christina, future team members, contractors, or AI agents acting on someone's behalf. The bar is simple: leave the site clearer, faster, and more on-brand than you found it.

For AI-agent-specific directives, see **[CLAUDE.md](./CLAUDE.md)**.

---

## Repo separation (important)

This repo deploys **wedeepen.com only**. There is a sister repo:

| Repo | Site | Owner | What lives here |
|------|------|-------|-----------------|
| `WeDeepenTeam/wedeepen-site` | wedeepen.com | WeDeepen (team) | All WeDeepen pages, Love Club, gallery, podcast, retreats, edge-function clients |
| `WeDeepenTeam/my-app` | christinalweber.com | Christina (personal) | Christina's personal brand site + shared Supabase Edge Functions |

**Never put WeDeepen content in `my-app`.** Never put personal-brand content here. If a feature legitimately spans both (e.g. a Supabase function), put the function code in `my-app/supabase/functions/` and have wedeepen-site call it via the public function URL.

---

## Quick start (first-time contributor)

```bash
# Clone
git clone https://github.com/WeDeepenTeam/wedeepen-site.git
cd wedeepen-site

# Preview locally
python3 -m http.server 8000
# → open http://localhost:8000

# Make a change, branch, commit, push, open PR
git checkout -b your-name/short-description
# ... edit files ...
git commit -m "Short, present-tense description of change"
git push -u origin your-name/short-description
gh pr create --fill
```

---

## Branch naming

Use one of these prefixes so it's obvious what a branch does at a glance:

| Prefix | Use for | Example |
|--------|---------|---------|
| `feature/` | New page, new section, new capability | `feature/love-club-faq` |
| `fix/` | Bug or copy fix | `fix/broken-eventbrite-link` |
| `docs/` | README or contributor doc changes | `docs/clarify-gallery-runbook` |
| `content/` | Copy edits, image swaps, no structural change | `content/refresh-about-bio` |
| `chore/` | Dependency bumps, tooling, internal | `chore/update-tailwind-cdn` |
| `claude/` | AI-agent-generated branches | (auto-named) |

For external contractors or new team members, prefix with your name instead: `christina/...`, `firstname/...`. Pick a style and stay consistent.

---

## Commit messages

- **Present tense, imperative:** "Add gallery for X event" not "Added gallery" or "Adds gallery"
- **First line under 72 chars.** Body lines wrap at 80.
- **Explain the *why* if it's not obvious.** "Remove FB link" is fine; if the reason matters, add a body.
- **Reference issues or PRs** by number when relevant: "Fix nav contrast (#42)"

```
Good:
  Add MediDating gallery — 15 photos by Allison Powers
  Fix broken Eventbrite link on Biohacking Love card
  Refresh About bio with current titles + new headshot

Bad:
  updates
  WIP
  fixed stuff
  asdf
```

---

## Pull-request checklist

Before requesting review, make sure:

- [ ] Branch is up to date with `main` (rebase or merge)
- [ ] Local preview looks right at desktop **and** mobile widths (resize browser to ~375px)
- [ ] Links work — clicked at least the new/changed ones in the local preview
- [ ] No secrets committed (`.env`, API keys, Supabase service-role keys)
- [ ] No personal/private info in commits (member names, emails, photos without consent)
- [ ] OG image present if you added a new top-level page
- [ ] Tested on at least one real device or device-emulation tab if it's a layout-heavy change

If you're using Claude Code or another AI agent, the agent should follow [CLAUDE.md](./CLAUDE.md) — but you (the human owner of the PR) are still responsible for reviewing what landed.

---

## Code review bar

- **One reviewer required** for most PRs (Christina by default).
- **Two reviewers** for: changes to `index.html`, pricing/CTA copy, anything touching `love-club/`, anything that affects what visitors pay or sign up for.
- **No reviewer needed** for: typo fixes, broken link fixes, dependency bumps that pass CI.

Reviewers look for: brand voice (see Editorial section in [README](./README.md)), accessibility (contrast, alt text), correct paths (no `/wedeepen/` prefix — gallery is `/gallery/`), no secrets, mobile-OK.

---

## Secrets

**Never commit:**
- `.env` files (only `.env.example` should ever be checked in)
- API keys (Supabase service role, Circle admin token, Acuity API key, etc.)
- OAuth credentials
- Database connection strings

**Where secrets live:**
- **Bitwarden** is the source of truth. All shared credentials must be in the WeDeepen org vault. If you create a new key, save it to Bitwarden the same session.
- Edge Function secrets are set via `supabase secrets set` in the sister repo (`my-app`), never in this repo.
- Local `.env` files for the gallery pipeline live at `scripts/gallery/.env` (gitignored).

If you accidentally commit a secret: rotate it immediately, then `git filter-repo` (or open an issue and ping Christina — don't try to clean up by force-pushing).

---

## Content guidelines

The brand voice section in [README.md](./README.md#editorial--voice-guidelines) is canon. Read it before writing or editing copy. The short version:

- Address the reader as "you," never "we"
- Don't use "empower," "journey," or "unlock your potential"
- Name the erotic directly — don't euphemize
- Use real thinkers, not vague references

For longer-form writing (essays, About page, retreat descriptions), pair-write with Christina.

---

## Adding a new contributor

When someone new joins the team:

1. Add them to the `WeDeepenTeam` GitHub org (Christina admin only)
2. Share Bitwarden access to the relevant credentials (need-to-know basis)
3. Point them at this file + [CLAUDE.md](./CLAUDE.md) + [README.md](./README.md)
4. Walk through one PR live so they see the rhythm
5. After their first merged PR, add them to the CODEOWNERS list (when we add one) for the area they own

---

## Deployment

Pushes to `main` trigger GitHub Pages. Deploy is ~30 seconds. Cloudflare fronts the result.

Check deploy status:

```bash
gh run list --limit 5
```

If a deploy fails, the most common causes are:
- Broken HTML (unclosed tag) → check the failed run logs
- Missing image referenced in HTML → check `images/` is intact
- Cloudflare cache stuck → hard-refresh, or purge in CF dashboard if persistent

For canary monitoring after merge, the `gstack` plugin `/canary` skill is set up — use it after high-risk deploys.

---

## Questions

- **Anything urgent or product-related:** Christina Weber — `team@wedeepen.com`
- **Process or tooling:** Open an issue with `question` label

Thanks for caring about how this is built. 🌊
