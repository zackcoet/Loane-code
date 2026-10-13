#!/usr/bin/env python3
"""
The Loane mark, and everything cut from it.

THE MARK IS TWO FILLED CIRCLES THAT OVERLAP IN BUTTER. A light ballet
circle with a ballet ring on the left, a cherry circle with a merlot
ring on the right, and the lens where they cross is butter. It replaced
the two hairline outline rings in October 2026.

ONE FILE HOLDS THE GEOMETRY. This script writes the SVG artwork *and*
every PNG from the same constants, so the vector and the app icon
cannot drift apart — which is exactly what happened to the old mark,
where the icon was redrawn at a different stroke weight than the logo
and the two stopped being the same drawing.

    brand/logo-flat.svg              the artwork, for anything vector
    public-pages/logo.svg            a copy, for the legal pages
    admin/public/logo.svg            a copy, served at /logo.svg
    mobile/assets/icon.png           iOS/app-store tile, cream, no alpha
    mobile/assets/splash-icon.png    the mark alone, transparent
    mobile/assets/android-icon-*.png adaptive icon layers
    mobile/assets/favicon.png        browser tab
    brand/preview-sizes.png          the icon at real home-screen sizes

The React Native component (mobile/src/components/Logo.tsx) draws the
same mark with the same ratios, because a PNG cannot scale crisply
behind a header. The ratios are named identically in both files.

    pip install pillow
    python3 brand/generate-brand.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "mobile" / "assets"

# --- Colour. Every one of these is a token in shared/src/tokens.ts ---------
CREAM = "#F6EFE4"  # palette.cream
MERLOT = "#5E1A2E"  # palette.merlot        right ring
CHERRY = "#C8213F"  # palette.cherry        right fill
BUTTER = "#F7DC7A"  # palette.butter        the overlap
BALLET = "#EFAFC2"  # palette.ballet        left ring
BALLET_SOFT = "#FBE4EC"  # palette.balletSoft    left fill

# --- Geometry, as fractions of ONE CIRCLE'S DIAMETER ----------------------
# Carried over from the outline mark, where the overlap was tuned against
# Ella's reference and the ring weight against the letterforms.
OVERLAP = 0.38
RING = 0.045

# How much of the icon tile the whole mark spans, corner to corner of its
# own bounding box. 0.747 is what the old icon used, measured off the
# brand deck's own tile, and it still looks right on a home screen.
MARK_ON_TILE = 0.747

# The ring on the TILE is drawn slightly heavier than in the logo. At
# 29pt a 4.5% ring is half a pixel and disappears; the fills carry the
# mark at that size, and this keeps a trace of the ring with them.
RING_ON_TILE = 0.055

# PIL's ellipse has no antialiasing. Drawn at 4x and scaled down, or the
# circles look cheap beside every other icon on the screen.
SUPERSAMPLE = 4

# Android crops an adaptive icon to a circle and animates it, so the
# foreground has to survive inside the middle ~66%.
ANDROID_SCALE = 0.62


def rgb(hex_colour: str) -> tuple[int, int, int]:
    h = hex_colour.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def layout(diameter: float) -> dict[str, float]:
    """Everything positional, derived from one circle's diameter."""
    separation = diameter * (1 - OVERLAP)
    return {
        "diameter": diameter,
        "radius": diameter / 2,
        "separation": separation,
        # The bounding box of the pair.
        "width": diameter + separation,
        "height": diameter,
    }


# ---------------------------------------------------------------------------
# The SVG
# ---------------------------------------------------------------------------


def svg() -> str:
    """The artwork. Radius 100, so every number reads as a percentage."""
    box = layout(200.0)
    ring = 200 * RING
    pad = ring / 2  # The stroke is centred on the path; give it room.
    left_cx = pad + box["radius"]
    right_cx = left_cx + box["separation"]
    cy = pad + box["radius"]
    width = box["width"] + ring
    height = box["height"] + ring

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!--
  The Loane mark. GENERATED — edit brand/generate-brand.py, not this file.

  Two filled circles overlapping in butter. The lens is the right
  circle, clipped to the left one, which is the only way to paint a true
  intersection rather than an eyeballed leaf shape.

  Both rings are drawn LAST, so each circle reads as a whole circle
  crossing the other. Painting the cherry circle over the ballet ring
  instead would make the left one look cut off.

  Colours are brand tokens: ballet / balletSoft / cherry / merlot /
  butter. See shared/src/tokens.ts.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}"
     width="{width:g}" height="{height:g}" role="img" aria-label="Loane">
  <title>Loane</title>
  <defs>
    <clipPath id="loane-left">
      <circle cx="{left_cx:g}" cy="{cy:g}" r="{box['radius']:g}"/>
    </clipPath>
  </defs>

  <circle cx="{left_cx:g}" cy="{cy:g}" r="{box['radius']:g}" fill="{BALLET_SOFT}"/>
  <circle cx="{right_cx:g}" cy="{cy:g}" r="{box['radius']:g}" fill="{CHERRY}"/>

  <g clip-path="url(#loane-left)">
    <circle cx="{right_cx:g}" cy="{cy:g}" r="{box['radius']:g}" fill="{BUTTER}"/>
  </g>

  <circle cx="{left_cx:g}" cy="{cy:g}" r="{box['radius']:g}"
          fill="none" stroke="{BALLET}" stroke-width="{ring:g}"/>
  <circle cx="{right_cx:g}" cy="{cy:g}" r="{box['radius']:g}"
          fill="none" stroke="{MERLOT}" stroke-width="{ring:g}"/>
