"""Generate Google Play Store listing assets for Open Season, in the Ember
palette (warm charcoal + copper, Instrument Serif + Archivo).

Outputs to ../play-store/:
  feature.png    1024x500   feature graphic (banner)
  01..05.png     1080x1920  phone screenshots (exact 9:16, Play-safe)

Rendered at 2x and downsampled (LANCZOS) for crisp text/edges.
Run:  python scripts/compose_play.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SS = 2  # supersample
HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..")
SHOTS = os.path.join(ROOT, "docs", "site")   # raw app screenshots
OUT = os.path.join(ROOT, "play-store")
os.makedirs(OUT, exist_ok=True)

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


def gradient(w, h):
    """Vertical Ember gradient canvas at supersampled size."""
    W, H = w * SS, h * SS
    img = Image.new("RGB", (W, H), BG_TOP)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        c = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)
    return img


def text_w(d, s, font):
    return d.textlength(s, font=font)


def draw_tracked(d, cx, y, s, font, fill, tracking):
    """Draw letter-spaced text centered at cx (supersampled coords)."""
    tr = tracking * SS
    widths = [d.textlength(ch, font=font) for ch in s]
    total = sum(widths) + tr * (len(s) - 1)
    x = cx - total / 2
    for ch, w in zip(s, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + tr


def centered(d, cx, y, s, font, fill):
    d.text((cx - text_w(d, s, font) / 2, y), s, font=font, fill=fill)


def rounded_phone(img, shot_path, box_w, top_y, canvas_w):
    """Paste a screenshot centered horizontally in a rounded frame with a soft
    shadow. box_w / top_y / canvas_w are in FINAL (1x) coords."""
    shot = Image.open(shot_path).convert("RGB")
    sw, sh = shot.size
    W = int(box_w * SS)
    H = int(W * sh / sw)
    shot = shot.resize((W, H), Image.LANCZOS)
    x = int((canvas_w * SS - W) / 2)
    y = int(top_y * SS)
    r = int(26 * SS)

    # soft drop shadow
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    pad = int(10 * SS)
    sd.rounded_rectangle([x - pad, y - pad + int(14 * SS), x + W + pad, y + H + pad + int(14 * SS)],
                         radius=r + pad, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(22 * SS)))
    img.paste(Image.new("RGB", img.size, (0, 0, 0)), (0, 0), shadow)

    # rounded mask for the screenshot
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, H - 1], radius=r, fill=255)
    img.paste(shot, (x, y), mask)

    # hairline copper border
    ImageDraw.Draw(img).rounded_rectangle([x, y, x + W - 1, y + H - 1], radius=r,
                                          outline=(94, 74, 62), width=max(1, int(1.5 * SS)))


def save(img, name, w, h):
    out = os.path.join(OUT, name)
    img.resize((w, h), Image.LANCZOS).convert("RGB").save(out, quality=95)
    print("wrote", os.path.relpath(out, ROOT))


# ---------------------------------------------------------------------------
# Screenshots: hero card + four captioned app shots
# ---------------------------------------------------------------------------
W, H = 1080, 1920

SHOT_SCREENS = [
    ("home.png", "Your species,", "at a glance."),
    ("seasons.png", "Every opener,", "soonest first."),
    ("tags.png", "Never miss", "a tag deadline."),
    ("detail.png", "Real dates,", "official sources."),
]

# 01 — hero (wordmark, no phone)
img = gradient(W, H)
d = ImageDraw.Draw(img)
cx = W * SS / 2
draw_tracked(d, cx, 520 * SS, "DATES & DRAWS", f(SANS_B, 26), COPPER, 6)
centered(d, cx, 640 * SS, "Open", f(SERIF, 168), TEXT)
centered(d, cx, 830 * SS, "season.", f(SERIF_IT, 168), COPPER)
centered(d, cx, 1100 * SS, "Never miss an opener", f(SANS_SB, 40), TEXT)
centered(d, cx, 1160 * SS, "or a tag deadline.", f(SANS_SB, 40), TEXT)
centered(d, cx, 1280 * SS, "Season dates & draw deadlines,", f(SANS, 30), MUTED)
centered(d, cx, 1328 * SS, "for every state you hunt.", f(SANS, 30), MUTED)
save(img, "01.png", W, H)

# 02..05 — captioned app shots
for i, (shot, l1, l2) in enumerate(SHOT_SCREENS, start=2):
    img = gradient(W, H)
    d = ImageDraw.Draw(img)
    cx = W * SS / 2
    centered(d, cx, 150 * SS, l1, f(SERIF, 76), TEXT)
    centered(d, cx, 250 * SS, l2, f(SERIF_IT, 76), COPPER)
    rounded_phone(img, os.path.join(SHOTS, shot), box_w=520, top_y=470, canvas_w=W)
    save(img, f"{i:02d}.png", W, H)

# ---------------------------------------------------------------------------
# Feature graphic 1024x500 — wordmark left, phone peeking right
# ---------------------------------------------------------------------------
FW, FH = 1024, 500
img = gradient(FW, FH)
d = ImageDraw.Draw(img)
lx = 72 * SS
d.text((lx, 96 * SS), "DATES & DRAWS", font=f(SANS_B, 22), fill=COPPER)
d.text((lx, 150 * SS), "Open", font=f(SERIF, 96), fill=TEXT)
d.text((lx, 250 * SS), "season.", font=f(SERIF_IT, 96), fill=COPPER)
d.text((lx, 388 * SS), "Never miss an opener or a tag deadline.", font=f(SANS_SB, 26), fill=MUTED)
# phone peek (home) on the right, cropped by the short canvas
phone = Image.open(os.path.join(SHOTS, "home.png")).convert("RGB")
pw = int(300 * SS)
ph = int(pw * phone.size[1] / phone.size[0])
phone = phone.resize((pw, ph), Image.LANCZOS)
px, py = int((FW - 300 + 20) * SS), int(120 * SS)
r = int(24 * SS)
mask = Image.new("L", (pw, ph), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=r, fill=255)
img.paste(phone, (px, py), mask)
ImageDraw.Draw(img).rounded_rectangle([px, py, px + pw - 1, py + ph - 1], radius=r,
                                      outline=(94, 74, 62), width=max(1, int(1.5 * SS)))
save(img, "feature.png", FW, FH)

print("done ->", os.path.relpath(OUT, ROOT))
