"""Generate social-media launch graphics for Open Season — Ember style.

Outputs to ../social/:
  square_announce.png   1080x1080  IG/FB post — launch announcement
  square_tags.png       1080x1080  IG/FB post — deadline feature w/ phone
  portrait_home.png     1080x1350  IG portrait post — Home shot
  story_announce.png    1080x1920  IG/FB story — announcement
  story_tags.png        1080x1920  IG/FB story — deadlines w/ phone
  fb_link.png           1200x630   FB/X link card (also good as og:image)

Phone captures come from ../store-raw/ (home.png, tags.png).
Run:  python scripts/compose_social.py
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SS = 2
HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..")
RAW = os.path.join(ROOT, "store-raw")
OUT = os.path.join(ROOT, "social")
os.makedirs(OUT, exist_ok=True)

def font_path(*parts):
    return os.path.join(ROOT, "node_modules", "@expo-google-fonts", *parts)

SERIF = font_path("instrument-serif", "400Regular", "InstrumentSerif_400Regular.ttf")
SERIF_IT = font_path("instrument-serif", "400Regular_Italic", "InstrumentSerif_400Regular_Italic.ttf")
SANS = font_path("archivo", "400Regular", "Archivo_400Regular.ttf")
SANS_SB = font_path("archivo", "600SemiBold", "Archivo_600SemiBold.ttf")
SANS_B = font_path("archivo", "700Bold", "Archivo_700Bold.ttf")

BG_TOP = (0x10, 0x0e, 0x0c)
BG_BOT = (0x1b, 0x15, 0x10)
COPPER = (0xd9, 0x9e, 0x7f)
TEXT = (0xf4, 0xf1, 0xea)
MUTED = (158, 152, 144)


def f(path, size):
    return ImageFont.truetype(path, int(size * SS))


def gradient(w, h):
    img = Image.new("RGB", (w * SS, h * SS), BG_TOP)
    d = ImageDraw.Draw(img)
    for y in range(h * SS):
        t = y / (h * SS)
        c = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (w * SS, y)], fill=c)
    return img


def centered(d, cx, y, s, font, fill):
    d.text((cx - d.textlength(s, font=font) / 2, y * SS), s, font=font, fill=fill)


def tracked(d, cx, y, s, font, fill, tr):
    widths = [d.textlength(ch, font=font) for ch in s]
    total = sum(widths) + tr * SS * (len(s) - 1)
    x = cx - total / 2
    for ch, w in zip(s, widths):
        d.text((x, y * SS), ch, font=font, fill=fill)
        x += w + tr * SS


def pill(d, cx, y, s, font, pad_x=26, pad_y=13):
    """Solid copper CTA pill, centered at cx."""
    tw = d.textlength(s, font=font)
    x0 = cx - tw / 2 - pad_x * SS
    x1 = cx + tw / 2 + pad_x * SS
    y0 = y * SS
    asc, desc = font.getmetrics()
    th = asc + desc
    y1 = y0 + th + 2 * pad_y * SS
    d.rounded_rectangle([x0, y0, x1, y1], radius=(y1 - y0) / 2, fill=COPPER)
    d.text((cx - tw / 2, y0 + pad_y * SS), s, font=font, fill=(0x16, 0x1a, 0x17))
    return (y1 / SS)


def phone(img, shot_path, box_w, top_y, canvas_w, crop_h=None):
    """Rounded phone frame centered at canvas_w/2; optionally crop capture height (1x px of source scaled)."""
    shot = Image.open(shot_path).convert("RGB")
    sw, sh = shot.size
    pw = int(box_w * SS)
    ph = int(pw * sh / sw)
    shot = shot.resize((pw, ph), Image.LANCZOS)
    if crop_h:
        ph = int(crop_h * SS)
        shot = shot.crop((0, 0, pw, ph))
    x = int((canvas_w * SS - pw) / 2)
    y = int(top_y * SS)
    r = int(34 * SS)

    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    pad = int(10 * SS)
    sd.rounded_rectangle([x - pad, y - pad + 12 * SS, x + pw + pad, y + ph + pad + 12 * SS],
                         radius=r + pad, fill=(0, 0, 0, 160))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(20 * SS)))
    img.paste(Image.new("RGB", img.size, (0, 0, 0)), (0, 0), shadow)

    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=r, fill=255)
    img.paste(shot, (x, y), mask)
    ImageDraw.Draw(img).rounded_rectangle([x, y, x + pw - 1, y + ph - 1], radius=r,
                                          outline=(94, 74, 62), width=max(1, int(2 * SS)))


def save(img, name, w, h):
    img.resize((w, h), Image.LANCZOS).convert("RGB").save(os.path.join(OUT, name), quality=95)
    print("wrote", os.path.join("social", name))


# --- square_announce 1080x1080 ----------------------------------------------
W = H = 1080
img = gradient(W, H)
d = ImageDraw.Draw(img)
cx = W * SS / 2
tracked(d, cx, 210, "DATES & DRAWS", f(SANS_B, 26), COPPER, 7)
centered(d, cx, 300, "Open", f(SERIF, 170), TEXT)
centered(d, cx, 490, "season.", f(SERIF_IT, 170), COPPER)
centered(d, cx, 740, "Never miss an opener or a tag deadline.", f(SANS_SB, 37), TEXT)
pill(d, cx, 830, "Now on the App Store · $4.99", f(SANS_B, 32))
centered(d, cx, 975, "osdatesanddraws.com", f(SANS, 28), MUTED)
save(img, "square_announce.png", W, H)

# --- square_tags 1080x1080 ---------------------------------------------------
img = gradient(W, H)
d = ImageDraw.Draw(img)
centered(d, cx, 80, "Draw deadlines,", f(SERIF, 72), TEXT)
centered(d, cx, 168, "tracked for you.", f(SERIF_IT, 72), COPPER)
phone(img, os.path.join(RAW, "tags.png"), box_w=430, top_y=300, canvas_w=W, crop_h=640)
centered(d, cx, 985, "Open Season · Now on the App Store", f(SANS_SB, 30), MUTED)
save(img, "square_tags.png", W, H)

# --- portrait_home 1080x1350 -------------------------------------------------
W, H = 1080, 1350
img = gradient(W, H)
d = ImageDraw.Draw(img)
cx = W * SS / 2
centered(d, cx, 85, "Your hunts,", f(SERIF, 76), TEXT)
centered(d, cx, 178, "at a glance.", f(SERIF_IT, 76), COPPER)
phone(img, os.path.join(RAW, "home.png"), box_w=470, top_y=320, canvas_w=W, crop_h=830)
pill(d, cx, 1215, "Get it on the App Store · $4.99", f(SANS_B, 30))
save(img, "portrait_home.png", W, H)

# --- story_announce 1080x1920 ------------------------------------------------
W, H = 1080, 1920
img = gradient(W, H)
d = ImageDraw.Draw(img)
cx = W * SS / 2
tracked(d, cx, 330, "DATES & DRAWS", f(SANS_B, 28), COPPER, 8)
centered(d, cx, 430, "Open", f(SERIF, 190), TEXT)
centered(d, cx, 645, "season.", f(SERIF_IT, 190), COPPER)
centered(d, cx, 940, "Season dates & draw deadlines", f(SANS_SB, 42), TEXT)
centered(d, cx, 1000, "for every state you hunt.", f(SANS_SB, 42), TEXT)
centered(d, cx, 1110, "Openers · Tag deadlines · Draw results", f(SANS, 32), MUTED)
pill(d, cx, 1250, "Now on the App Store · $4.99", f(SANS_B, 34))
centered(d, cx, 1440, "osdatesanddraws.com", f(SANS, 30), MUTED)
save(img, "story_announce.png", W, H)

# --- story_tags 1080x1920 ----------------------------------------------------
img = gradient(W, H)
d = ImageDraw.Draw(img)
centered(d, cx, 150, "Miss a deadline,", f(SERIF, 84), TEXT)
centered(d, cx, 252, "miss the season.", f(SERIF_IT, 84), COPPER)
phone(img, os.path.join(RAW, "tags.png"), box_w=560, top_y=440, canvas_w=W, crop_h=1010)
pill(d, cx, 1620, "Get Open Season · $4.99", f(SANS_B, 34))
save(img, "story_tags.png", W, H)

# --- fb_link 1200x630 --------------------------------------------------------
W, H = 1200, 630
img = gradient(W, H)
d = ImageDraw.Draw(img)
lx = 80 * SS
d.text((lx, 120 * SS), "DATES & DRAWS", font=f(SANS_B, 24), fill=COPPER)
d.text((lx, 175 * SS), "Open", font=f(SERIF, 120), fill=TEXT)
d.text((lx, 305 * SS), "season.", font=f(SERIF_IT, 120), fill=COPPER)
d.text((lx, 480 * SS), "Never miss an opener or a tag deadline.", font=f(SANS_SB, 30), fill=MUTED)
sh = Image.open(os.path.join(RAW, "home.png")).convert("RGB")
pw = int(340 * SS)
ph = int(pw * sh.size[1] / sh.size[0])
sh = sh.resize((pw, ph), Image.LANCZOS)
px, py = int((W - 380) * SS), int(70 * SS)
r = int(26 * SS)
mask = Image.new("L", (pw, ph), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=r, fill=255)
img.paste(sh, (px, py), mask)
ImageDraw.Draw(img).rounded_rectangle([px, py, px + pw - 1, py + ph - 1], radius=r,
                                      outline=(94, 74, 62), width=max(1, int(2 * SS)))
save(img, "fb_link.png", W, H)

print("done ->", os.path.relpath(OUT, ROOT))
