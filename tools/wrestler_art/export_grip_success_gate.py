"""Deterministic export of the two temporary Grip success Visual Gate textures (ACTION-11D; not Product art yet).

One authored red Grip success pose (grip_success_gate_recipe.json `master`) is the only source:
  red   -> ART-WRESTLER-03A normalization (source identity check, one whole-sprite rotation so FRONT = +X,
           explicit root, body core scaled to 2R, exact /4 downscale)
           -> ACTION-11H skin-only tone match toward the accepted idle red runtime (recipe `skin_tone_match`)
  blue  -> local-Y reflection of the tone-matched red ((x, y) -> (x, H - y), FRONT kept)
           + the accepted mawashi-only recolor (runtime_wrestler_recipe.json, single owner)
Exactly red.png / blue.png under public/assets/action/wrestler/grip-success-gate/; only ever written by this script.

    PY tools/wrestler_art/export_grip_success_gate.py            # write the Grip success gate textures
    PY tools/wrestler_art/export_grip_success_gate.py --check    # verify the committed files, write nothing
"""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import json
import math
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Sequence, Set, Tuple

from PIL import Image

import assemble_wrestler as aw
import export_runtime_wrestlers as ex
import export_tsuppari as et
import preview_dual_rigid_wrestlers as pd
import preview_idle_mirror_workflow as im
import preview_single_wrestler as ps
from assemble_wrestler import AssemblyError, Part

DEFAULT_RECIPE = aw.TOOL_DIR / "grip_success_gate_recipe.json"
DEFAULT_GATE_DIR = ex.DEFAULT_RUNTIME_DIR / "grip-success-gate"
COLORS = ("red", "blue")
OUTPUT_FILES = [f"{color}.png" for color in COLORS]
SPEC_FIELDS = ("file", "size", "pixel_sha256", "source_front_deg", "root_source_px", "body_core_source_px",
               "body_core_target_r")


@dataclass
class GripSuccessTexture:
    color: str
    part: Part  # joints: core_a / core_b
    mask: Set[Tuple[int, int]]  # recolored mawashi pixels (blue only)

    @property
    def file(self) -> str:
        return f"{self.color}.png"


def load_recipe(path: Path) -> dict:
    if not path.is_file():
        raise AssemblyError(f"recipe not found: {path}")
    try:
        recipe = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise AssemblyError(f"recipe is not readable JSON: {path}: {exc}") from exc
    if recipe.get("recipe_schema") != 1:
        raise AssemblyError(f"unsupported recipe_schema {recipe.get('recipe_schema')!r}")
    if not isinstance(recipe.get("alpha_threshold"), int):
        raise AssemblyError("alpha_threshold must be an integer")
    spec = recipe.get("master", {})
    if spec.get("key") != "red":
        raise AssemblyError("the Grip success master must be the red pose")
    for field in SPEC_FIELDS:
        if field not in spec:
            raise AssemblyError(f"master is missing {field!r}")
    size = tuple(spec["size"])
    ps._point(spec["root_source_px"], "master.root_source_px", size)
    a = ps._point(spec["body_core_source_px"][0], "master.body_core_source_px[0]", size)
    b = ps._point(spec["body_core_source_px"][1], "master.body_core_source_px[1]", size)
    # same rule as the 03A sprites: the body core crosses the front axis
    line = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) - spec["source_front_deg"]
    off = abs(((line % 180.0) + 180.0) % 180.0 - 90.0)
    if off > pd.BODY_CORE_PERPENDICULAR_TOLERANCE_DEG:
        raise AssemblyError(f"master: body-core line is {off:.2f} deg off perpendicular to its front axis")
    # the accepted red -> blue rule has exactly one owner: the idle runtime recipe
    runtime = ex.load_recipe(path.parent / recipe.get("runtime_recipe", ex.DEFAULT_RECIPE.name))
    recipe["recolor"] = runtime["derived"]["recolor"]
    tone = recipe.get("skin_tone_match", {})
    for field in ("reference", "reference_pixel_sha256", "mask", "curve_points"):
        if field not in tone:
            raise AssemblyError(f"skin_tone_match is missing {field!r}")
    points = tone["curve_points"]
    if points[0] != [0.0, 0.0] or points[-1] != [1.0, 1.0]:
        raise AssemblyError("skin_tone_match.curve_points must run from (0, 0) to (1, 1)")
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if not (x1 > x0 and y1 > y0):
            raise AssemblyError("skin_tone_match.curve_points must be strictly increasing (monotonic curve)")
    limits = recipe.get("mask_limits", {})
    for field in ("min_mask_px", "max_missed_px", "max_fringe_px"):
        if not isinstance(limits.get(field), int):
            raise AssemblyError(f"mask_limits.{field} must be an integer")
    return recipe


def _linear(c: int) -> float:
    v = c / 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def _encode(v: float) -> int:
    v = min(1.0, max(0.0, v))
    return int(round((v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055) * 255))


def luminance(r: int, g: int, b: int) -> float:
    """Relative luminance of an sRGB pixel (linear light, Rec. 709 weights)."""
    return 0.2126 * _linear(r) + 0.7152 * _linear(g) + 0.0722 * _linear(b)


def skin_mask(image: Image.Image, recipe: dict) -> Set[Tuple[int, int]]:
    """Skin candidates: interior alpha, outside the accepted mawashi mask, in the skin hue band with floors."""
    spec = recipe["skin_tone_match"]["mask"]
    mawashi = im.mawashi_mask(image, recipe["recolor"])
    lo, hi = spec["hue_deg"]
    px = image.load()
    mask: Set[Tuple[int, int]] = set()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = px[x, y]
            if a < spec["min_alpha"] or (x, y) in mawashi:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v >= spec["min_value"] and s >= spec["min_saturation"] and lo <= h * 360 <= hi:
                mask.add((x, y))
    return mask


