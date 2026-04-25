"""Generate app icons for the Baby Diary app.

Outputs:
- icon.png 1024x1024  full bleed (iOS + main)
- adaptive-icon-foreground.png 1024x1024  transparent + safe-zone art
- adaptive-icon-monochrome.png 1024x1024  monochrome silhouette
- splash-icon.png 1024x1024  larger transparent icon for splash
- favicon.png 48x48
"""
from PIL import Image, ImageDraw, ImageFilter
import math
import os

OUT_DIR = "assets/images"
SIZE = 1024

CREAM = (255, 245, 240)
PEACH = (255, 138, 122)
PEACH_DARK = (230, 110, 95)
WHITE = (255, 255, 255)
SHADOW = (0, 0, 0, 30)


def rounded_rect(draw, xy, radius, fill, outline=None, width=0):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def heart_path(cx, cy, size):
    """Return polygon points roughly outlining a heart."""
    pts = []
    steps = 200
    for i in range(steps):
        t = (i / steps) * 2 * math.pi
        x = 16 * (math.sin(t) ** 3)
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * size / 32, cy - y * size / 32))
    return pts


def draw_polaroid_card(img, cx, cy, w, h, rotation_deg, photo_color, shadow=True):
    layer = Image.new("RGBA", (img.width, img.height), (0, 0, 0, 0))
    layer_draw = ImageDraw.Draw(layer)

    pad = int(w * 0.08)
    bottom_pad = int(h * 0.18)

    card_box = (cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2)
    rounded_rect(layer_draw, card_box, radius=int(w * 0.04), fill=WHITE)

    photo_box = (
        card_box[0] + pad,
        card_box[1] + pad,
        card_box[2] - pad,
        card_box[3] - bottom_pad,
    )
    rounded_rect(layer_draw, photo_box, radius=int(w * 0.025), fill=photo_color)

    rotated = layer.rotate(rotation_deg, resample=Image.BICUBIC, center=(cx, cy))

    if shadow:
        shadow_layer = Image.new("RGBA", (img.width, img.height), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow_layer)
        shadow_box = (cx - w // 2, cy - h // 2 + 12, cx + w // 2, cy + h // 2 + 12)
        rounded_rect(shadow_draw, shadow_box, radius=int(w * 0.04), fill=SHADOW)
        shadow_rotated = shadow_layer.rotate(rotation_deg, resample=Image.BICUBIC, center=(cx, cy))
        shadow_blurred = shadow_rotated.filter(ImageFilter.GaussianBlur(radius=18))
        img.alpha_composite(shadow_blurred)

    img.alpha_composite(rotated)


def compose_icon(background=True):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    if background:
        draw = ImageDraw.Draw(img)
        for y in range(SIZE):
            t = y / SIZE
            r = int(CREAM[0] * (1 - t * 0.04))
            g = int(CREAM[1] * (1 - t * 0.04))
            b = int(CREAM[2] * (1 - t * 0.04))
            draw.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

    cx, cy = SIZE // 2, int(SIZE * 0.46)
    card_w = int(SIZE * 0.62)
    card_h = int(card_w * 1.18)

    # Back card
    draw_polaroid_card(img, cx + 60, cy + 30, card_w, card_h, rotation_deg=8, photo_color=(255, 200, 170, 255))
    # Front card
    draw_polaroid_card(img, cx - 30, cy - 10, card_w, card_h, rotation_deg=-6, photo_color=PEACH)

    # Heart on top of front card (centered on front photo area roughly)
    heart_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    heart_draw = ImageDraw.Draw(heart_layer)
    heart_pts = heart_path(cx - 30, cy - 30, int(SIZE * 0.18))
    heart_draw.polygon(heart_pts, fill=WHITE)
    heart_layer = heart_layer.rotate(-6, resample=Image.BICUBIC, center=(cx - 30, cy - 10))
    img.alpha_composite(heart_layer)

    return img


def add_squircle_mask(img):
    mask = Image.new("L", (SIZE, SIZE), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = int(SIZE * 0.22)
    mask_draw.rounded_rectangle((0, 0, SIZE, SIZE), radius=radius, fill=255)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    main_icon = compose_icon(background=True)
    main_icon.save(os.path.join(OUT_DIR, "icon.png"))

    # Adaptive foreground: art only, no background, with safe area inset
    fg_full = compose_icon(background=False)
    fg_inset = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    inset = int(SIZE * 0.18)
    inner_size = SIZE - inset * 2
    fg_resized = fg_full.resize((inner_size, inner_size), Image.LANCZOS)
    fg_inset.paste(fg_resized, (inset, inset), fg_resized)
    fg_inset.save(os.path.join(OUT_DIR, "android-icon-foreground.png"))

    # Background image: solid cream tile
    bg = Image.new("RGBA", (SIZE, SIZE), CREAM + (255,))
    bg.save(os.path.join(OUT_DIR, "android-icon-background.png"))

    # Monochrome: silhouette only
    mono = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    mono_draw = ImageDraw.Draw(mono)
    cx, cy = SIZE // 2, int(SIZE * 0.46)
    card_w = int(SIZE * 0.62)
    card_h = int(card_w * 1.18)
    rounded_rect(mono_draw, (cx - card_w // 2, cy - card_h // 2, cx + card_w // 2, cy + card_h // 2), radius=int(card_w * 0.04), fill=(0, 0, 0, 255))
    heart_pts = heart_path(cx, cy - 30, int(SIZE * 0.18))
    mono_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    mono_layer_draw = ImageDraw.Draw(mono_layer)
    mono_layer_draw.polygon(heart_pts, fill=(255, 255, 255, 0))
    mono.save(os.path.join(OUT_DIR, "android-icon-monochrome.png"))

    # Splash: just the polaroid + heart, large, no bg
    splash = compose_icon(background=False)
    splash.save(os.path.join(OUT_DIR, "splash-icon.png"))

    # Favicon
    fav = main_icon.resize((48, 48), Image.LANCZOS)
    fav.save(os.path.join(OUT_DIR, "favicon.png"))

    print("Icons saved to", OUT_DIR)


if __name__ == "__main__":
    main()
