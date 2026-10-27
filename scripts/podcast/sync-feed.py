#!/usr/bin/env python3
"""
sync-feed.py: add new podcast episodes from the Libsyn RSS feed to
podcast/data/episodes.json, so generate_episode_pages.py can build their pages.

    python3 scripts/podcast/sync-feed.py            # update episodes.json, print what was added
    python3 scripts/podcast/sync-feed.py --dry-run  # print only
    python3 scripts/podcast/sync-feed.py --build    # update, rebuild, run checks

The last line of output is always `RESULT {json}` (new episodes with their
live URLs and missing links), so automations can read one line.

Matching is by Libsyn episode link (falls back to normalized title), so it is
safe to run repeatedly: existing entries are never removed, and the only field
it ever changes on them is an EMPTY apple / spotify / youtube_id.

fill_links() looks up:
  - Apple Podcasts links from the iTunes lookup API (by title),
  - Spotify episode links from the show's embed page (by title; it lists the
    newest episodes only, so a daily run catches each one as it appears),
  - YouTube ids from the channel feed when the episode code (e.g. "ML 002")
    appears in a video title.
Each lookup is best effort: on failure it warns and leaves the field empty
(the page falls back to the show link). It runs on new episodes plus the 12
newest existing ones that still miss a link, because Spotify and YouTube often
lag Libsyn by a day. A run writes and rebuilds if there are new episodes OR
newly filled links.

The "Podcast sync" GitHub Action (.github/workflows/podcast-sync.yml) runs
`--build` daily and commits the result to main.

After running it, rebuild:
    python3 podcast/data/generate_episode_pages.py && node scripts/build-nav.mjs
    node scripts/build-podcast-archive.mjs && node scripts/build-llms-full.mjs
"""
import html, json, re, subprocess, sys, time, urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EPISODES = ROOT / "podcast/data/episodes.json"
FEED = "https://feeds.libsyn.com/yourloveaccomplice/rss"
ITUNES = "https://itunes.apple.com/lookup?id=1267527313&entity=podcastEpisode&limit=50"
YT_FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCh93E8Kx0oiAa--pPIXvHLg"
SPOTIFY_EMBED = "https://open.spotify.com/embed/show/1Aq7R8l77roUrzY9q4DO1l"
LINK_FIELDS = ("apple", "spotify", "youtube_id")
BACKFILL = 12  # newest existing episodes re-checked for missing links
UA = {"User-Agent": "Mozilla/5.0"}


def get(url, tries=3):
    # YouTube's channel feed returns intermittent 404s; retry a couple of times.
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            if n == tries - 1:
                raise
            time.sleep(3)


def tag(item, name):
    m = re.search(rf"<{name}\b[^>]*>(.*?)</{name}>", item, re.S)
    if not m:
        return ""
    v = m.group(1).strip()
    v = re.sub(r"^<!\[CDATA\[(.*)\]\]>$", r"\1", v, flags=re.S).strip()
    return v


def attr(item, name, a):
    m = re.search(rf"<{name}\b[^>]*\b{a}=\"([^\"]+)\"", item)
    return html.unescape(m.group(1)) if m else ""


