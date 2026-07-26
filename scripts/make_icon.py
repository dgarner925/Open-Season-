"""Generate Open Season app icons — the "O.S" serif monogram (Instrument Serif)
in copper on warm charcoal, matching the app's Ember palette. Rendered at 2x and
downsampled (LANCZOS) for clean antialiased edges."""
from PIL import Image, ImageDraw, ImageFont
import os

SS = 2  # supersample
S = 1024 * SS
HERE = os.path.dirname(__file__)
ASSETS = os.path.join(HERE, "..", "assets")
FONT_PATH = os.path.join(
    HERE, "..", "node_modules", "@expo-google-fonts", "instrument-serif",
    "400Regular", "InstrumentSerif_400Regular.ttf",
)

CHARCOAL = (0x1B, 0x16, 0x12)  # warm charcoal (Ember base, lifted for icon legibility)
COPPER = (0xD9, 0x9E, 0x7F)
WHITE = (255, 255, 255)

TEXT = "O·S"  # O · S with a middot


def draw_mark(img, color, width_frac=0.58):
    """Center the O.S mark, sized so its width is width_frac of the canvas."""
    d = ImageDraw.Draw(img)
    fs = int(S * 0.5)
    font = ImageFont.truetype(FONT_PATH, fs)
    w = d.textbbox((0, 0), TEXT, font=font)[2:][0] - d.textbbox((0, 0), TEXT, font=font)[0]
    fs = int(fs * (S * width_frac) / w)
    font = ImageFont.truetype(FONT_PATH, fs)
    l, t, r, b = d.textbbox((0, 0), TEXT, font=font)
    x = (S - (r - l)) / 2 - l
    y = (S - (b - t)) / 2 - t
    d.text((x, y), TEXT, font=font, fill=color)


def finish(img, out, size=1024):
    img.resize((size, size), Image.LANCZOS).save(out)
    print("wrote", os.path.relpath(out))


# 1. iOS / main icon — full-bleed charcoal, copper serif O.S (iOS masks corners)
ic = Image.new("RGBA", (S, S), CHARCOAL + (255,))
draw_mark(ic, COPPER, width_frac=0.58)
finish(ic, os.path.join(ASSETS, "icon.png"))
finish(ic, os.path.join(ASSETS, "favicon.png"), size=48)

# 2. Android adaptive foreground — mark pulled into the center safe zone
ad = Image.new("RGBA", (S, S), CHARCOAL + (255,))
draw_mark(ad, COPPER, width_frac=0.42)
finish(ad, os.path.join(ASSETS, "adaptive-icon.png"))

# 3. Notification icon — white O.S on transparent (Android alpha mask)
nt = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw_mark(nt, WHITE, width_frac=0.5)
finish(nt, os.path.join(ASSETS, "notification-icon.png"))

# 4. Splash — copper O.S on transparent; expo-splash-screen centers it (imageWidth
#    200) over the charcoal backgroundColor, so the mark is all the image needs.
sp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw_mark(sp, COPPER, width_frac=0.72)
finish(sp, os.path.join(ASSETS, "splash.png"))
