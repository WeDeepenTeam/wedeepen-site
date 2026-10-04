#!/usr/bin/env python3
"""cover-base.py — shared constants and helpers (fonts, colors, text wrap)
for scripts/standalone/make-cover.py. Not run on its own.
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
