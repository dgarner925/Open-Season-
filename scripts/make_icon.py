"""Generate OpenSeason app icons — concept B (Blaze peak): a bold ember sun
behind a dark layered peak with a pine treeline, on slate. Rendered at 2x and
downsampled for clean antialiased edges."""
from PIL import Image, ImageDraw
import os

SS = 2  # supersample factor
S = 1024 * SS
CX = S // 2
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets")

SKY_TOP = (0x17, 0x17, 0x1F)
SKY_BOT = (0x0C, 0x0C, 0x12)
SLATE = (0x0D, 0x0D, 0x14)
SUN_CORE = (0xF4, 0xAC, 0x6E)
SUN_RIM = (0xDB, 0x6E, 0x3E)
PEAK_LIT = (0x1C, 0x1C, 0x28)
PEAK_SHADE = (0x0E, 0x0E, 0x15)
SIDE = (0x12, 0x11, 0x1B)
TREE = (0x0A, 0x0A, 0x10)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sc(x, y, k, cx=CX, cy=None):
    """scale a point toward center by factor k (for the adaptive safe zone)."""
    cy = cy if cy is not None else CX
    return (cx + (x - cx) * k, cy + (y - cy) * k)


def draw_scene(img, k=1.0, sky=True):
    d = ImageDraw.Draw(img)
    if sky:
        for y in range(S):
            d.line([(0, y), (S, y)], fill=lerp(SKY_TOP, SKY_BOT, y / S))
    # sun — concentric circles for a smooth radial glow
    sunx, suny = sc(512 * SS, 452 * SS, k)
    R = 208 * SS * k
    for r in range(int(R), 0, -1):
        t = r / R
        d.ellipse([sunx - r, suny - r, sunx + r, suny + r], fill=lerp(SUN_CORE, SUN_RIM, t))
    def poly(pts, fill):
        d.polygon([sc(x * SS, y * SS, k) for (x, y) in pts], fill=fill)
    # flanking side peaks (behind the main peak, clipping the sun edges)
    poly([(212, 548), (60, 792), (372, 792)], SIDE)
    poly([(816, 566), (676, 792), (980, 792)], SIDE)
    # main peak — broad classic mountain, two facets for a subtle ridgeline
    poly([(512, 362), (512, 792), (214, 792)], PEAK_LIT)
    poly([(512, 362), (812, 792), (512, 792)], PEAK_SHADE)
    # front treeline ridge
    base = 726
    pts = [(0, 792)]
    xs = list(range(0, 1025, 64))
    for i, x in enumerate(xs):
        pts.append((x, base + (18 if i % 2 else -20)))
    pts.append((1024, 792))
    poly(pts, TREE)
    d.rectangle([sc(0, 788 * SS, k), sc(1024 * SS, 1024 * SS, k)], fill=TREE)


def finish(img, out, size=1024, bg=None):
    if bg is not None:
        flat = Image.new("RGBA", img.size, bg + (255,))
        flat.alpha_composite(img)
        img = flat
    img = img.resize((size, size), Image.LANCZOS)
    img.save(out)
    print("wrote", os.path.relpath(out), img.size)


# 1. iOS / main icon — full bleed
ic = Image.new("RGBA", (S, S), SLATE + (255,))
draw_scene(ic, k=1.0, sky=True)
finish(ic, os.path.join(ASSETS, "icon.png"))
finish(ic, os.path.join(ASSETS, "favicon.png"), size=48)

# 2. Android adaptive foreground — content pulled into the center safe zone
ad = Image.new("RGBA", (S, S), SLATE + (255,))
draw_scene(ad, k=0.72, sky=True)
finish(ad, os.path.join(ASSETS, "adaptive-icon.png"))

# 3. Notification icon — white peak silhouette on transparent (Android alpha mask)
nt = Image.new("RGBA", (S, S), (0, 0, 0, 0))
dn = ImageDraw.Draw(nt)
W = (255, 255, 255, 255)
dn.polygon([(512 * SS, 360 * SS), (812 * SS, 760 * SS), (212 * SS, 760 * SS)], fill=W)
dn.polygon([(280 * SS, 500 * SS), (120 * SS, 760 * SS), (440 * SS, 760 * SS)], fill=W)
dn.polygon([(744 * SS, 520 * SS), (600 * SS, 760 * SS), (888 * SS, 760 * SS)], fill=W)
finish(nt, os.path.join(ASSETS, "notification-icon.png"))
