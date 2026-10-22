"""Deterministic export of the four Product Tsuppari pose textures (ACTION-07D; User-accepted SEPARATE strategy).

Two authored red Tsuppari poses (tsuppari_recipe.json `masters`) are the only sources:
  red master  -> ART-WRESTLER-03A normalization (source identity check, one whole-sprite rotation so
                 FRONT = +X, explicit root, body core scaled to 2R, exact /4 downscale)
  blue        -> local-Y reflection ((x, y) -> (x, H - y): swaps the wrestler's hand, FRONT kept)
                 + the accepted mawashi-only recolor (runtime_wrestler_recipe.json, single owner)
Fixed mapping (OUTPUTS): red L / R = the authored poses; blue L = reflected red R; blue R = reflected red L.
The four files under public/assets/action/wrestler/tsuppari/ are only ever written by this script.

    PY tools/wrestler_art/export_tsuppari.py            # write the Product Tsuppari textures
    PY tools/wrestler_art/export_tsuppari.py --check    # verify the committed files, write nothing
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
from typing import Dict, List, Optional, Set, Tuple

from PIL import Image

import assemble_wrestler as aw
import export_runtime_wrestlers as ex
import preview_dual_rigid_wrestlers as pd
import preview_idle_mirror_workflow as im
import preview_single_wrestler as ps
from assemble_wrestler import AssemblyError, Part

DEFAULT_RECIPE = aw.TOOL_DIR / "tsuppari_recipe.json"
DEFAULT_TSUPPARI_DIR = ex.DEFAULT_RUNTIME_DIR / "tsuppari"
COLORS = ("red", "blue")
HANDS = ("left", "right")
VARIANTS = tuple(f"{color}_{hand}" for color in COLORS for hand in HANDS)
MASTERS = ("red_left", "red_right")
REFERENCES = ("blue_left", "blue_right")
OPPOSITE = {"left": "right", "right": "left"}
# variant -> (red master, local-Y reflection). The reflection swaps the hand, so blue L comes from red R.
OUTPUTS: Dict[str, Tuple[str, bool]] = {
    "red_left": ("red_left", False),
    "red_right": ("red_right", False),
    "blue_left": ("red_right", True),
    "blue_right": ("red_left", True),
}
SPEC_FIELDS = ("hand", "file", "size", "pixel_sha256", "source_front_deg", "root_source_px", "body_core_source_px",
               "body_core_target_r")
OUTPUT_FILES = [f"{variant}.png" for variant in VARIANTS]


@dataclass
class TsuppariTexture:
    variant: str  # "<color>_<hand>": semantic hand of the wrestler in this texture
    master: str
    reflect: bool
    part: Part  # joints: core_a / core_b
    mask: Set[Tuple[int, int]]  # recolored mawashi pixels (blue only)

    @property
    def file(self) -> str:
        return f"{self.variant}.png"


# ---------------------------------------------------------------- recipe


def _check_spec(key: str, spec: dict) -> None:
    for field in SPEC_FIELDS:
        if field not in spec:
            raise AssemblyError(f"{key} is missing {field!r}")
    if spec["hand"] not in HANDS:
        raise AssemblyError(f"{key}: hand must be left or right")
    if not isinstance(spec["source_front_deg"], (int, float)):
        raise AssemblyError(f"{key}: source_front_deg must be a number")
    size = tuple(spec["size"])
    ps._point(spec["root_source_px"], f"{key}.root_source_px", size)
    core = spec["body_core_source_px"]
    if not (isinstance(core, list) and len(core) == 2):
        raise AssemblyError(f"{key}: body_core_source_px must be two points")
    a = ps._point(core[0], f"{key}.body_core_source_px[0]", size)
    b = ps._point(core[1], f"{key}.body_core_source_px[1]", size)
    if ps._dist(a, b) <= 0:
        raise AssemblyError(f"{key}: body-core reference length is 0")
    # same rule as the 03A sprites: the body core crosses the front axis
    line = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) - spec["source_front_deg"]
    off = abs(((line % 180.0) + 180.0) % 180.0 - 90.0)
    if off > pd.BODY_CORE_PERPENDICULAR_TOLERANCE_DEG:
        raise AssemblyError(f"{key}: body-core line is {off:.2f} deg off perpendicular to its front axis")
    if not (isinstance(spec["body_core_target_r"], (int, float)) and spec["body_core_target_r"] > 0):
        raise AssemblyError(f"{key}: body_core_target_r must be > 0")


def expected_hand(recipe: dict, master: str, reflect: bool) -> str:
    """Semantic hand after the optional local-Y reflection (the reflection swaps the wrestler's hand)."""
    hand = recipe["masters"][master]["hand"]
    return OPPOSITE[hand] if reflect else hand


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
    if sorted(recipe.get("masters", {})) != sorted(MASTERS):
        raise AssemblyError(f"masters must be exactly {list(MASTERS)}")
    if sorted(recipe.get("references", {})) != sorted(REFERENCES):
        raise AssemblyError(f"references must be exactly {list(REFERENCES)}")
    for group in ("masters", "references"):
        for key, spec in recipe[group].items():
            _check_spec(key, spec)
            if spec["hand"] != key.split("_")[1]:
                raise AssemblyError(f"{key}: hand {spec['hand']!r} does not match its key")
    for variant, (master, reflect) in OUTPUTS.items():
        if expected_hand(recipe, master, reflect) != variant.split("_")[1]:
            raise AssemblyError(f"{variant}: master {master} reflect={reflect} gives the "
                                f"{expected_hand(recipe, master, reflect)} hand")
    # the accepted red -> blue rule has exactly one owner: the idle runtime recipe
    runtime = ex.load_recipe(path.parent / recipe.get("runtime_recipe", ex.DEFAULT_RECIPE.name))
    recipe["recolor"] = runtime["derived"]["recolor"]
    limits = recipe.get("mask_limits", {})
    for field in ("min_mask_px", "max_missed_px", "max_fringe_px"):
        if not isinstance(limits.get(field), int):
            raise AssemblyError(f"mask_limits.{field} must be an integer")
    return recipe


# ---------------------------------------------------------------- build


def normalize_master(spec: dict, path: Path, label: str, alpha_threshold: int) -> Part:
    """Validated source -> 03A normalization at master scale (runtime x 4)."""
    source, _ = aw.load_source(path, spec, label)
    master, _ = ps.normalize_sprite(source, pd._sprite_recipe(spec, alpha_threshold))
    return master


def normalize(spec: dict, path: Path, label: str, alpha_threshold: int) -> Part:
    """normalize_master -> exact /4 runtime part."""
    runtime = aw.runtime_part(normalize_master(spec, path, label, alpha_threshold))
    ps._check_unclipped(runtime.image, f"{label} runtime")
    return runtime


def build_masters(recipe: dict, input_dir: Path) -> Dict[str, Part]:
    return {key: normalize(spec, input_dir / spec["file"], key, recipe["alpha_threshold"])
            for key, spec in sorted(recipe["masters"].items())}


def build_references(recipe: dict, input_dir: Path) -> Dict[str, Part]:
    """Authored blue candidates, normalized for preview reference sheets only (never runtime textures)."""
    return {key: normalize(spec, input_dir / spec["file"], key, recipe["alpha_threshold"])
            for key, spec in sorted(recipe["references"].items())}


def band_pixels(image: Image.Image, rule: dict) -> int:
    """Pixels in the source hue band with the mask floors (before the largest-component restriction)."""
    count = 0
    for r, g, b, a in image.getdata():
        if a <= 8:
            continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if im._hue_in_band(h * 360, rule["source_hue_deg"]) and s >= rule["min_saturation"] and v >= rule["min_value"]:
            count += 1
    return count


def mask_report(image: Image.Image, mask: Set[Tuple[int, int]], rule: dict) -> dict:
    return {
        "mask_px": len(mask),
        "missed_band_px": band_pixels(image, rule) - len(mask),
        "fringe_px": im.mask_fringe(image, mask, rule),
    }


def check_mask(label: str, report: dict, limits: dict) -> None:
    if report["mask_px"] < limits["min_mask_px"]:
        raise AssemblyError(f"{label}: mawashi mask has only {report['mask_px']} px")
    if report["missed_band_px"] > limits["max_missed_px"]:
        raise AssemblyError(f"{label}: mawashi mask misses {report['missed_band_px']} band px")
    if report["fringe_px"] > limits["max_fringe_px"]:
        raise AssemblyError(f"{label}: mawashi mask fringe {report['fringe_px']} px")


def derive_texture(recipe: dict, masters: Dict[str, Part], variant: str) -> TsuppariTexture:
    master, reflect = OUTPUTS[variant]
    part = masters[master]
    if reflect:
        part = aw.mirror_part(part)
    mask: Set[Tuple[int, int]] = set()
    if variant.startswith("blue_"):
        rule = recipe["recolor"]
        mask = im.mawashi_mask(part.image, rule)
        check_mask(variant, mask_report(part.image, mask, rule), recipe["mask_limits"])
        part = Part(im.recolor(part.image, mask, rule), part.pivot, dict(part.joints))
    return TsuppariTexture(variant, master, reflect, part, mask)


def build_textures(recipe: dict, input_dir: Path) -> List[TsuppariTexture]:
    masters = build_masters(recipe, input_dir)
    return [derive_texture(recipe, masters, variant) for variant in VARIANTS]


def describe(texture: TsuppariTexture, data: bytes) -> dict:
    part = texture.part
    core = (part.joints["core_a"], part.joints["core_b"])
    return {
        "file": texture.file,
        "variant": texture.variant,
        "source": f"{texture.master}{' reflected' if texture.reflect else ''}"
                  f"{' + mawashi recolor' if texture.variant.startswith('blue_') else ''}",
        "size": list(part.image.size),
        "pivot": ps._r6(part.pivot),
        "body_core_px": round(ps._dist(*core), 6),
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
    parser = argparse.ArgumentParser(description="Export (or --check) the four Product Tsuppari pose textures.")
    parser.add_argument("--recipe", type=Path, default=DEFAULT_RECIPE, help="Product Tsuppari recipe")
    parser.add_argument("--input-dir", type=Path, default=aw.DEFAULT_INPUT_DIR, help="directory with the red poses")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_TSUPPARI_DIR, help="Product Tsuppari asset directory")
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