</svg>
"""


# ---------------------------------------------------------------------------
# The PNGs
# ---------------------------------------------------------------------------


def mark(size: int, *, scale: float = 1.0, background: str | None = None,
         ink: str | None = None) -> Image.Image:
    """
    The mark centred on a square of `size`.

    `background` fills the tile; without it the tile is transparent.
    `ink` flattens the whole mark to one colour, for Android's
    monochrome layer, where the system tints the shape anyway.
    """
    big = size * SUPERSAMPLE
    mode = "RGB" if background else "RGBA"
    canvas = Image.new(mode, (big, big), rgb(background) if background else (0, 0, 0, 0))

    span = MARK_ON_TILE * big * scale
    # span is the pair's WIDTH; work back to one circle's diameter.
    box = layout(span / (2 - OVERLAP))
    ring = max(1, round(RING_ON_TILE * box["diameter"]))

    left = ((big - box["width"]) / 2, (big - box["height"]) / 2)
    right = (left[0] + box["separation"], left[1])

    def disc(xy: tuple[float, float]) -> list[float]:
        return [xy[0], xy[1], xy[0] + box["diameter"], xy[1] + box["diameter"]]

    fills = (BALLET_SOFT, CHERRY) if ink is None else (ink, ink)
    rings = (BALLET, MERLOT) if ink is None else (ink, ink)

    draw = ImageDraw.Draw(canvas)
    draw.ellipse(disc(left), fill=rgb(fills[0]))
    draw.ellipse(disc(right), fill=rgb(fills[1]))

    if ink is None:
        # The lens is the INTERSECTION of the two circles, so it is drawn
        # as a mask of one ANDed with a mask of the other. Eyeballing a
        # leaf shape instead never quite sits on both edges.
        masks = []
        for xy in (left, right):
            m = Image.new("L", (big, big), 0)
            ImageDraw.Draw(m).ellipse(disc(xy), fill=255)
            masks.append(m)
        canvas.paste(rgb(BUTTER), (0, 0), ImageChops.multiply(*masks))

    draw.ellipse(disc(left), outline=rgb(rings[0]), width=ring)
    draw.ellipse(disc(right), outline=rgb(rings[1]), width=ring)

    return canvas.resize((size, size), Image.LANCZOS)


def write(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    rel = path.relative_to(ROOT)
    print(f"  {str(rel):40} {image.size[0]}x{image.size[1]}  {path.stat().st_size // 1024}KB")


def preview_sizes() -> Image.Image:
    """
    The tile at the sizes iOS and Android actually draw it, on one
    strip, so "does the yellow still read?" is a question you can look
    at instead of argue about.
    """
    sizes = [180, 120, 87, 60, 40, 29]
    gap = 16
    width = sum(sizes) + gap * (len(sizes) + 1)
    strip = Image.new("RGB", (width, max(sizes) + gap * 2), (255, 255, 255))
    x = gap
    for s in sizes:
        strip.paste(mark(s, background=CREAM), (x, gap))
        x += s + gap
    return strip


def main() -> None:
    print("The Loane mark\n")

    svg_text = svg()
    # The two web copies are written rather than imported: neither the
    # legal pages nor Vite's public/ can reach a file outside their own
    # directory, and a copy that one command rewrites beats a copy
    # somebody has to remember.
    for path in (
        ROOT / "brand" / "logo-flat.svg",
        ROOT / "public-pages" / "logo.svg",
        ROOT / "admin" / "public" / "logo.svg",
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(svg_text, encoding="utf-8")
        print(f"  {str(path.relative_to(ROOT)):40} {len(svg_text)} bytes")

    # iOS wants one 1024 square with NO alpha channel — an icon with one
    # is rejected at submission. iOS rounds the corners itself, so the
    # cream goes corner to corner here rather than being pre-rounded.
    write(mark(1024, background=CREAM), ASSETS / "icon.png")

    # The splash shows the same mark on the same cream, so launching the
    # app looks like the thing you tapped. Transparent, because the
    # splash background colour is set in app.json.
    write(mark(1024), ASSETS / "splash-icon.png")

    write(mark(1024, scale=ANDROID_SCALE), ASSETS / "android-icon-foreground.png")
    write(Image.new("RGB", (1024, 1024), rgb(CREAM)), ASSETS / "android-icon-background.png")
    # Tinted by the system, so the shape is all that survives.
    write(mark(1024, scale=ANDROID_SCALE, ink=MERLOT), ASSETS / "android-icon-monochrome.png")

    write(mark(48, background=CREAM), ASSETS / "favicon.png")
    write(preview_sizes(), ROOT / "brand" / "preview-sizes.png")

    print("\nDone. App icons only change with a new native build.")


if __name__ == "__main__":
    main()
