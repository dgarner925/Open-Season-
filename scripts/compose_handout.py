"""Generate print-ready trade-show handouts for Open Season — Ember style.

Outputs to ../handouts/ at 300 DPI:
  postcard_front.png   4x6"  (1200x1800)  wordmark + QR + price
  postcard_back.png    4x6"  (1200x1800)  features + phone + contact
  flyer_letter.png     8.5x11" (2550x3300) full flyer w/ phones + QR
  handout_print.pdf    all three as a print-ready PDF

QR points at the App Store listing. Phone captures from ../store-raw/.
Run:  python scripts/compose_handout.py
Print notes: sized borderless at exact trim; if your print shop needs bleed,
ask and we'll regenerate with 1/8" bleed.
"""
import os
import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..")
RAW = os.path.join(ROOT, "store-raw")
OUT = os.path.join(ROOT, "handouts")
os.makedirs(OUT, exist_ok=True)

STORE_URL = "https://apps.apple.com/us/app/id6791993537"

def font_path(*parts):
    return os.path.join(ROOT, "node_modules", "@expo-google-fonts", *parts)

SERIF = font_path("instrument-serif", "400Regular", "InstrumentSerif_400Regular.ttf")
SERIF_IT = font_path("instrument-serif", "400Regular_Italic", "InstrumentSerif_400Regular_Italic.ttf")
SANS = font_path("archivo", "400Regular", "Archivo_400Regular.ttf")
SANS_SB = font_path("archivo", "600SemiBold", "Archivo_600SemiBold.ttf")
SANS_B = font_path("archivo", "700Bold", "Archivo_700Bold.ttf")

BG_TOP = (0x10, 0x0e, 0x0c)
BG_BOT = (0x1c, 0x16, 0x11)
COPPER = (0xd9, 0x9e, 0x7f)
TEXT = (0xf4, 0xf1, 0xea)
MUTED = (168, 162, 154)
CREAM = (0xf4, 0xf1, 0xea)
INK = (0x10, 0x0e, 0x0c)


def f(path, size):
    return ImageFont.truetype(path, size)


def gradient(w, h):
    img = Image.new("RGB", (w, h), BG_TOP)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        c = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img


def centered(d, cx, y, s, font, fill):
    d.text((cx - d.textlength(s, font=font) / 2, y), s, font=font, fill=fill)


def tracked(d, cx, y, s, font, fill, tr):
    widths = [d.textlength(ch, font=font) for ch in s]
    total = sum(widths) + tr * (len(s) - 1)
    x = cx - total / 2
    for ch, w in zip(s, widths):
        d.text((x, y), ch, font=font, fill=fill)
        x += w + tr


