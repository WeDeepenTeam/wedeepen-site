# WeDeepen Site

The production website for **[wedeepen.com](https://wedeepen.com)** — the WeDeepen love ecosystem (Love Club, Love Immersion, The Council of Love Strategists, Events, Podcast, and more).

Founded by Christina Weber · Austin, TX.

---

## Quick facts

- **Live URL:** [wedeepen.com](https://wedeepen.com)
- **Tech:** Static HTML/CSS/JS (no framework, no build step)
- **Styling:** Tailwind CSS via CDN (no compilation required)
- **Hosting:** GitHub Pages, deploys automatically on push to `main`
- **DNS / CDN:** Cloudflare
- **Backend:** Supabase Edge Functions (TypeScript/Deno)
- **CMS / Community:** [Circle.so](https://circle.wedeepenloveclub.com/)
- **Scheduling:** Acuity (embedded iframes)

---

## Getting started (local development)

```bash
# Clone the repo
git clone https://github.com/WeDeepenTeam/wedeepen-site.git
cd wedeepen-site

# Open with any local preview server (examples):
python3 -m http.server 8000
# or
npx serve .

# Then visit http://localhost:8000
```

### Making a change

```bash
# Edit any .html or .css file
git add .
git commit -m "Short description of change"
git push
# Changes go live on wedeepen.com in ~1 minute via GitHub Pages
```

**You don't need a build step.** Tailwind is loaded via CDN. Edit HTML directly.

---

## Directory structure

```
wedeepen-site/
├── index.html                           # Homepage
├── 404.html                             # Branded 404 → auto-redirects to /
├── CNAME                                # Must stay: wedeepen.com
├── favicon.svg / favicon.ico / etc.     # Favicon (three waves, rose tile)
├── apple-touch-icon.png                 # iOS home-screen icon
│
├── love-club/                           # Membership pricing + details
├── love-immersion/                      # Retreat landing + 4 event detail pages
│   ├── june-2026/
│   ├── november-2026/
│   ├── march-2027/
│   ├── july-2027/
│   └── _generate_event_pages.py         # Regenerate detail pages from template
│
├── love-guides/                         # The Council of Love Strategists
├── events/                              # Live events calendar
├── reviews/                             # Member testimonials
├── about/                               # Christina's story + WeDeepen framework
├── podcast/                             # Podcast landing page
│   └── data/
│       ├── episodes.json                # Libsyn RSS data snapshot
│       ├── generate_episode_pages.py    # Regenerate 169 episode pages
│       └── sync_rss.py                  # Pull latest from Libsyn RSS
│
├── deepen-with-christina/               # 169 podcast episode pages
│   └── dwc-{slug}/index.html
│
├── schedule-with-christina/             # 15-min Acuity booking (public-facing)
├── book-session-with-christina/         # Private client booking (Acuity, gated offerings)
├── zoom/                                # Branded redirect to live Zoom room
│
├── images/                              # All static assets
│   ├── og/                              # Open Graph social share thumbnails
│   ├── press-logos/                     # Peacock, LA Mag, Vice, Omega, etc.
│   ├── strategists/                     # Love Strategist headshots
│   └── gallery/                         # Retreat + community photos
│
└── fonts/                               # Self-hosted Vilonti (Love Immersion only)
```

---

## Key pages

| Page | URL | File |
|------|-----|------|
| Homepage | `/` | `index.html` |
| Love Club | `/love-club/` | `love-club/index.html` |
| Love Immersion | `/love-immersion/` | `love-immersion/index.html` |
| Love Strategists | `/love-guides/` | `love-guides/index.html` |
| Events | `/events/` | `events/index.html` |
| Reviews | `/reviews/` | `reviews/index.html` |
| About | `/about/` | `about/index.html` |
| Podcast | `/podcast/` | `podcast/index.html` |
| Schedule 15 min | `/schedule-with-christina/` | `schedule-with-christina/index.html` |
| Private clients | `/book-session-with-christina/` | `book-session-with-christina/index.html` |
| Zoom redirect | `/zoom/` | `zoom/index.html` |

---

## Design system

### Colors

| Role | Hex | Tailwind alias |
|------|-----|----------------|
| Rose Deep (Love Club signature) | `#A01B4A` | `rose-deep` |
| Rose Light | `#C4577A` | `rose-light` |
| Pink Hot (CTA accent) | `#E8337A` | `pink-hot` |
| Gold / Teal | `#C9A277` | `gold` / `teal` |
| Cream | `#F4EDE0` | `cream` |
| Ink (background) | `#1A1A1A` | `ink` |
| Charcoal (card bg) | `#2D2D2D` | `charcoal` |

### Typography

- **Headings:** Playfair Display (serif) — via Google Fonts CDN
- **Body:** DM Sans (sans-serif) — via Google Fonts CDN
- **Love Immersion brand only:** Vilonti (self-hosted in `/fonts/`)

### Components

- `.btn-rose` — Rounded pill, deep rose background
- `.btn-pink` — Rounded rectangle, hot pink background
- `.btn-outline` — Transparent with gold border
- `.wd-card` — Standard card with hover lift
- `.tier-popular` — Highlighted pricing tier

---

## Content management

### Adding a podcast episode

1. Update `podcast/data/episodes.json` with new episode (or pull from Libsyn RSS):
   ```bash
   python3 podcast/data/sync_rss.py
   ```
2. Regenerate all episode pages:
   ```bash
   python3 podcast/data/generate_episode_pages.py
   ```
3. Commit + push.

### Adding/editing a Love Immersion retreat

1. Edit `love-immersion/_generate_event_pages.py` — update the `EVENTS` array.
2. Run the generator:
   ```bash
   python3 love-immersion/_generate_event_pages.py
   ```
3. Also update the 4 event cards on `love-immersion/index.html`.

### Events (dynamic calendar)

Live events pull from Circle via a Supabase Edge Function. See the `/supabase/functions/` directory in the sister repo `WeDeepenTeam/my-app` for the function source. The `events/index.html` page fetches `/functions/v1/circle-events`.

---

## Backend services

| Service | Location | Purpose |
|---------|----------|---------|
| `circle-events` | Supabase Edge Function | Pulls live events from Circle Admin API |
| `drop-a-line` | Supabase Edge Function | Homepage contact form → creates Circle member |
| Waitlist form (Love Immersion) | Google Apps Script webhook | Email captures land in a Google Sheet |

See `/supabase/functions/` in the sister repo (`WeDeepenTeam/my-app`) for Edge Function source.

---

## Social / SEO

- **og:image** for each page lives in `/images/og/` (1200×630 PNG)
- Each page has its own OG image keyed to the page's voice (e.g. Love Club = "Play at Full Range.")
- Favicon: three-wave DeePeN mark on rose tile (matches brand)
- Canonical URLs always point to `https://wedeepen.com/…` (no trailing `/wedeepen/`)

---

## Deployment

1. Push to `main` branch
2. GitHub Pages auto-builds (~30 sec)
3. Cloudflare fronts the result at wedeepen.com
4. SSL managed by GitHub + Cloudflare (Full mode)

**Check deploy status:**
```bash
gh run list --limit 5
```

**Pages settings:**
- Custom domain: `wedeepen.com`
- Enforce HTTPS: ✅
- Source: `main` branch, root

---

## Editorial / voice guidelines

The brand voice is **provocative, intellectual, sensual, direct** — captured in the Brand Bible. When writing or editing copy:

### ✅ Do
- Address the reader as "you," never "we"
- Reference real thinkers (Perel, Yalom, Brotto)
- Name the erotic directly — don't euphemize
- Use sensory language — heat, tension, breath, expansion
- Frame growth as "expanding your range," not "leaving comfort zone"

### ❌ Don't
- Use "we" when speaking to the reader
- Say "empower," "journey," or "unlock your potential"
- Use passive voice
- Frame things as "uncomfortable" or "outside your comfort zone"
- Over-explain — trust the reader

### Tagline system

- **WeDeepen (parent):** *Be the Plot Twist.* (reserved for hero moments only)
- **Love Club:** *Play at Full Range.*
- **Love Immersion:** *Main Character Weekend.*
- **Brand belief:** *Your intimacy journey is your life story.*

---

## Sister repos

- **`WeDeepenTeam/my-app`** — Christina's personal site (christinalweber.com) + Supabase Edge Functions

---

## Questions?

- **Product / copy / vision:** Christina Weber — team@wedeepen.com
- **Technical:** Open an issue in this repo, or ping the team in Slack

---

Made with care in Austin, TX. 🌊
