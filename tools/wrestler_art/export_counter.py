"""Deterministic export of the two Product Counter / hiki-sabaki textures (ACTION-08C; User-accepted pose).

One authored red Counter pose (counter_recipe.json `master`) is the only source:
  red   -> ART-WRESTLER-03A normalization (source identity check, one whole-sprite rotation so FRONT = +X,
           explicit root, body core scaled to 2R, exact /4 downscale)
  blue  -> local-Y reflection of the normalized red ((x, y) -> (x, H - y), FRONT kept)
           + the accepted mawashi-only recolor (runtime_wrestler_recipe.json, single owner)
Exactly red.png / blue.png under public/assets/action/wrestler/counter/; only ever written by this script.
(ACTION-08A / 08A1 / 08B ran this as a temporary `counter-gate` Visual Gate; ACTION-08C promoted it unchanged.)

    PY tools/wrestler_art/export_counter.py            # write the Product Counter textures
    PY tools/wrestler_art/export_counter.py --check    # verify the committed files, write nothing
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Set, Tuple

from PIL import Image

import assemble_wrestler as aw
import export_runtime_wrestlers as ex
import export_tsuppari as et
import preview_dual_rigid_wrestlers as pd
import preview_idle_mirror_workflow as im
import preview_single_wrestler as ps
from assemble_wrestler import AssemblyError, Part

DEFAULT_RECIPE = aw.TOOL_DIR / "counter_recipe.json"
DEFAULT_COUNTER_DIR = ex.DEFAULT_RUNTIME_DIR / "counter"
COLORS = ("red", "blue")
OUTPUT_FILES = [f"{color}.png" for color in COLORS]
SPEC_FIELDS = ("file", "size", "pixel_sha256", "source_front_deg", "root_source_px", "body_core_source_px",
               "body_core_target_r")


@dataclass
class CounterTexture:
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
        raise AssemblyError("the Counter master must be the red pose")
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
    limits = recipe.get("mask_limits", {})
    for field in ("min_mask_px", "max_missed_px", "max_fringe_px"):
        if not isinstance(limits.get(field), int):
            raise AssemblyError(f"mask_limits.{field} must be an integer")
    return recipe


def build_textures(recipe: dict, input_dir: Path) -> List[CounterTexture]:
    spec = recipe["master"]
    red = et.normalize(spec, input_dir / spec["file"], "counter red", recipe["alpha_threshold"])
    reflected = aw.mirror_part(red)
    rule = recipe["recolor"]
    mask = im.mawashi_mask(reflected.image, rule)
    et.check_mask("counter blue", et.mask_report(reflected.image, mask, rule), recipe["mask_limits"])
    blue = Part(im.recolor(reflected.image, mask, rule), reflected.pivot, dict(reflected.joints))
    return [CounterTexture("red", red, set()), CounterTexture("blue", blue, mask)]


def describe(texture: CounterTexture, data: bytes) -> dict:
    part = texture.part
    return {
        "file": texture.file,
        "source": "red counter" + (" reflected + mawashi recolor" if texture.color == "blue" else ""),
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
    parser = argparse.ArgumentParser(description="Export (or --check) the two Product Counter textures (ACTION-08C).")
    parser.add_argument("--recipe", type=Path, default=DEFAULT_RECIPE, help="Product Counter recipe")
    parser.add_argument("--input-dir", type=Path, default=aw.DEFAULT_INPUT_DIR, help="directory with the red Counter pose")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_COUNTER_DIR, help="Product Counter asset directory")
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
