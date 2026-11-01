"""Knock the baked dark background out of the medallion plates.

The art is copper linework sitting on a flat warm-dark field (~#1e1b16), which
is NOT the app background (#100e0c) — dropped in as-is each plate would show as
a lighter square. So: derive alpha from how far each pixel rises above the
field, then un-premultiply to recover the linework's own color. The result
composites correctly on any surface in the palette.

    composite = bg*(1-a) + C*a   ->   C = (composite - bg*(1-a)) / a

Usage: python -I make_medallions.py <src_dir> <out_dir> [size]
"""
import os
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = sys.argv[2]
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 512

# Below this the pixel is field, not ink — kill it so the plate has no haze.
ALPHA_FLOOR = 0.035

os.makedirs(OUT, exist_ok=True)

for name in sorted(os.listdir(SRC)):
    if not name.endswith(".png"):
        continue
    im = Image.open(os.path.join(SRC, name)).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    h, w, _ = a.shape

    # The field color, read from a 6px frame the art never reaches.
    frame = np.concatenate([
        a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3),
        a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3),
    ])
    bg = np.median(frame, axis=0)

    # Alpha from luminance headroom above the field.
    lum = a.max(axis=2)
    lum_bg = float(bg.max())
    alpha = np.clip((lum - lum_bg) / (255.0 - lum_bg), 0.0, 1.0)
    alpha[alpha < ALPHA_FLOOR] = 0.0

    safe = np.maximum(alpha, 1e-4)[..., None]
    rgb = np.clip((a - bg * (1.0 - safe)) / safe, 0, 255)

    out = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")

    # Trim the dead margin so every plate's ring fills its frame identically.
    box = img.getbbox()
    if box:
        img = img.crop(box)
    side = max(img.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - img.width) // 2, (side - img.height) // 2))

    square = square.resize((SIZE, SIZE), Image.LANCZOS)
    # The plates are one copper family, so a 128-colour palette is visually
    # lossless here and cuts each file to a quarter — 7 of these ride in the
    # app bundle.
    square = square.quantize(colors=128, method=Image.FASTOCTREE)
    dest = os.path.join(OUT, name)
    square.save(dest, optimize=True)
    print(f"{name}: field #{int(bg[0]):02x}{int(bg[1]):02x}{int(bg[2]):02x} "
          f"-> {SIZE}px, {os.path.getsize(dest)/1024:.0f} KB")