def to_text(desc_html):
    t = re.sub(r"<br\s*/?>", "\n", desc_html, flags=re.I)
    t = re.sub(r"</(p|li|div|h\d)>", "\n\n", t, flags=re.I)
    t = re.sub(r"<li[^>]*>", "- ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace("\u00a0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n\s*\n\s*(\n\s*)+", "\n\n", t)
    return "\n".join(l.strip() for l in t.strip().split("\n"))


def norm(s):
    s = html.unescape(s).replace("\u2019", "'").replace("\u2018", "'")
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def code_of(title):
    m = re.match(r"\s*(ML|DWC)\s*:?\s*(\d+)", title, re.I)
    return (m.group(1).upper(), m.group(2)) if m else (None, None)


def main():
    dry = "--dry-run" in sys.argv
    data = json.loads(EPISODES.read_text(encoding="utf-8"))
    eps = data["episodes"]
    have_links = {e.get("link", "").rstrip("/") for e in eps}
    have_titles = {norm(e.get("title", "")) for e in eps}

    feed = get(FEED)
    items = feed.split("<item>")[1:]
    if not items:
        sys.exit("error: the feed has no <item> entries (not RSS?)")
    new = []
    for raw in items:
        it = raw.split("</item>")[0]
        title = re.sub(r"\s+", " ", html.unescape(tag(it, "title"))).strip().replace("\u2019", "'").replace("\u2018", "'")
        link = html.unescape(tag(it, "link")).rstrip("/")
        if not title or link in have_links or norm(title) in have_titles:
            continue
        dt = parsedate_to_datetime(tag(it, "pubDate"))
        show, num = code_of(title)
        image = attr(it, "itunes:image", "href")
        new.append({
            "title": title,
            "episode": num or "",
            "date": dt.strftime("%Y-%m-%d"),
            "date_pretty": f"{dt.strftime('%b')} {dt.day}, {dt.year}",
            "duration": tag(it, "itunes:duration"),
            "description": to_text(tag(it, "content:encoded") or tag(it, "description")),
            "image": image,
            "link": link,
            "audio": attr(it, "enclosure", "url"),
            "apple": "",
            "spotify": "",
            "youtube_id": "",
        })

    eps.sort(key=lambda e: e.get("date", ""), reverse=True)
    backfill = [e for e in eps[:BACKFILL] if any(not e.get(k) for k in LINK_FIELDS)]
    filled = fill_links(new + backfill)
    filled_old = [f for f in filled if f["title"] not in {e["title"] for e in new}]

    for e in new:
        print(f"NEW {e['date']} | {e['title']} | apple={'yes' if e['apple'] else 'no'} | spotify={'yes' if e['spotify'] else 'no'} | youtube={e['youtube_id'] or 'no'}")
    for f in filled_old:
        print(f"FILLED {f['title']} | {', '.join(f['fields'])}")
    if not new and not filled_old:
        print("No new episodes or links.")
        print("RESULT " + json.dumps({"new": [], "filled": []}))
        return
    if dry:
        print("RESULT " + json.dumps({"new": [e["title"] for e in new], "filled": filled_old, "dry_run": True}, ensure_ascii=False))
        return
    eps.extend(new)
    eps.sort(key=lambda e: e.get("date", ""), reverse=True)
    data["episodes"] = eps
    data["count"] = len(eps)
    EPISODES.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added {len(new)} episode(s), filled links on {len(filled_old)} existing; episodes.json now has {len(eps)}.")
    if new:
        add_to_sitemap(new)
    if "--build" in sys.argv:
        build()
    print("RESULT " + json.dumps({"new": [{
        "title": e["title"],
        "url": f"https://wedeepen.com/deepen-with-christina/{slugify(e['title'])}/",
        "youtube_id": e["youtube_id"],
        "spotify": e["spotify"],
        "missing": [k for k in LINK_FIELDS if not e[k]],
    } for e in new], "filled": filled_old}, ensure_ascii=False))


def fill_links(episodes):
    """Fill EMPTY apple / spotify / youtube_id fields in place; never overwrite
    a set one. Returns [{"title", "fields"}] for each episode that changed."""
    if not episodes:
        return []
    found = {k: {} for k in LINK_FIELDS}  # id(e) -> value

    try:
        res = json.loads(get(ITUNES)).get("results", [])
        apple = {norm(r.get("trackName", "")): r.get("trackViewUrl", "").replace("&uo=4", "") for r in res if r.get("kind") == "podcast-episode"}
        for e in episodes:
            found["apple"][id(e)] = apple.get(norm(e["title"]), "")
    except Exception as ex:  # noqa: BLE001
        print(f"warn: Apple lookup failed: {ex}")

    try:
        spotify = spotify_episodes()
        for e in episodes:
            found["spotify"][id(e)] = spotify.get(norm(e["title"]), "")
    except Exception as ex:  # noqa: BLE001
        print(f"warn: Spotify lookup failed: {ex}")

    try:
        yt = get(YT_FEED)
        vids = re.findall(r"<yt:videoId>([^<]+)</yt:videoId>\s*.*?<title>([^<]+)</title>", yt, re.S)
        for e in episodes:
            show, num = code_of(e["title"])
            if not show:
                continue
            pat = re.compile(rf"\b{show}\s*:?\s*0*{int(num)}\b", re.I)
            found["youtube_id"][id(e)] = next((v for v, t in vids if pat.search(html.unescape(t))), "")
    except Exception as ex:  # noqa: BLE001
        print(f"warn: YouTube lookup failed: {ex}")

    changed = []
    for e in episodes:
        fields = []
        for k in LINK_FIELDS:
            v = found[k].get(id(e), "")
            if v and not e.get(k):
                e[k] = v
                fields.append(k)
        if fields:
            changed.append({"title": e["title"], "fields": fields})
    return changed


def spotify_episodes():
    """{normalized title: episode URL} from the show's Spotify embed page. Each
    episode is a JSON object holding "uri":"spotify:episode:<id>" and its
    "title"; read both from the same object."""
    page = get(SPOTIFY_EMBED)
    out = {}
    for m in re.finditer(r'"uri":"spotify:episode:([A-Za-z0-9]+)"', page):
        start = page.rfind("{", 0, m.start())
        end = page.find("}", m.end())
        t = re.search(r'"title":"((?:[^"\\]|\\.)*)"', page[start:end])
        if t:
            out[norm(json.loads(f'"{t.group(1)}"'))] = f"https://open.spotify.com/episode/{m.group(1)}"
    if not out:
        raise ValueError("no episodes found on the embed page")
    return out


BUILD = [
    ["python3", "podcast/data/generate_episode_pages.py"],
    ["node", "scripts/build-nav.mjs"],
    ["node", "scripts/build-podcast-archive.mjs"],
    ["node", "scripts/build-llms-full.mjs"],
    ["node", "scripts/build-nav.mjs", "--check"],
    ["node", "scripts/standalone/check-isolation.mjs"],
]


def build():
    for cmd in BUILD:
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            sys.exit(f"error: {' '.join(cmd)} failed:\n{(r.stdout + r.stderr)[-1500:]}")
    print("build: pages, nav, archive and llms-full.txt rebuilt; checks pass")


def slugify(title):
    # Same as slugify() in podcast/data/generate_episode_pages.py.
    s = re.sub(r"[^\w\s-]", "", title.lower())
    return re.sub(r"-+", "-", re.sub(r"[\s_]+", "-", s)).strip("-")


def add_to_sitemap(new):
    """Insert each new episode URL into sitemap.xml in place (build-sitemap.mjs
    would rewrite the whole file). New entries go right before the first
    existing episode entry."""
    sm = ROOT / "sitemap.xml"
    xml = sm.read_text(encoding="utf-8")
    anchor = xml.find("  <url>\n    <loc>https://wedeepen.com/deepen-with-christina/")
    if anchor < 0:
        print("warn: no episode entries in sitemap.xml; run node scripts/build-sitemap.mjs")
        return
    block = ""
    for e in new:
        loc = f"https://wedeepen.com/deepen-with-christina/{slugify(e['title'])}/"
        if loc in xml:
            continue
        block += (f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{e['date']}</lastmod>\n"
                  "    <changefreq>yearly</changefreq>\n    <priority>0.6</priority>\n  </url>\n")
    if block:
        sm.write_text(xml[:anchor] + block + xml[anchor:], encoding="utf-8")
        print(f"sitemap.xml: added {block.count('<url>')} episode URL(s)")


if __name__ == "__main__":
    main()
