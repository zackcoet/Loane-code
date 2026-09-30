#!/usr/bin/env python3
"""
Generate every app icon from the brand mark.

The geometry is measured off the app icon on page 2 of "Loane Brand
Strategy Visuals" — the brand's own icon, not a guess. As fractions of
the tile: circle diameter 0.509, centres 0.238 apart, ring stroke
0.0235.

THE STROKE IS THE WHOLE POINT. The logo lockup draws its rings as a
hairline, which is right on a page and disappears at 60pt on a home
screen. The deck already solved this by drawing the icon bolder than
the logo, and that is why this file redraws the rings rather than
scaling the logo file down.

No letters. LOANE at 60pt is four grey smudges; two rings are still
two rings.

Black rings on white. The brand deck draws the icon inverted, white on
black, and both read fine at size — this is Zack's call, and it sits
closer to the rest of the app, which is black on white throughout.

    pip install pillow
    python3 mobile/assets/brand/generate-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)

# Measured from the brand deck.
DIAMETER = 0.509
SEPARATION = 0.238
STROKE = 0.0235

# Drawn at 4x and scaled down: PIL's ellipse has no antialiasing, and a
# hard-edged circle looks cheap next to every other icon on the screen.
SUPERSAMPLE = 4


def rings(size: int, *, scale: float = 1.0, background=None, ink=BLACK):
    """The two overlapping rings, optionally on a solid background."""
    big = size * SUPERSAMPLE
    mode = "RGB" if background else "RGBA"
    fill = background if background else (0, 0, 0, 0)
    canvas = Image.new(mode, (big, big), fill)
    draw = ImageDraw.Draw(canvas)

    diameter = DIAMETER * big * scale
    separation = SEPARATION * big * scale
    stroke = max(1, round(STROKE * big * scale))
    cx = cy = big / 2

    for dx in (-separation / 2, separation / 2):
        x0 = cx + dx - diameter / 2
        y0 = cy - diameter / 2
        draw.ellipse([x0, y0, x0 + diameter, y0 + diameter], outline=ink, width=stroke)

    return canvas.resize((size, size), Image.LANCZOS)


def write(image: Image.Image, name: str) -> None:
    path = ASSETS / name
    image.save(path)
    print(f"  {name:32} {image.size[0]}x{image.size[1]}  {path.stat().st_size // 1024}KB")


def main() -> None:
    print("Writing icons from the brand mark\n")

    # iOS wants one 1024 square with NO transparency — an alpha channel
    # is rejected at submission.
    write(rings(1024, background=WHITE, ink=BLACK), "icon.png")

    # The splash shows the same mark on the same white, so launching the
    # app looks like the thing you tapped.
    write(rings(1024, ink=BLACK), "splash-icon.png")

    # Android crops an adaptive icon to a circle and animates it, so the
    # foreground has to stay inside the middle ~66%. Scaling the mark to
    # 0.62 keeps the rings whole through every mask shape.
    write(rings(1024, scale=0.62, ink=BLACK), "android-icon-foreground.png")
    write(Image.new("RGB", (1024, 1024), WHITE), "android-icon-background.png")
    write(rings(1024, scale=0.62, ink=BLACK), "android-icon-monochrome.png")

    # Browser tab, for the admin and any web build.
    write(rings(48, background=WHITE, ink=BLACK), "favicon.png")

    print("\nDone. App icons only change with a new native build.")


if __name__ == "__main__":
    main()