def tone_curve(points: Sequence[Sequence[float]], y: float) -> float:
    """Monotonic piecewise-linear curve through the recipe control points."""
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if y <= x1:
            return y0 + (y1 - y0) * (y - x0) / (x1 - x0)
    return points[-1][1]


def skin_quantiles(image: Image.Image, mask: Set[Tuple[int, int]], qs: Sequence[float] = (0.2, 0.5, 0.8)) -> List[float]:
    px = image.load()
    ys = sorted(luminance(*px[p][:3]) for p in mask)
    return [ys[int(q * (len(ys) - 1))] for q in qs]


def tone_match(image: Image.Image, mask: Set[Tuple[int, int]], points: Sequence[Sequence[float]]) -> Tuple[Image.Image, int]:
    """Skin-only tone match: linear RGB scaled by curve(Y) / Y (chromaticity kept); returns the image and the
    number of pixels that clipped at 1. Alpha and every pixel outside the mask are copied unchanged."""
    out = image.copy()
    px = out.load()
    clipped = 0
    for p in sorted(mask):
        r, g, b, a = px[p]
        y = luminance(r, g, b)
        k = tone_curve(points, y) / y if y > 0 else 1.0
        rgb = [_linear(c) * k for c in (r, g, b)]
        if max(rgb) > 1.0:
            clipped += 1
        px[p] = (_encode(rgb[0]), _encode(rgb[1]), _encode(rgb[2]), a)
    return out, clipped


def build_textures(recipe: dict, input_dir: Path) -> List[GripSuccessTexture]:
    spec = recipe["master"]
    normalized = et.normalize(spec, input_dir / spec["file"], "grip success red", recipe["alpha_threshold"])
    toned, _ = tone_match(normalized.image, skin_mask(normalized.image, recipe), recipe["skin_tone_match"]["curve_points"])
    red = Part(toned, normalized.pivot, dict(normalized.joints))
    reflected = aw.mirror_part(red)
    rule = recipe["recolor"]
    mask = im.mawashi_mask(reflected.image, rule)
    et.check_mask("grip success blue", et.mask_report(reflected.image, mask, rule), recipe["mask_limits"])
    blue = Part(im.recolor(reflected.image, mask, rule), reflected.pivot, dict(reflected.joints))
    return [GripSuccessTexture("red", red, set()), GripSuccessTexture("blue", blue, mask)]


def describe(texture: GripSuccessTexture, data: bytes) -> dict:
    part = texture.part
    return {
        "file": texture.file,
        "source": "red grip success" + (" reflected + mawashi recolor" if texture.color == "blue" else ""),
        "size": list(part.image.size),
        "pivot": ps._r6(part.pivot),
        "body_core_px": round(ps._dist(part.joints["core_a"], part.joints["core_b"]), 6),
        "pixel_sha256": aw.pixel_sha256(part.image),
        "file_sha256": hashlib.sha256(data).hexdigest(),
    }


def export(recipe: dict, input_dir: Path, out_dir: Path) -> List[dict]:
    textures = build_textures(recipe, input_dir)
    encoded = {t.file: ex.png_bytes(t.part.image) for t in textures}
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, data in encoded.items():  # write each file atomically
        handle, temp = tempfile.mkstemp(prefix=".staging-", dir=out_dir)
        with os.fdopen(handle, "wb") as out:
            out.write(data)
        os.replace(temp, out_dir / name)
    return [describe(t, encoded[t.file]) for t in textures]


def check(recipe: dict, input_dir: Path, out_dir: Path) -> List[dict]:
    """Fresh export compared with the committed files (decoded pixels, encoded bytes, no extra files)."""
    textures = build_textures(recipe, input_dir)
    present = sorted(p.name for p in out_dir.glob("*")) if out_dir.is_dir() else []
    if present != sorted(OUTPUT_FILES):
        raise AssemblyError(f"{out_dir}: files {present} != expected {sorted(OUTPUT_FILES)}")
    report = []
    for texture in textures:
        path = out_dir / texture.file
        with Image.open(path) as committed:
            committed.load()
            pixels = aw.pixel_sha256(committed.convert("RGBA"))
            size = committed.size
        fresh = describe(texture, ex.png_bytes(texture.part.image))
        if size != texture.part.image.size or pixels != fresh["pixel_sha256"]:
            raise AssemblyError(f"{path.name}: committed pixels differ from a fresh deterministic export")
        if hashlib.sha256(path.read_bytes()).hexdigest() != fresh["file_sha256"]:
            raise AssemblyError(f"{path.name}: committed PNG bytes differ from a fresh deterministic export")
        report.append(fresh)
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export (or --check) the two Grip success gate textures (ACTION-11D).")
    parser.add_argument("--recipe", type=Path, default=DEFAULT_RECIPE, help="Grip success gate recipe")
    parser.add_argument("--input-dir", type=Path, default=aw.DEFAULT_INPUT_DIR, help="directory with the red Grip success pose")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_GATE_DIR, help="Grip success gate asset directory")
    parser.add_argument("--check", action="store_true", help="verify committed files against a fresh export")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        recipe = load_recipe(args.recipe)
        report = (check if args.check else export)(recipe, args.input_dir, args.out_dir)
    except AssemblyError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for entry in report:
        print(f"{'ok' if args.check else 'wrote'} {entry['file']} ({entry['source']}): size "
              f"{entry['size'][0]}x{entry['size'][1]}, pivot ({entry['pivot'][0]:g}, {entry['pivot'][1]:g}), "
              f"body core {entry['body_core_px']:.4f} px, pixel sha256 {entry['pixel_sha256']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
