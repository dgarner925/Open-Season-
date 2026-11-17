"""Compose App Store (iOS) screenshots for Open Season — Ember style.

Takes raw device captures from ../store-raw/ and produces polished 1284x2778
(6.5"/6.7" slot) images in ../store-shots/, matching the Play Store set's look:
a text hero slide, then captioned phone frames on the warm-charcoal gradient.

Expected raw captures (PNG/JPG, any iPhone size). The 1.4.7 set, shot on an
iPhone 15 Pro, is checked in as store-raw/v147-*.jpg:
  v147-home.jpg          Home -- greeting, the daily outlook, counts
  v147-seasons.jpg       Seasons -- species chips, "Open now"
  v147-tags.jpg          Tags -- deadlines, and the way in to Leftovers
  v147-leftovers.jpg     Leftovers -- the explanation and the three warnings
  v147-applications.jpg  The ledger -- draws, costs, "riding on 7 draws"
  v147-regs.jpg          Regs -- plain-English summaries, verified dates

Captures come off the phone at slightly different heights depending on how
much the screen had scrolled, which would give each slide a phone of its own
proportions. normalise() crops or pads every capture to one aspect ratio
first -- from the TOP where there is status-bar space to spare, and at the
bottom with the capture's own background where there is not -- so the frames
line up from slide to slide.

Run:  python scripts/compose_ios.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SS = 2  # supersample
HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..")
RAW = os.path.join(ROOT, "store-raw")
OUT = os.path.join(ROOT, "store-shots")
os.makedirs(OUT, exist_ok=True)

W, H = 1284, 2778  # App Store 6.5" slot

def font_path(*parts):
    return os.path.join(ROOT, "node_modules", "@expo-google-fonts", *parts)

SERIF = font_path("instrument-serif", "400Regular", "InstrumentSerif_400Regular.ttf")
SERIF_IT = font_path("instrument-serif", "400Regular_Italic", "InstrumentSerif_400Regular_Italic.ttf")
SANS = font_path("archivo", "400Regular", "Archivo_400Regular.ttf")
SANS_SB = font_path("archivo", "600SemiBold", "Archivo_600SemiBold.ttf")
SANS_B = font_path("archivo", "700Bold", "Archivo_700Bold.ttf")

BG_TOP = (0x10, 0x0e, 0x0c)
BG_BOT = (0x17, 0x13, 0x0f)
COPPER = (0xd9, 0x9e, 0x7f)
TEXT = (0xf4, 0xf1, 0xea)
MUTED = (154, 148, 140)


def f(path, size):
    return ImageFont.truetype(path, int(size * SS))


def gradient():
    img = Image.new("RGB", (W * SS, H * SS), BG_TOP)
    d = ImageDraw.Draw(img)
    for y in range(H * SS):
        t = y / (H * SS)
        c = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (W * SS, y)], fill=c)
    return img


def centered(d, cx, y, s, font, fill):
    d.text((cx - d.textlength(s, font=font) / 2, y * SS), s, font=font, fill=fill)


def draw_tracked(d, cx, y, s, font, fill, tracking):
    tr = tracking * SS
    widths = [d.textlength(ch, font=font) for ch in s]
    total = sum(widths) + tr * (len(s) - 1)
    x = cx - total / 2
    for ch, w in zip(s, widths):
        d.text((x, y * SS), ch, font=font, fill=fill)
        x += w + tr


TARGET_AR = 1179 / 2379  # the shape most of the 1.4.7 captures came off at


def normalise(shot):
    """One aspect ratio for every capture, so no slide's phone is a different
    shape from the next. Trims the top (status-bar space) when a capture is
    too tall, and extends the bottom with its own edge colour when it is too
    short -- never the reverse, because the bottom is where the tab bar lives
    and the top is where nothing does."""
    w, h = shot.size
    want_h = int(round(w / TARGET_AR))
    if h == want_h:
        return shot
    if h > want_h:
        return shot.crop((0, h - want_h, w, h))
    pad = Image.new("RGB", (w, want_h), shot.getpixel((w // 2, h - 1)))
    pad.paste(shot, (0, 0))
    return pad


def fit(d, s, path, size, max_w):
    """Serif at 96pt is set by eye, and a longer line than the ones below
    would run off the canvas silently. Step down until it fits."""
    while size > 40:
        font = f(path, size)
        if d.textlength(s, font=font) <= max_w * SS:
            return font
        size -= 4
    return f(path, size)


def phone(img, shot_path, box_w, top_y):
    """Paste a capture centered in a rounded frame with soft shadow (1x coords)."""
    shot = normalise(Image.open(shot_path).convert("RGB"))
    sw, sh = shot.size
    pw = int(box_w * SS)
    ph = int(pw * sh / sw)
    shot = shot.resize((pw, ph), Image.LANCZOS)
    x = int((W * SS - pw) / 2)
    y = int(top_y * SS)
    r = int(56 * SS)

    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    pad = int(14 * SS)
    sd.rounded_rectangle([x - pad, y - pad + 20 * SS, x + pw + pad, y + ph + pad + 20 * SS],
                         radius=r + pad, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(30 * SS)))
    img.paste(Image.new("RGB", img.size, (0, 0, 0)), (0, 0), shadow)

    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=r, fill=255)
    img.paste(shot, (x, y), mask)
    ImageDraw.Draw(img).rounded_rectangle([x, y, x + pw - 1, y + ph - 1], radius=r,
                                          outline=(94, 74, 62), width=max(1, int(2 * SS)))


def save(img, name):
    img.resize((W, H), Image.LANCZOS).convert("RGB").save(os.path.join(OUT, name), quality=95)
    print("wrote", os.path.join("store-shots", name))


# --- 01: hero (text only) ----------------------------------------------------
img = gradient()
d = ImageDraw.Draw(img)
cx = W * SS / 2
draw_tracked(d, cx, 700, "DATES & DRAWS", f(SANS_B, 34), COPPER, 8)
centered(d, cx, 850, "Open", f(SERIF, 210), TEXT)
centered(d, cx, 1090, "season.", f(SERIF_IT, 210), COPPER)
centered(d, cx, 1430, "Never miss an opener", f(SANS_SB, 52), TEXT)
centered(d, cx, 1505, "or a tag deadline.", f(SANS_SB, 52), TEXT)
centered(d, cx, 1660, "Season dates & draw deadlines,", f(SANS, 38), MUTED)
centered(d, cx, 1720, "for every state you hunt.", f(SANS, 38), MUTED)
save(img, "01.png")

# --- 02..: captioned phone slides -------------------------------------------
# The Tags capture (store-raw/v147-tags.jpg) is deliberately NOT here. It is a
# true screenshot of a real account, and that account has no tag deadline
# coming up, so the screen reads "No upcoming tag deadlines for your follows
# right now." under a caption promising we would never let you miss one. A
# screenshot that argues with its own caption is worse than one fewer slide,
# and Leftovers below is the same tab with something on it.
SLIDES = [
    ("v147-home.jpg", "Your season,", "every morning.", "02.png"),
    ("v147-seasons.jpg", "Every opener,", "soonest first.", "03.png"),
    ("v147-leftovers.jpg", "The tags", "nobody drew.", "04.png"),
    ("v147-applications.jpg", "Every draw,", "what it cost.", "05.png"),
    ("v147-regs.jpg", "The rules,", "in plain English.", "06.png"),
]

for raw, l1, l2, out in SLIDES:
    src = os.path.join(RAW, raw)
    if not os.path.exists(src):
        print("skip (no capture):", raw)
        continue
    img = gradient()
    d = ImageDraw.Draw(img)
    centered(d, cx, 180, l1, fit(d, l1, SERIF, 96, W - 120), TEXT)
    centered(d, cx, 305, l2, fit(d, l2, SERIF_IT, 96, W - 120), COPPER)
    phone(img, src, box_w=880, top_y=560)
    save(img, out)

print("done")
