"""Cut badge-sized masks out of the medallion plates.

The plates (scripts/make_medallions.py) are double-ringed and full of fine
hatching — gorgeous at 248px behind a species title, mush at 44pt in a list.
So the badge gets its own asset: the ring thrown away, the animal cropped to
fill the frame, and the alpha curved hard so the body reads as a shape and the
faintest grass drops out entirely.

The output is white pixels + alpha, i.e. a MASK. SpeciesBadge tints it copper
or muted-grey at render time, exactly as it tinted the old SVG engravings, so
the badge keeps one colour language instead of pasting a photograph into it.

    python make_badges.py <plates_dir> <out_dir> [size]
"""
import os
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = sys.argv[2]
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 128

# The rings live outside this radius (fraction of half-width). The plates are
# trimmed so the outer ring touches the frame, which makes this constant safe
# across all seven; the deer's antlers are the tallest thing inside it.
RING_CUT = 0.80

# Alpha curve. Everything below LO is field haze or the faintest grass and goes
# to nothing; everything at or above HI goes solid. GAMMA < 1 lifts the broad
# mid-tone wash of the animal's body so it reads as a filled silhouette rather
# than a ghost, while the linework stays crisp.
LO, HI, GAMMA = 0.10, 0.62, 0.70

# A bare getbbox() would include the faintest wisp of grass, which at 34pt is
# invisible ink that still steals a tenth of the frame from the animal. So the
# box is drawn around where the ink actually IS: rows and columns carrying less
# than this share of the heaviest row/column are margin, not art.
INK_SHARE = 0.06


def ink_box(alpha):
    """Bounding box of the rows/columns that carry real ink."""
    rows, cols = alpha.sum(axis=1), alpha.sum(axis=0)
    ry = np.flatnonzero(rows > rows.max() * INK_SHARE)
    rx = np.flatnonzero(cols > cols.max() * INK_SHARE)
    if len(ry) == 0 or len(rx) == 0:
        return None
    return int(rx[0]), int(ry[0]), int(rx[-1]) + 1, int(ry[-1]) + 1


os.makedirs(OUT, exist_ok=True)

for name in sorted(os.listdir(SRC)):
    if not name.endswith(".png"):
        continue
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    a = np.asarray(im).astype(np.float32) / 255.0
    alpha = a[..., 3]
    h, w = alpha.shape

    # Throw the rings away: anything beyond RING_CUT of centre.
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((yy - (h - 1) / 2) / (h / 2), (xx - (w - 1) / 2) / (w / 2))
    alpha = np.where(r > RING_CUT, 0.0, alpha)

    # Curve it: drop the haze, lift the body, keep the line.
    alpha = np.clip((alpha - LO) / (HI - LO), 0.0, 1.0) ** GAMMA

    mask = Image.fromarray((alpha * 255).astype(np.uint8), "L")
    box = ink_box(alpha)
    if box:
        mask = mask.crop(box)

    # Square on the long side. No padding: at 34pt every pixel of the frame is
    # worth having, and the badge's own corner radius keeps the art off them.
    side = max(mask.size)
    square = Image.new("L", (side, side), 0)
    square.paste(mask, ((side - mask.width) // 2, (side - mask.height) // 2))
    square = square.resize((SIZE, SIZE), Image.LANCZOS)

    rgba = Image.merge("RGBA", (
        Image.new("L", (SIZE, SIZE), 255),
        Image.new("L", (SIZE, SIZE), 255),
        Image.new("L", (SIZE, SIZE), 255),
        square,
    ))
    dest = os.path.join(OUT, name)
    rgba.save(dest, optimize=True)
    print(f"{name}: -> {SIZE}px, {os.path.getsize(dest)/1024:.0f} KB")
