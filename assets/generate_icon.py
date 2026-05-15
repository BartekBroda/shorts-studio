#!/usr/bin/env python3
"""Generate Shorts Studio app icon: yellow audiogram bars on dark background."""
from pathlib import Path
from PIL import Image, ImageDraw

W, H       = 1024, 1024
BG         = (26, 26, 26)
YELLOW     = (254, 185, 2)

HEIGHTS    = [0.42, 0.60, 0.78, 0.95, 1.00, 0.95, 0.78, 0.60, 0.42]
BAR_W      = 68
BAR_GAP    = 22
BAR_RADIUS = 16
MAX_H      = int(H * 0.68)

BAR_COUNT  = len(HEIGHTS)
total_w    = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * BAR_GAP
x_start    = (W - total_w) // 2

img  = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

for i, h in enumerate(HEIGHTS):
    bar_h = int(h * MAX_H)
    x     = x_start + i * (BAR_W + BAR_GAP)
    y0    = (H - bar_h) // 2
    draw.rounded_rectangle([x, y0, x + BAR_W, y0 + bar_h], radius=BAR_RADIUS, fill=YELLOW)

out = Path(__file__).parent / "icon.png"
img.save(out)
print(f"icon → {out}")