def qr_card(img, cx, y, size, label, label_font):
    """White rounded card with QR centered at cx; label under the code."""
    q = qrcode.QRCode(border=1, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(STORE_URL)
    q.make(fit=True)
    qimg = q.make_image(fill_color=INK, back_color=CREAM).convert("RGB").resize((size, size), Image.NEAREST)
    pad = size // 10
    card_w = size + 2 * pad
    d = ImageDraw.Draw(img)
    x0 = int(cx - card_w / 2)
    d.rounded_rectangle([x0, y, x0 + card_w, y + card_w], radius=pad, fill=CREAM)
    img.paste(qimg, (x0 + pad, y + pad))
    centered(d, cx, y + card_w + pad // 2, label, label_font, MUTED)
    return y + card_w


def phone(img, shot_path, box_w, top_y, cx, crop_h=None):
    shot = Image.open(shot_path).convert("RGB")
    sw, sh = shot.size
    ph = int(box_w * sh / sw)
    shot = shot.resize((box_w, ph), Image.LANCZOS)
    if crop_h:
        ph = crop_h
        shot = shot.crop((0, 0, box_w, ph))
    x = int(cx - box_w / 2)
    r = 40
    mask = Image.new("L", (box_w, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, box_w - 1, ph - 1], radius=r, fill=255)
    img.paste(shot, (x, top_y), mask)
    ImageDraw.Draw(img).rounded_rectangle([x, top_y, x + box_w - 1, top_y + ph - 1], radius=r,
                                          outline=(94, 74, 62), width=3)


pages = []

# --- Postcard FRONT 4x6 (1200x1800 @300dpi) ---------------------------------
W, H = 1200, 1800
img = gradient(W, H)
d = ImageDraw.Draw(img)
cx = W / 2
tracked(d, cx, 170, "DATES & DRAWS", f(SANS_B, 40), COPPER, 12)
centered(d, cx, 260, "Open", f(SERIF, 230), TEXT)
centered(d, cx, 510, "season.", f(SERIF_IT, 230), COPPER)
centered(d, cx, 830, "Never miss an opener", f(SANS_SB, 56), TEXT)
centered(d, cx, 905, "or a tag deadline.", f(SANS_SB, 56), TEXT)
qr_card(img, cx, 1060, 420, "Scan to download · $4.99 · iPhone", f(SANS_SB, 36))
centered(d, cx, 1660, "osdatesanddraws.com", f(SANS, 40), MUTED)
img.save(os.path.join(OUT, "postcard_front.png"), dpi=(300, 300))
pages.append(img)
print("wrote handouts/postcard_front.png (4x6 @300dpi)")

# --- Postcard BACK 4x6 ------------------------------------------------------
img = gradient(W, H)
d = ImageDraw.Draw(img)
centered(d, cx, 110, "One app. Every date", f(SERIF, 92), TEXT)
centered(d, cx, 220, "that matters.", f(SERIF_IT, 92), COPPER)

features = [
    ("Season dates for all 50 states", "Every window, verified against official agency sources."),
    ("Tag & draw deadlines", "Application windows with live countdowns, incl. WMA quota hunts."),
    ("Reminders that matter", "A push before every opener, deadline, and draw result you follow."),
    ("We watch for changes", "If an agency moves a date, you get an alert — old date and new."),
    ("$4.99 once. No subscription.", "Buy it, use it every season."),
]
y = 400
for title, body in features:
    d.ellipse([90, y + 12, 120, y + 42], fill=COPPER)
    d.text((156, y), title, font=f(SANS_B, 46), fill=TEXT)
    d.text((156, y + 58), body, font=f(SANS, 34), fill=MUTED)
    y += 168

qr_card(img, cx, y + 40, 260, "Scan for the App Store", f(SANS_SB, 32))
centered(d, cx, 1725, "© 2026 Piece & Quiet, LLC · contact@osdatesanddraws.com", f(SANS, 30), MUTED)
img.save(os.path.join(OUT, "postcard_back.png"), dpi=(300, 300))
pages.append(img)
print("wrote handouts/postcard_back.png (4x6 @300dpi)")

# --- Letter flyer 8.5x11 (2550x3300 @300dpi) --------------------------------
W, H = 2550, 3300
img = gradient(W, H)
d = ImageDraw.Draw(img)
cx = W / 2
tracked(d, cx, 200, "DATES & DRAWS", f(SANS_B, 60), COPPER, 18)
centered(d, cx, 330, "Open season.", f(SERIF, 300), TEXT)
centered(d, cx, 700, "Never miss an opener or a tag deadline.", f(SANS_SB, 84), TEXT)
centered(d, cx, 820, "Season dates & draw deadlines for every state you hunt — with a reminder before each one.",
         f(SANS, 52), MUTED)

phone(img, os.path.join(RAW, "home.png"), 640, 1020, cx - 380, crop_h=1130)
phone(img, os.path.join(RAW, "tags.png"), 640, 1020, cx + 380, crop_h=1130)

y = 2300
cols = [
    ("All 50 states", "Verified against official agency sources"),
    ("Quota & draw deadlines", "WMA hunts, lotteries, results dates"),
    ("Date-change alerts", "Agencies move dates. You'll know."),
]
colx = [cx - 800, cx, cx + 800]
for (title, body), x in zip(cols, colx):
    centered(d, x, y, title, f(SANS_B, 56), COPPER)
    centered(d, x, y + 75, body, f(SANS, 42), MUTED)

qr_card(img, cx, 2520, 430, "Scan to download · $4.99 · iPhone", f(SANS_SB, 48))
centered(d, cx, 3170, "osdatesanddraws.com  ·  © 2026 Piece & Quiet, LLC", f(SANS, 44), MUTED)
img.save(os.path.join(OUT, "flyer_letter.png"), dpi=(300, 300))
pages.append(img)
print("wrote handouts/flyer_letter.png (8.5x11 @300dpi)")

# --- Print-ready PDF --------------------------------------------------------
pages[0].save(os.path.join(OUT, "handout_print.pdf"), save_all=True,
              append_images=pages[1:], resolution=300)
print("wrote handouts/handout_print.pdf (3 pages @300dpi)")
print("done")
