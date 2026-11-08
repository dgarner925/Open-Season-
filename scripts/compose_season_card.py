"""Design proof for the shareable Season Card.

Renders the card as a PNG with the real fonts and the real medallion plates,
so the design can be judged before any app code is written. The in-app version
(src/components/SeasonCard.tsx) must match what this produces.

The card is the one piece of this app that leaves the app. It carries the two
things no competitor can copy — the engraved species plates and the
field-journal type — so it is designed as a plate, not as a stat dump: a
masthead, a year, the states, the animals, the ledger of openers, one line of
arithmetic, one quote.

Run:  python scripts/compose_season_card.py
Out:  scratch/season_card.png   (1080x1350, the share-sheet standard)
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SS = 2  # supersample, same convention as compose_social.py
W, H = 540, 675  # logical; x2 = 1080x1350

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = os.path.join(ROOT, "scratch")
os.makedirs(OUT, exist_ok=True)


def font_path(*parts):
    return os.path.join(ROOT, "node_modules", "@expo-google-fonts", *parts)


SERIF = font_path("instrument-serif", "400Regular", "InstrumentSerif_400Regular.ttf")
SERIF_IT = font_path("instrument-serif", "400Regular_Italic", "InstrumentSerif_400Regular_Italic.ttf")
SANS = font_path("archivo", "400Regular", "Archivo_400Regular.ttf")
SANS_MD = font_path("archivo", "500Medium", "Archivo_500Medium.ttf")
SANS_SB = font_path("archivo", "600SemiBold", "Archivo_600SemiBold.ttf")

# The field-journal tokens (src/theme/tokens.ts), not the old Ember palette.
BG = (0x0A, 0x0A, 0x0A)
BONE = (0xF2, 0xEF, 0xEC)
MUTED = (0xC8, 0xC3, 0xBC)
DIM = (0x9A, 0x93, 0x8A)
COPPER = (0xE0, 0xA4, 0x80)
COPPER_DIM = (0xB8, 0x7A, 0x5A)

GUTTER = 42


def f(path, size):
    return ImageFont.truetype(path, int(size * SS))


def text(d, x, y, s, font, fill):
    d.text((x * SS, y * SS), s, font=font, fill=fill)


def centered(d, cx, y, s, font, fill):
    d.text((cx * SS - d.textlength(s, font=font) / 2, y * SS), s, font=font, fill=fill)


def tracked_centered(d, cx, y, s, font, fill, tr):
    """Letter-spaced small caps — the app's Micro, which sets 1.1-1.8 tracking."""
    widths = [d.textlength(ch, font=font) for ch in s]
    total = sum(widths) + tr * SS * (len(s) - 1)
    x = cx * SS - total / 2
    for ch, w in zip(s, widths):
        d.text((x, y * SS), ch, font=font, fill=fill)
        x += w + tr * SS


def plate(img, species, size, xy, opacity):
    """One engraved medallion, composited at `opacity`."""
    p = os.path.join(ROOT, "src", "assets", "medallions", species + ".png")
    if not os.path.exists(p):
        return
    m = Image.open(p).convert("RGBA")
    px = int(size * SS)
    m = m.resize((px, px), Image.LANCZOS)
    if opacity < 1:
        a = m.getchannel("A").point(lambda v: int(v * opacity))
        m.putalpha(a)
    img.alpha_composite(m, (int(xy[0] * SS), int(xy[1] * SS)))


def hairline(d, y, x0=GUTTER, x1=W - GUTTER, fill=(0x2A, 0x26, 0x22)):
    d.rectangle([x0 * SS, y * SS, x1 * SS, y * SS + 1], fill=fill)


# --------------------------------------------------------------------------- #
# The sample card. Shape matches what the app will pass in: the hunting year,
# the display name, the states, and the openers in date order.
# --------------------------------------------------------------------------- #
CARD = {
    "year": 2026,
    "name": "David",
    "states": ["Georgia", "Alabama", "Montana"],
    # (species key, species name, state code, spoken date)
    "openers": [
        ("elk", "Elk", "MT", "Sep 5"),
        ("deer", "Deer", "GA", "Oct 17"),
        ("wild-hog", "Wild hog", "AL", "Oct 24"),
        ("duck", "Duck", "AL", "Nov 21"),
        ("turkey", "Turkey", "GA", "Mar 21"),
    ],
    "quote": ("The wild things of this earth are not ours to do with as we please.", "Aldo Leopold"),
}


MAX_ROWS = 6


