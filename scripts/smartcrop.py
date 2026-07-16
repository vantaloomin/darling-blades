#!/usr/bin/env python3
"""Subject-aware cover crop for Darling Blades card art.

Character mode uses dghs-imgutils detection when available and places the
detected head/face focal point 40% down the 4:5 deliverable. Environment mode
and the character center fallback intentionally preserve the old Pillow center
cover-crop byte-for-byte.
"""

from __future__ import annotations

import contextlib
import json
import math
import sys
import tempfile
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image

FOCAL_FRAC = 0.40
MIN_DET_FRAC = 0.06
# Keep the subject's head-top at or below this fraction of the crop when the
# raw allows it: CardView's visible band starts at 20.9% of the deliverable,
# so 0.25 leaves ~4% of visible margin between the window edge and the head.
# Raws whose subject sits higher than this can offer at best a crop at the
# image ceiling (top=0) — those keep max headroom and the crown clips at the
# window edge (accepted 2026-07-09, user-directed: no synthesized padding).
HEADROOM_FRAC = 0.25
# Zoom fallback (2026-07-16, for full-body/wide raws that predate the waist-up
# preamble): when the ceiling-clamped full-width crop would leave the detected
# focal ABOVE this fraction, the face sits at or above CardView's visible band
# (window edge 20.9%) — i.e. hidden, the Frost-Jotun class. Instead of shipping
# a hidden face, shrink the crop window (zoom in) until the focal reaches
# FOCAL_FRAC. Mild ceiling grazes (focal between 0.28 and 0.40) keep the
# accepted crown-clip behavior unchanged, so previously-approved crops do not
# drift. Quality bound: never zoom past MAX_UPSCALE (deliverables display at
# <=282px wide, so a 2x upscale of the source crop still downsamples on card).
ZOOM_TRIGGER_FRAC = 0.28
MAX_UPSCALE = 2.0

RESAMPLE_LANCZOS = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS


@dataclass(frozen=True)
class CropBox:
    left: int
    top: int
    width: int
    height: int


@dataclass(frozen=True)
class Detection:
    source: str
    bbox: tuple[float, float, float, float]  # x0, y0, x1, y1
    score: float


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, value))


def cover_crop_size(src_w: int, src_h: int, out_w: int, out_h: int) -> tuple[int, int]:
    scale = max(out_w / src_w, out_h / src_h)
    crop_w = min(src_w, round(out_w / scale))
    crop_h = min(src_h, round(out_h / scale))
    return crop_w, crop_h


