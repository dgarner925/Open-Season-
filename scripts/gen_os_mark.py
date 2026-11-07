"""Draw the O-S monogram and write every icon surface from it.

    python scripts/gen_os_mark.py          # writes assets/ + docs/site/
    python scripts/gen_os_mark.py --sheet  # contact sheet only, writes nothing

The mark is Open Season's: Instrument Serif O and S with a copper dot between
them. It was the app icon from 2026-07-22 and the splash from 2026-07-26, and
was replaced in August by the stacked Open/Season wordmark. The wordmark is the
better *identity* -- it says the name -- but it is the wrong thing in a 48px
square, where two words of serif collapse into a copper smudge. A monogram is
legible at every size an icon is actually seen at, so the two split the work:
wordmark where there is room to read, monogram everywhere small and repeated.

Restored rather than reinvented, with one change that matters. The original was
drawn for a splash screen and only filled 54% of the icon frame, which is why it
read as small and timid on a home screen. Here each surface gets the scale it
needs, and Android's two hard constraints are honoured rather than ignored:

  - adaptive-icon.png is the FOREGROUND layer. Android masks it to a circle on
    many launchers, so the mark has to fit inside a centred circle of 66.7% of
    the canvas -- measured on the diagonal, not the width. The background comes
    from android.adaptiveIcon.backgroundColor in app.json, so this file is
    transparent.
  - notification-icon.png is a silhouette. Android throws away the colour and
    tints whatever is opaque, so a copper mark on a dark square becomes a solid
    tinted block. It must be white on transparent.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(
    ROOT, 'node_modules', '@expo-google-fonts', 'instrument-serif',
    '400Regular', 'InstrumentSerif_400Regular.ttf')

# #E0A480 is today's theme copper (src/theme/tokens.ts). The 2026-07 mark used
# #d99e7f; matching the live theme matters more than matching the artefact.
COPPER = (224, 164, 128)
WHITE = (255, 255, 255)
# The background already declared for splash and adaptiveIcon in app.json.
BG = (16, 14, 12)

# Measured off the 2026-07-26 splash, which is the mark David remembers: on a
# 523px cap height the O was 328 wide, the S 240, the dot 79 across, and the two
# gaps 22 and 24px. So spacing is set as a fraction of CAP HEIGHT, not the em --
# the em carries descender space neither letter uses, and spacing specified
# against it drifts with the font's vertical metrics. The letters sit close
# enough to read as one mark rather than three objects in a row.
GAP = 0.043   # each side of the dot, as a fraction of cap height (22/523)
DOT = 0.0755  # dot radius, as a fraction of cap height (79/2/523)


def draw(size, width_frac, ink=COPPER, bg=None):
    """The mark, centred, scaled so O-dot-S spans width_frac of the frame."""
    img = Image.new('RGBA', (size, size), (bg + (255,)) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def metrics(ps):
        f = ImageFont.truetype(FONT, ps)
        ob, sb = f.getbbox('O'), f.getbbox('S')
        cap = ob[3] - ob[1]
        # Ink widths, not advance widths: the mark is three drawn shapes with
        # measured space between them, so side bearings must not creep in.
        return f, cap, (ob[0], ob[2] - ob[0]), (sb[0], sb[2] - sb[0])

    lo, hi = 10, size * 3
    for _ in range(40):
        ps = (lo + hi) // 2
        _, cap, (_, ow), (_, sw) = metrics(ps)
        total = ow + sw + 2 * GAP * cap + 2 * DOT * cap
        if total < width_frac * size:
            lo = ps
        else:
            hi = ps

    ps = lo
    f, cap, (o_lsb, ow), (s_lsb, sw) = metrics(ps)
    gap, r = GAP * cap, DOT * cap
    total = ow + sw + 2 * gap + 2 * r
    x0 = (size - total) / 2

    # Centre on the cap-height box, not the em box: the em box carries descender
    # space that neither letter uses, and centring on it sits the mark high.
    _, cap_top, _, cap_bot = f.getbbox('O')
    y0 = (size - cap) / 2 - cap_top

    d.text((x0 - o_lsb, y0), 'O', font=f, fill=ink + (255,))
    cx = x0 + ow + gap + r
    d.text((cx + r + gap - s_lsb, y0), 'S', font=f, fill=ink + (255,))
    cy = y0 + cap_top + cap / 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ink + (255,))
    return img


def fit_safe_circle(size, frac=0.667):
    """Largest width_frac whose mark fits the adaptive-icon safe circle."""
    limit = frac * size
    w = 0.70
    while w > 0.20:
        bbox = draw(size, w).getchannel('A').getbbox()
        dw, dh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        if (dw ** 2 + dh ** 2) ** 0.5 <= limit:
            return w
        w -= 0.01
    return w


SURFACES = [
    # (path, size, width_frac, ink, bg, note)
    ('assets/icon.png', 1024, 0.70, COPPER, BG, 'iOS + Play store icon'),
    ('assets/splash.png', 1024, 0.72, COPPER, None, 'splash, bg from app.json'),
    ('assets/favicon.png', 48, 0.80, COPPER, BG, 'web favicon, fills more at 48px'),
    ('assets/notification-icon.png', 1024, 0.70, WHITE, None, 'silhouette, Android tints it'),
    ('docs/site/icon.png', 512, 0.70, COPPER, BG, 'marketing site'),
]


def main():
    sheet_only = '--sheet' in sys.argv
    out = []
    adaptive_frac = fit_safe_circle(1024)

    for path, size, frac, ink, bg, note in SURFACES:
        img = draw(size, frac, ink=ink, bg=bg)
        if not sheet_only:
            img.save(os.path.join(ROOT, path))
        out.append((path, img, note))

    img = draw(1024, adaptive_frac)
    if not sheet_only:
        img.save(os.path.join(ROOT, 'assets/adaptive-icon.png'))
    out.append(('assets/adaptive-icon.png', img,
                f'foreground, {adaptive_frac:.0%} to clear the safe circle'))

    for path, img, note in out:
        bbox = img.getchannel('A').getbbox()
        print(f'  {path:38} {img.size[0]:>4}px  ink {bbox[2]-bbox[0]:>4}x{bbox[3]-bbox[1]:<4} {note}')
    print('contact sheet only, nothing written' if sheet_only else 'written')


if __name__ == '__main__':
    main()
