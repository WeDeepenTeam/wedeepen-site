#!/usr/bin/env python3
"""make-cover.py — branded cover for a standalone-section page.

Same design as the retired blog covers (scripts/standalone/cover-base.py) (ink background, burgundy glow,
gold rule, Playfair title, WeDeepen wordmark), written to
images/<section>/<slug>/cover.jpg with the section's URL in the corner.

Usage:
  python3 scripts/standalone/make-cover.py <section> <slug> "<title>" ["<kicker>"]
"""
import importlib.util
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("blogcover", ROOT / "scripts" / "standalone" / "cover-base.py")
bc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bc)


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    section, slug, title = sys.argv[1], sys.argv[2], sys.argv[3]
    kicker = (sys.argv[4] if len(sys.argv) > 4 else "WeDeepen Answers").upper()
    W, H = bc.W, bc.H
    img = Image.new("RGB", (W, H), bc.INK)
    glow = Image.new("RGB", (W, H), bc.INK)
    g = ImageDraw.Draw(glow)
    g.ellipse((W * 0.45, -H * 0.4, W * 1.35, H * 0.9), fill=bc.BURGUNDY)
    g.ellipse((-W * 0.3, H * 0.55, W * 0.35, H * 1.5), fill=(90, 18, 45))
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    img = Image.blend(img, glow, 0.85)
    d = ImageDraw.Draw(img)
    pad = 120
    d.text((pad, 130), " ".join(kicker), font=bc.font("DMSans.ttf", 30, 600), fill=bc.GOLD)
    d.line((pad, 190, pad + 140, 190), fill=bc.GOLD, width=3)
    for size in range(104, 51, -4):
        tf = bc.font("PlayfairDisplay.ttf", size, 500)
        lines = bc.wrap(d, title, tf, W - pad * 2)
        if len(lines) <= 4:
            break
    y = 250
    for line in lines:
        d.text((pad, y), line, font=tf, fill=bc.WHITE)
        y += int(size * 1.18)
    d.text((pad, H - 120), "WeDeepen", font=bc.font("DMSans.ttf", 34, 700), fill=bc.WHITE)
    uf = bc.font("DMSans.ttf", 26, 400)
    label = f"wedeepen.com/{section}"
    d.text((W - pad - d.textlength(label, font=uf), H - 114), label, font=uf, fill=bc.GOLD)
    out = ROOT / "images" / section / slug / "cover.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    print(f"https://wedeepen.com/images/{section}/{slug}/cover.jpg")


if __name__ == "__main__":
    main()