def center_crop_box(src_w: int, src_h: int, out_w: int, out_h: int) -> CropBox:
    crop_w, crop_h = cover_crop_size(src_w, src_h, out_w, out_h)
    return CropBox((src_w - crop_w) // 2, (src_h - crop_h) // 2, crop_w, crop_h)


def focal_crop_box(
    src_w: int,
    src_h: int,
    out_w: int,
    out_h: int,
    focal_x: float,
    focal_y: float,
    subject_top: float | None = None,
    focal_frac: float = FOCAL_FRAC,
) -> CropBox:
    crop_w, crop_h = cover_crop_size(src_w, src_h, out_w, out_h)
    left = clamp(round(focal_x - crop_w / 2), 0, src_w - crop_w)
    top = round(focal_y - focal_frac * crop_h)
    if subject_top is not None:
        top = min(top, round(subject_top - HEADROOM_FRAC * crop_h))
    top = clamp(top, 0, src_h - crop_h)
    # Zoom fallback: only for detected subjects (subject_top present) whose
    # face would land hidden above the visible band at the image ceiling.
    # A per-card `focal_frac` below the default zooms LESS (art-review tool:
    # a lower target shows more body while the face stays inside the window).
    if subject_top is not None and top == 0 and focal_y / crop_h < ZOOM_TRIGGER_FRAC:
        min_crop_h = math.ceil(out_h / MAX_UPSCALE)
        zoom_h = clamp(round(focal_y / focal_frac), min_crop_h, crop_h)
        zoom_w = min(src_w, round(zoom_h * out_w / out_h))
        ztop = round(focal_y - focal_frac * zoom_h)
        ztop = min(ztop, round(subject_top - HEADROOM_FRAC * zoom_h))
        ztop = clamp(ztop, 0, src_h - zoom_h)
        zleft = clamp(round(focal_x - zoom_w / 2), 0, src_w - zoom_w)
        return CropBox(zleft, ztop, zoom_w, zoom_h)
    return CropBox(left, top, crop_w, crop_h)


def save_crop(im: Image.Image, dst: Path, crop: CropBox, out_w: int, out_h: int) -> None:
    im.crop((crop.left, crop.top, crop.left + crop.width, crop.top + crop.height)).resize(
        (out_w, out_h),
        RESAMPLE_LANCZOS,
    ).save(dst, "PNG")


def bbox_to_json(bbox: tuple[float, float, float, float] | None) -> list[int] | None:
    if bbox is None:
        return None
    x0, y0, x1, y1 = bbox
    return [round(x0), round(y0), round(x1 - x0), round(y1 - y0)]


def is_number(value: Any) -> bool:
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(float(value))


def coerce_bbox(value: Any, img_w: int, img_h: int) -> tuple[float, float, float, float] | None:
    if isinstance(value, dict):
        for key in ("bbox", "box", "rect", "rectangle", "position"):
            if key in value:
                found = coerce_bbox(value[key], img_w, img_h)
                if found is not None:
                    return found
        if all(k in value for k in ("x", "y", "w", "h")):
            x0 = float(value["x"])
            y0 = float(value["y"])
            x1 = x0 + float(value["w"])
            y1 = y0 + float(value["h"])
            return clamp_bbox(x0, y0, x1, y1, img_w, img_h)
        for keys in (("left", "top", "right", "bottom"), ("xmin", "ymin", "xmax", "ymax"), ("x0", "y0", "x1", "y1")):
            if all(k in value for k in keys):
                x0, y0, x1, y1 = (float(value[k]) for k in keys)
                return clamp_bbox(x0, y0, x1, y1, img_w, img_h)
        return None

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        if len(value) >= 4 and all(is_number(v) for v in value[:4]):
            x0 = float(value[0])
            y0 = float(value[1])
            a = float(value[2])
            b = float(value[3])
            if a > x0 and b > y0:
                return clamp_bbox(x0, y0, a, b, img_w, img_h)
            return clamp_bbox(x0, y0, x0 + a, y0 + b, img_w, img_h)
        for part in value:
            found = coerce_bbox(part, img_w, img_h)
            if found is not None:
                return found

    return None


def clamp_bbox(
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    img_w: int,
    img_h: int,
) -> tuple[float, float, float, float] | None:
    left = max(0.0, min(float(img_w), x0))
    top = max(0.0, min(float(img_h), y0))
    right = max(0.0, min(float(img_w), x1))
    bottom = max(0.0, min(float(img_h), y1))
    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom


def extract_score(value: Any) -> float:
    if isinstance(value, dict):
        for key in ("score", "confidence", "conf", "prob", "probability"):
            raw = value.get(key)
            if is_number(raw):
                return float(raw)
        for nested in value.values():
            score = extract_score(nested)
            if score != 1.0:
                return score
        return 1.0

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        for part in reversed(value):
            if is_number(part) and 0.0 <= float(part) <= 1.0:
                return float(part)
            score = extract_score(part)
            if score != 1.0:
                return score
    return 1.0


def normalize_detections(raw: Any, source: str, img_w: int, img_h: int) -> list[Detection]:
    if raw is None:
        return []
    items: Iterable[Any]
    if isinstance(raw, dict):
        for key in ("detections", "boxes", "results"):
            if key in raw and isinstance(raw[key], Iterable):
                items = raw[key]
                break
        else:
            items = [raw]
    else:
        items = raw if isinstance(raw, Iterable) and not isinstance(raw, (str, bytes, bytearray)) else [raw]

    detections: list[Detection] = []
    for item in items:
        bbox = coerce_bbox(item, img_w, img_h)
        if bbox is None:
            continue
        detections.append(Detection(source, bbox, extract_score(item)))
    return detections


def best_detection(detections: list[Detection], img_w: int, img_h: int) -> Detection | None:
    min_side = MIN_DET_FRAC * min(img_w, img_h)
    best: tuple[float, Detection] | None = None
    for det in detections:
        x0, y0, x1, y1 = det.bbox
        width = x1 - x0
        height = y1 - y0
        if min(width, height) < min_side:
            continue
        area = width * height
        center_x = (x0 + x1) / 2
        horizontal_centrality = max(0.0, 1.0 - abs(center_x - img_w / 2) / (img_w / 2))
        rank = det.score * area * horizontal_centrality
        if best is None or rank > best[0]:
            best = (rank, det)
    return best[1] if best is not None else None


def call_detector(func: Callable[[Any], Any], src: Path, im: Image.Image) -> Any:
    last_type_error: TypeError | None = None
    for arg in (str(src), im):
        try:
            return func(arg)
        except TypeError as exc:
            last_type_error = exc
    if last_type_error is not None:
        raise last_type_error
    return []


def detect_subject(src: Path, im: Image.Image) -> Detection | None:
    try:
        with contextlib.redirect_stdout(sys.stderr):
            import imgutils.detect as detect_module  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover - exercised in integration envs.
        raise RuntimeError(
            "dghs-imgutils is required for character smart crop; "
            "run `python -m pip install dghs-imgutils`"
        ) from exc

    detector_groups = [
        ("head", ("detect_heads", "detect_head")),
        ("face", ("detect_faces", "detect_face")),
        ("person", ("detect_person", "detect_persons")),
    ]
    for source, names in detector_groups:
        for name in names:
            func = getattr(detect_module, name, None)
            if not callable(func):
                continue
            with contextlib.redirect_stdout(sys.stderr):
                raw = call_detector(func, src, im)
            chosen = best_detection(normalize_detections(raw, source, im.width, im.height), im.width, im.height)
            if chosen is not None:
                return chosen
    return None


def focal_from_detection(det: Detection) -> tuple[float, float]:
    x0, y0, x1, y1 = det.bbox
    width = x1 - x0
    height = y1 - y0
    focal_x = x0 + width / 2
    if det.source == "head":
        focal_y = y0 + 0.55 * height
    elif det.source == "person":
        focal_y = y0 + 0.18 * height
    else:
        focal_y = y0 + height / 2
    return focal_x, focal_y


def crop_image(
    src: Path,
    dst: Path,
    out_w: int,
    out_h: int,
    mode: str,
    band_frac: float | None = None,
    focal_frac: float = FOCAL_FRAC,
) -> dict[str, Any]:
    if out_w <= 0 or out_h <= 0:
        raise ValueError("target width and height must be positive")
    if mode not in {"character", "environment"}:
        raise ValueError("mode must be character or environment")

    with Image.open(src) as opened:
        im = opened.convert("RGB")

    det: Detection | None = None
    if mode == "character":
        det = detect_subject(src, im)

    if det is None:
        source = "center"
        crop = center_crop_box(im.width, im.height, out_w, out_h)
        # Per-card vertical band override (art-review tool, 2026-07-16): slide
        # the environment/center band toward the top (0.0) or bottom (1.0)
        # when the card's key content sits outside the default centered band.
        # None (the default) keeps the historical center crop byte-identical.
        if band_frac is not None:
            slack = im.height - crop.height
            crop = CropBox(crop.left, clamp(round(slack * band_frac), 0, max(0, slack)), crop.width, crop.height)
    else:
        source = det.source
        focal_x, focal_y = focal_from_detection(det)
        crop = focal_crop_box(
            im.width, im.height, out_w, out_h, focal_x, focal_y, det.bbox[1], focal_frac
        )

    save_crop(im, dst, crop, out_w, out_h)
    return {
        "source": source,
        "bbox": bbox_to_json(det.bbox if det else None),
        "crop": [crop.left, crop.top, crop.width, crop.height],
        "W": out_w,
        "H": out_h,
    }


def assert_equal(actual: Any, expected: Any, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def run_self_test() -> None:
    # 1024x1536 -> 640x800 has a 1024x1280 cover crop box.
    assert_equal(focal_crop_box(1024, 1536, 640, 800, 512, 250), CropBox(0, 0, 1024, 1280), "top clamp")
    assert_equal(focal_crop_box(1024, 1536, 640, 800, 512, 1300), CropBox(0, 256, 1024, 1280), "bottom clamp")
    assert_equal(focal_crop_box(1024, 1536, 640, 800, 512, 768), CropBox(0, 256, 1024, 1280), "focal line")
    # Headroom rule: subject_top must sit >= HEADROOM_FRAC into the crop when
    # the raw allows it; the crop slides up (top shrinks) to honor it.
    # focal top would be 700-512=188; headroom demands 500-320=180.
    assert_equal(
        focal_crop_box(1024, 1536, 640, 800, 512, 700, 500), CropBox(0, 180, 1024, 1280), "headroom slide-up"
    )
    # Subject higher than the raw can absorb: clamps to the ceiling (top=0).
    assert_equal(
        focal_crop_box(1024, 1536, 640, 800, 512, 400, 54), CropBox(0, 0, 1024, 1280), "headroom ceiling"
    )
    # A generous raw: headroom already satisfied, focal placement wins.
    assert_equal(
        focal_crop_box(1024, 1536, 640, 800, 512, 768, 700), CropBox(0, 256, 1024, 1280), "headroom inactive"
    )
    assert_equal(center_crop_box(1024, 1536, 640, 800), CropBox(0, 128, 1024, 1280), "center fallback")
    # Zoom fallback: focal 170/1280 = 0.13 would hide the face above the
    # window band — zoom in until the focal reaches 0.40 (crop_h 170/0.4=425).
    assert_equal(
        focal_crop_box(1024, 1536, 640, 800, 539, 170, 42), CropBox(369, 0, 340, 425), "zoom rescue"
    )
    # Zoom quality floor: focal 100 wants crop_h 250, clamped to out_h/2=400
    # (max 2x upscale); the face lands at the best achievable 0.25.
    assert_equal(
        focal_crop_box(1024, 1536, 640, 800, 512, 100, 30), CropBox(352, 0, 320, 400), "zoom quality floor"
    )
    # Mild ceiling graze (focal 400/1280 = 0.31 >= 0.28): no zoom — the
    # accepted crown-clip behavior is unchanged (same box as headroom ceiling).
    assert_equal(
        focal_crop_box(1024, 1536, 640, 800, 512, 400, 54), CropBox(0, 0, 1024, 1280), "zoom not triggered"
    )
    # No detection metadata (subject_top None): zoom never fires even for a
    # very high focal — the pre-zoom behavior is preserved byte-for-byte.
    assert_equal(
        focal_crop_box(1024, 1536, 640, 800, 512, 250), CropBox(0, 0, 1024, 1280), "zoom needs subject_top"
    )

    with tempfile.TemporaryDirectory() as td:
        base = Path(td)
        src = base / "src.png"
        smart = base / "smart.png"
        expected = base / "expected.png"
        im = Image.new("RGB", (73, 113))
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                px[x, y] = ((x * 3) % 256, (y * 5) % 256, (x + y) % 256)
        im.save(src, "PNG")

        result = crop_image(src, smart, 64, 80, "environment")
        with Image.open(src) as opened:
            expected_im = opened.convert("RGB")
        crop = center_crop_box(expected_im.width, expected_im.height, 64, 80)
        save_crop(expected_im, expected, crop, 64, 80)
        assert_equal(smart.read_bytes(), expected.read_bytes(), "environment bytes")
        assert_equal(result["source"], "center", "environment source")
        assert_equal(result["bbox"], None, "environment bbox")


def main(argv: list[str]) -> int:
    if argv == ["--self-test"]:
        run_self_test()
        print("smartcrop: self-test ok")
        return 0
    # Optional per-card overrides (art-review tool): --band-frac F slides the
    # environment band (0 top … 1 bottom); --focal-frac F retargets the
    # character focal line (a lower value zooms less / shows more body).
    band_frac: float | None = None
    focal_frac = FOCAL_FRAC
    positional: list[str] = []
    i = 0
    while i < len(argv):
        if argv[i] == "--band-frac" and i + 1 < len(argv):
            band_frac = float(argv[i + 1])
            i += 2
        elif argv[i] == "--focal-frac" and i + 1 < len(argv):
            focal_frac = float(argv[i + 1])
            i += 2
        else:
            positional.append(argv[i])
            i += 1
    if len(positional) != 5:
        print(
            "usage: python scripts/smartcrop.py <src> <dst> <W> <H> <character|environment>"
            " [--band-frac F] [--focal-frac F]",
            file=sys.stderr,
        )
        print("       python scripts/smartcrop.py --self-test", file=sys.stderr)
        return 2
    src = Path(positional[0])
    dst = Path(positional[1])
    try:
        result = crop_image(src, dst, int(positional[2]), int(positional[3]), positional[4], band_frac, focal_frac)
    except Exception as exc:
        print(f"smartcrop: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
