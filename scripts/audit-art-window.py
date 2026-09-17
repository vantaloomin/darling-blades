#!/usr/bin/env python3
"""Audit shipped card art against the card frame's art window.

For every shipped 640x800 deliverable this loads the head and face detectors
ONCE, finds a head or a face, and asks one question: is it inside the window
the card frame actually shows (rows 20.9% to 79.1%, see smartcrop.py)?

It reads the shipped files themselves, not a model of how they were cropped,
so hand re-crops count as what they are and sets whose raws are gone are
covered too. It writes nothing to shipped art. Each flagged row says whether a
retained raw exists (a re-crop is possible) and the zoom a subject-aware
re-crop of that raw would need: under about 1.8x is a cheap re-crop, above it
the head sits at the raw's top edge and the card wants a regeneration.

The detector is trained on anime heads and fires on some non-human subjects
(measured 2026-09-17: a plush rabbit, a row of slimes, a lizard). Treat every
row as a candidate for a human look, never as a verdict, and never bulk-apply
re-crops from this list.

Usage:
  python scripts/audit-art-window.py [--prefix dd-] [--ids a,b,c] [--json <path>]
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from PIL import Image

import smartcrop as sc

OUT_W, OUT_H = 640, 800
ROOT = Path(__file__).resolve().parent.parent
SHIPPED = ROOT / "public" / "assets" / "art" / "cards"
RAW_DIRS = ("gen-card-art", "gen-spell-art", "gen-land-art")


def find_raw(card_id: str) -> Path | None:
    for name in RAW_DIRS:
        raw = Path(tempfile.gettempdir()) / name / f"{card_id}.raw.png"
        if raw.exists():
            return raw
    return None


def recrop_zoom(raw: Path) -> float | None:
    with Image.open(raw) as opened:
        im = opened.convert("RGB")
    det = sc.detect_subject(raw, im, allow_person=False)
    if det is None:
        return None
    focal_x, focal_y = sc.focal_from_detection(det)
    fixed = sc.focal_crop_box(
        im.width, im.height, OUT_W, OUT_H, focal_x, focal_y, det.bbox[1], sc.SUBJECT_FOCAL_FRAC
    )
    full_w, _ = sc.cover_crop_size(im.width, im.height, OUT_W, OUT_H)
    return round(full_w / fixed.width, 2)


def main(argv: list[str]) -> int:
    prefix, ids, json_path = "", None, None
    i = 0
    while i < len(argv):
        if argv[i] == "--prefix" and i + 1 < len(argv):
            prefix = argv[i + 1]
            i += 2
        elif argv[i] == "--ids" and i + 1 < len(argv):
            ids = {part.strip() for part in argv[i + 1].split(",") if part.strip()}
            i += 2
        elif argv[i] == "--json" and i + 1 < len(argv):
            json_path = Path(argv[i + 1])
            i += 2
        else:
            print(__doc__, file=sys.stderr)
            return 2
    files = sorted(p for p in SHIPPED.glob(f"{prefix}*.webp") if ids is None or p.stem in ids)
    rows: list[dict[str, object]] = []
    for index, path in enumerate(files, 1):
        with Image.open(path) as opened:
            im = opened.convert("RGB")
        det = sc.detect_subject(path, im, allow_person=False)
        if det is None:
            continue
        seen = sc.subject_window(det, sc.CropBox(0, 0, im.width, im.height))
        if seen is None:
            continue
        rows.append({"id": path.stem, "source": det.source, **seen})
        print(f"[{index}/{len(files)}] {path.stem} focal={seen['focal']}", file=sys.stderr)

    hidden = [r for r in rows if not r["focal_visible"]]
    clipped = [r for r in rows if r["focal_visible"] and not r["fully_visible"]]
    print(
        f"audit-art-window: {len(files)} shipped files, {len(rows)} with a head or face, "
        f"{len(hidden)} face outside the window, {len(clipped)} head clipped at a window edge"
    )
    for r in hidden:
        raw = find_raw(str(r["id"]))
        zoom = recrop_zoom(raw) if raw else None
        r["raw"] = raw is not None
        r["recrop_zoom"] = zoom
        if raw is None:
            fix = "no raw kept: regeneration only"
        elif zoom is None:
            fix = "raw kept, no head found in it"
        else:
            fix = f"re-crop at {zoom}x" if zoom < 1.8 else f"regen candidate (re-crop needs {zoom}x)"
        print(f"  FACE HIDDEN  {str(r['id']):40s} focal {r['focal']}  {fix}")
    for r in clipped:
        print(f"  HEAD CLIPPED {str(r['id']):40s} top {r['top']} bottom {r['bottom']}")
    if json_path is not None:
        json_path.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
