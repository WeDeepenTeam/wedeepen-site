#!/usr/bin/env python3
"""make-cover.py — branded title-card cover for an in-house blog article.

Deterministic (no image model): dark ink background, burgundy glow, gold rule,
the article title in Playfair Display, and the WeDeepen wordmark. 1600x900 JPEG.

Usage:
  python3 scripts/blog/make-cover.py <slug> "<title>" ["<kicker>"]
Writes images/blog/<slug>/cover.jpg and prints its public URL.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = Path(__file__).resolve().parent / "fonts"
W, H = 1600, 900
INK = (26, 26, 26)
BURGUNDY = (160, 27, 74)
GOLD = (201, 162, 119)
WHITE = (245, 240, 235)


def font(name, size, weight):
    f = ImageFont.truetype(str(FONTS / name), size)
    try:
        f.set_variation_by_axes([weight] if name.startswith("Playfair") else [14, weight])
    except Exception:
        pass
    return f


def wrap(draw, text, f, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    slug, title = sys.argv[1], sys.argv[2]
    kicker = (sys.argv[3] if len(sys.argv) > 3 else "The WeDeepen Blog").upper()

    img = Image.new("RGB", (W, H), INK)
    glow = Image.new("RGB", (W, H), INK)
    g = ImageDraw.Draw(glow)
    g.ellipse((W * 0.45, -H * 0.4, W * 1.35, H * 0.9), fill=BURGUNDY)
    g.ellipse((-W * 0.3, H * 0.55, W * 0.35, H * 1.5), fill=(90, 18, 45))
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    img = Image.blend(img, glow, 0.85)
    d = ImageDraw.Draw(img)

    pad = 120
    kf = font("DMSans.ttf", 30, 600)
    d.text((pad, 130), " ".join(kicker), font=kf, fill=GOLD)
    d.line((pad, 190, pad + 140, 190), fill=GOLD, width=3)

    # Largest title size that fits in four lines.
    for size in range(104, 51, -4):
        tf = font("PlayfairDisplay.ttf", size, 500)
        lines = wrap(d, title, tf, W - pad * 2)
        if len(lines) <= 4:
            break
    y = 250
    for line in lines:
        d.text((pad, y), line, font=tf, fill=WHITE)
        y += int(size * 1.18)

    mf = font("DMSans.ttf", 34, 700)
    d.text((pad, H - 120), "WeDeepen", font=mf, fill=WHITE)
    uf = font("DMSans.ttf", 26, 400)
    d.text((W - pad - d.textlength("wedeepen.com/blog", font=uf), H - 114), "wedeepen.com/blog", font=uf, fill=GOLD)

    out = ROOT / "images" / "blog" / slug / "cover.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    print(f"https://wedeepen.com/images/blog/{slug}/cover.jpg")


if __name__ == "__main__":
    main()
