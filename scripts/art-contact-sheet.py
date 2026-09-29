#!/usr/bin/env python3
"""Contact sheet for 640x800 card art with the card window drawn on every image.

Each tile holds one or more 640x800 images side by side (for example the
shipped crop and a staged re-crop), scaled down, with the lines a reviewer
reads against:

- dashed white: the card frame's art window, rows 17.3% to 82.7% (y 138 and
  662 of 800; src/config/cardFaceGeometry.ts, CARD_FACE.art 264x216);
- yellow: the head-top line, y 179 (art bible section 3, the headroom rule).

The detectors in smartcrop.py and audit-art-window.py see anime heads and
faces only, so anything else that rises above the head line (a tail tip, a
skull, a raised weapon, a wing) is found by eye on a sheet like this one
(art bible section 4d). It reads files and writes one PNG; it never touches
shipped art.

Usage:
  python scripts/art-contact-sheet.py --out sheet.png [--title T] [--cols N]
         [--thumb W] (--tiles tiles.json | image.webp ...)

tiles.json is a list of {"label": str, "images": [path, ...],
"captions": [str, ...]?, "note": str?}. Positional images get one tile each,
labelled with the file stem.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SRC_W, SRC_H = 640, 800
CARD_ART_W, CARD_ART_H = 264, 216
WINDOW_TOP = (1 - (CARD_ART_H / CARD_ART_W) * (SRC_W / SRC_H)) / 2
WINDOW_BOTTOM = 1 - WINDOW_TOP
HEAD_LINE = 179 / SRC_H
BG = (22, 20, 30)
FG = (236, 232, 223)
DIM = (170, 164, 150)


def font(size: int) -> ImageFont.ImageFont:
    for name in ("arial.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def dashed(draw: ImageDraw.ImageDraw, x0: int, x1: int, y: int, fill: tuple[int, int, int], dash: int = 8) -> None:
    x = x0
    while x < x1:
        draw.line([(x, y), (min(x + dash, x1), y)], fill=fill, width=2)
        x += dash * 2


def thumb(path: Path, w: int) -> Image.Image:
    h = round(w * SRC_H / SRC_W)
    with Image.open(path) as opened:
        im = opened.convert("RGB").resize((w, h), Image.Resampling.LANCZOS)
    d = ImageDraw.Draw(im)
    dashed(d, 0, w, round(WINDOW_TOP * h), (255, 255, 255))
    dashed(d, 0, w, round(WINDOW_BOTTOM * h), (255, 255, 255))
    d.line([(0, round(HEAD_LINE * h)), (w, round(HEAD_LINE * h))], fill=(250, 214, 60), width=2)
    return im


def load_tiles(argv_images: list[str], tiles_json: str | None) -> list[dict]:
    if tiles_json is not None:
        tiles = json.loads(Path(tiles_json).read_text(encoding="utf-8"))
        if not isinstance(tiles, list):
            raise SystemExit("art-contact-sheet: --tiles must hold a JSON list")
        return tiles
    return [{"label": Path(p).stem, "images": [p]} for p in argv_images]


def main(argv: list[str]) -> int:
    out: Path | None = None
    title = ""
    cols = 5
    tw = 200
    tiles_json: str | None = None
    images: list[str] = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("--out", "--title", "--cols", "--thumb", "--tiles") and i + 1 < len(argv):
            v = argv[i + 1]
            if a == "--out":
                out = Path(v)
            elif a == "--title":
                title = v
            elif a == "--cols":
                cols = max(1, int(v))
            elif a == "--thumb":
                tw = max(60, int(v))
            else:
                tiles_json = v
            i += 2
        elif a.startswith("--"):
            print(__doc__, file=sys.stderr)
            return 2
        else:
            images.append(a)
            i += 1
    if out is None:
        print(__doc__, file=sys.stderr)
        return 2
    tiles = load_tiles(images, tiles_json)
    if not tiles:
        print("art-contact-sheet: nothing to draw", file=sys.stderr)
        return 2

    th = round(tw * SRC_H / SRC_W)
    per = max(len(t["images"]) for t in tiles)
    gap, pad, label_h = 6, 16, 42
    tile_w = per * tw + (per - 1) * gap
    tile_h = th + 16 + label_h
    rows = (len(tiles) + cols - 1) // cols
    title_h = 40 if title else 0
    legend_h = 22
    sheet_w = pad * 2 + cols * tile_w + (cols - 1) * pad
    sheet_h = pad * 2 + title_h + legend_h + rows * tile_h + (rows - 1) * pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    d = ImageDraw.Draw(sheet)
    f_title, f_label, f_small = font(22), font(14), font(12)
    y = pad
    if title:
        d.text((pad, y), title, fill=FG, font=f_title)
        y += title_h
    d.text(
        (pad, y),
        "dashed white: the 216 px card window (y 138 to 662 of 800); yellow: the head-top line (y 179)",
        fill=DIM,
        font=f_small,
    )
    y += legend_h
    for n, tile in enumerate(tiles):
        r, c = divmod(n, cols)
        x0 = pad + c * (tile_w + pad)
        y0 = y + r * (tile_h + pad)
        captions = tile.get("captions") or []
        for k, path in enumerate(tile["images"]):
            xk = x0 + k * (tw + gap)
            try:
                sheet.paste(thumb(Path(path), tw), (xk, y0 + 16))
            except (OSError, FileNotFoundError):
                d.rectangle([xk, y0 + 16, xk + tw, y0 + 16 + th], outline=(200, 90, 90))
                d.text((xk + 6, y0 + 22), "missing", fill=(255, 150, 150), font=f_small)
            if k < len(captions):
                d.text((xk, y0), str(captions[k]), fill=DIM, font=f_small)
        d.text((x0, y0 + 16 + th + 4), str(tile.get("label", "")), fill=FG, font=f_label)
        if tile.get("note"):
            d.text((x0, y0 + 16 + th + 22), str(tile["note"]), fill=DIM, font=f_small)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, "PNG")
    print(f"art-contact-sheet: {len(tiles)} tile(s) -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
