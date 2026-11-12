#!/usr/bin/env python3
"""Generate original Freenotes app icons."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path("/workspace/freenotes/public")
ICONS = ROOT / "icons"
ICONS.mkdir(parents=True, exist_ok=True)

SAGE = (47, 93, 74, 255)
SAGE_DARK = (28, 64, 50, 255)
CREAM = (251, 248, 242, 255)
CREAM_SHADOW = (232, 222, 206, 255)
INK = (36, 31, 26, 255)
STROKE = (36, 31, 26, 255)


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_mark(img: Image.Image, cx: int, cy: int, size: int) -> None:
    """Draw a notebook + ink stroke, centered at (cx, cy) with given size."""
    draw = ImageDraw.Draw(img)
    w = size
    # notebook body
    nb_w, nb_h = int(w * 0.62), int(w * 0.78)
    left = cx - nb_w // 2
    top = cy - nb_h // 2 + int(w * 0.02)
    right = left + nb_w
    bottom = top + nb_h
    # slight back page
    draw.rounded_rectangle(
        [left + int(w * 0.05), top - int(w * 0.03), right + int(w * 0.05), bottom - int(w * 0.02)],
        radius=max(4, w // 18),
        fill=CREAM_SHADOW,
    )
    draw.rounded_rectangle(
        [left, top, right, bottom],
        radius=max(4, w // 18),
        fill=CREAM,
    )
    # spine
    spine_w = max(3, w // 22)
    draw.rectangle([left, top + 2, left + spine_w, bottom - 2], fill=SAGE_DARK)
    # ruled lines
    line_color = (90, 78, 64, 90)
    inset = spine_w + w // 16
    for i in range(4):
        y = top + int(nb_h * 0.32) + i * max(6, w // 16)
        if y < bottom - w // 12:
            draw.line([(left + inset, y), (right - w // 16, y)], fill=line_color, width=max(1, w // 90))
    # ink stroke (a simple handwritten-looking curve)
    pts = []
    steps = 40
    import math
    x0 = left + int(nb_w * 0.28)
    y0 = top + int(nb_h * 0.55)
    for i in range(steps + 1):
        t = i / steps
        x = x0 + int(nb_w * 0.52 * t)
        y = y0 + int(nb_h * 0.10 * math.sin(t * math.pi * 1.15)) - int(nb_h * 0.08 * t)
        pts.append((x, y))
    width = max(3, w // 20)
    draw.line(pts, fill=STROKE, width=width, joint="curve")
    # round caps
    r = width // 2
    for (x, y) in (pts[0], pts[-1]):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=STROKE)


def icon_any(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = 0
    radius = int(size * 0.22)
    draw.rounded_rectangle([pad, pad, size - 1 - pad, size - 1 - pad], radius=radius, fill=SAGE)
    draw_mark(img, size // 2, size // 2, int(size * 0.72))
    return img


def icon_maskable(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), SAGE)
    # keep artwork in 80% safe zone
    draw_mark(img, size // 2, size // 2, int(size * 0.56))
    return img


def icon_apple(size: int) -> Image.Image:
    # iOS adds its own rounding; use full-bleed sage
    img = Image.new("RGBA", (size, size), SAGE)
    draw_mark(img, size // 2, size // 2, int(size * 0.68))
    return img


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)


def main() -> None:
    save_png(icon_any(192), ICONS / "icon-192.png")
    save_png(icon_any(512), ICONS / "icon-512.png")
    save_png(icon_maskable(512), ICONS / "icon-maskable-512.png")
    save_png(icon_apple(180), ROOT / "apple-touch-icon.png")
    save_png(icon_any(32), ICONS / "favicon-32.png")
    # also a 16px
    save_png(icon_any(16).resize((16, 16), Image.Resampling.LANCZOS), ICONS / "favicon-16.png")
    print("icons written to", ICONS)


if __name__ == "__main__":
    main()