def compose(card):
    img = Image.new("RGBA", (W * SS, H * SS), BG + (255,))

    openers = card["openers"]
    keys, seen = [k for k, *_ in openers], []
    for k in keys:
        if k not in seen:
            seen.append(k)

    # The species plates go down first so everything else reads on top of
    # them. Bled hard off the edges so the ring never closes into a circle —
    # a visible ring reads as a sticker, a cropped one reads as letterpress.
    if len(seen) > 0:
        plate(img, seen[0], 330, (W - 150, 30), 0.075)
    if len(seen) > 1:
        plate(img, seen[1], 250, (-165, 345), 0.045)
    if len(seen) > 2:
        plate(img, seen[2], 200, (W - 95, 520), 0.05)

    d = ImageDraw.Draw(img)

    # ---- masthead ---------------------------------------------------------
    tracked_centered(d, W / 2, 44, "OPEN SEASON", f(SANS_SB, 10.5), COPPER, 4.2)

    # ---- the year, as a book plate ---------------------------------------
    # The display serif is reserved for species, dates, times and counts, and
    # a season year is a date. Both years, because a hunting year runs across
    # New Year and "2026" alone would misname the spring turkey opener.
    y0, y1 = card["year"], (card["year"] + 1) % 100
    centered(d, W / 2, 76, f"{y0}–{y1:02d}", f(SERIF, 86), BONE)
    centered(d, W / 2, 186, "my season", f(SERIF_IT, 32), COPPER)

    # ---- the states -------------------------------------------------------
    states = "  ·  ".join(s.upper() for s in card["states"])
    tracked_centered(d, W / 2, 242, states, f(SANS_MD, 10.5), DIM, 2.0)

    # ---- the ledger of openers -------------------------------------------
    hairline(d, 272)
    rows = openers[:MAX_ROWS]
    extra = len(openers) - len(rows)
    y = 290
    row_h = 36
    for name_key, name, code, date in rows:
        # The species in the sans, because the eye scans names; the date in
        # the display serif, because the date is what the card is about.
        text(d, GUTTER, y, name, f(SANS_MD, 15.5), BONE)
        text(d, GUTTER, y + 19, code, f(SANS, 10.5), DIM)
        dfont = f(SERIF, 27)
        dw = d.textlength(date, font=dfont)
        d.text(((W - GUTTER) * SS - dw, (y - 3) * SS), date, font=dfont, fill=COPPER)
        y += row_h
    if extra > 0:
        text(d, GUTTER, y, f"and {extra} more", f(SANS, 12.5), DIM)
        y += 22
    y += 6
    hairline(d, y)

    # ---- the arithmetic ---------------------------------------------------
    # State the thing before the number is the app's rule for a sentence; on a
    # plate the count IS the thing, so it leads.
    y += 24
    n_open, n_sp, n_st = len(openers), len(seen), len(card["states"])
    line = (
        f"{n_open} opener{'s' if n_open != 1 else ''}. "
        f"{n_sp} species. "
        f"{n_st} state{'s' if n_st != 1 else ''}."
    )
    centered(d, W / 2, y, line, f(SANS, 13.5), MUTED)

    # ---- the quote --------------------------------------------------------
    # Last, and only with the room left over: the plate must never push its
    # own footer off the card.
    if card.get("quote"):
        q, attr = card["quote"]
        qf = f(SERIF_IT, 19)
        lines, cur = [], ""
        for w in ("“" + q + "”").split(" "):
            trial = (cur + " " + w).strip()
            if d.textlength(trial, font=qf) > (W - GUTTER * 2 - 30) * SS and cur:
                lines.append(cur)
                cur = w
            else:
                cur = trial
        lines.append(cur)

        attr_y = H - 76
        qy = attr_y - 10 - 25 * len(lines)
        if qy > y + 26 and len(lines) <= 3:
            for ln in lines:
                centered(d, W / 2, qy, ln, qf, MUTED)
                qy += 25
            tracked_centered(d, W / 2, attr_y, attr.upper(), f(SANS_SB, 9.5), COPPER_DIM, 1.6)

    # ---- the footer -------------------------------------------------------
    tracked_centered(d, W / 2, H - 42, "OSDATESANDDRAWS.COM", f(SANS_MD, 9.5), DIM, 2.2)

    return img.convert("RGB")


if __name__ == "__main__":
    out = os.path.join(OUT, "season_card.png")
    compose(CARD).save(out)
    print(out, file=sys.stdout)
