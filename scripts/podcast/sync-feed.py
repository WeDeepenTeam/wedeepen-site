#!/usr/bin/env python3
"""
sync-feed.py: add new podcast episodes from the Libsyn RSS feed to
podcast/data/episodes.json, so generate_episode_pages.py can build their pages.

    python3 scripts/podcast/sync-feed.py            # update episodes.json, print what was added
    python3 scripts/podcast/sync-feed.py --dry-run  # print only

Matching is by Libsyn episode link (falls back to normalized title), so it is
safe to run repeatedly: existing entries are never modified or removed.
Fills Apple Podcasts links from the iTunes lookup API and YouTube ids from the
channel feed when the episode code (e.g. "ML 002") appears in a video title.
Spotify has no public lookup, so new entries leave it blank and the page falls
back to the show link; add the episode URL by hand if wanted.

After running it, rebuild:
    python3 podcast/data/generate_episode_pages.py && node scripts/build-nav.mjs
    node scripts/build-podcast-archive.mjs && node scripts/build-llms-full.mjs
"""
import html, json, re, sys, time, urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EPISODES = ROOT / "podcast/data/episodes.json"
FEED = "https://feeds.libsyn.com/yourloveaccomplice/rss"
ITUNES = "https://itunes.apple.com/lookup?id=1267527313&entity=podcastEpisode&limit=50"
YT_FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCh93E8Kx0oiAa--pPIXvHLg"
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

    if not new:
        print("No new episodes.")
        return

    # Apple Podcasts links (best effort).
    try:
        res = json.loads(get(ITUNES)).get("results", [])
        apple = {norm(r.get("trackName", "")): r.get("trackViewUrl", "").replace("&uo=4", "") for r in res if r.get("kind") == "podcast-episode"}
        for e in new:
            e["apple"] = apple.get(norm(e["title"]), "")
    except Exception as ex:  # noqa: BLE001
        print(f"warn: Apple lookup failed: {ex}")

    # YouTube ids by episode code in the video title (best effort).
    try:
        yt = get(YT_FEED)
        vids = re.findall(r"<yt:videoId>([^<]+)</yt:videoId>\s*.*?<title>([^<]+)</title>", yt, re.S)
        for e in new:
            show, num = code_of(e["title"])
            if not show:
                continue
            pat = re.compile(rf"\b{show}\s*:?\s*0*{int(num)}\b", re.I)
            hit = next((v for v, t in vids if pat.search(html.unescape(t))), "")
            e["youtube_id"] = hit
    except Exception as ex:  # noqa: BLE001
        print(f"warn: YouTube lookup failed: {ex}")

    for e in new:
        print(f"NEW {e['date']} | {e['title']} | apple={'yes' if e['apple'] else 'no'} | youtube={e['youtube_id'] or 'no'}")
    if dry:
        return
    eps.extend(new)
    eps.sort(key=lambda e: e.get("date", ""), reverse=True)
    data["episodes"] = eps
    data["count"] = len(eps)
    EPISODES.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added {len(new)} episode(s); episodes.json now has {len(eps)}.")
    add_to_sitemap(new)


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
