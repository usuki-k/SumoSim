"""Deterministic export of the temporary Grip success hand marker Visual Gate textures (ACTION-11L; not Product art).

One User-authored forearm + fist illustration (grip_forearm_hand_gate_recipe.json `source`) is the only source:
  forearm_hand.png          -> exact source identity check, alpha > threshold content crop + transparent padding
                               (canvas rounded up to the downscale factor), exact integer premultiplied BOX downscale
  forearm_hand_mirrored.png -> that runtime image mirrored top-bottom (y -> H - y), for the opposite waist side
No recolor, tone match, redraw, sharpen or blur. The recorded elbow / hand anchors (source px) map to runtime px by
(p - crop origin) / downscale (mirrored: y -> H - y). Exactly these two files under
public/assets/action/wrestler/grip-symbol-authored-gate/; only ever written by this script.

    PY tools/wrestler_art/export_grip_forearm_hand_gate.py            # write the two gate textures
    PY tools/wrestler_art/export_grip_forearm_hand_gate.py --check    # verify the committed files, write nothing
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
from typing import Dict, List, Optional, Tuple

from PIL import Image

import assemble_wrestler as aw
import export_runtime_wrestlers as ex
from assemble_wrestler import AssemblyError

DEFAULT_RECIPE = aw.TOOL_DIR / "grip_forearm_hand_gate_recipe.json"
DEFAULT_GATE_DIR = ex.DEFAULT_RUNTIME_DIR / "grip-symbol-authored-gate"
OUTPUT_FILES = ["forearm_hand.png", "forearm_hand_mirrored.png"]
SOURCE_FIELDS = ("file", "size", "pixel_sha256", "alpha_threshold", "content_bbox_px", "anchors")

Point = Tuple[float, float]


@dataclass
class GateTexture:
    file: str
    image: Image.Image
    hand: Point  # runtime px
    elbow: Point


def load_recipe(path: Path) -> dict:
    if not path.is_file():
        raise AssemblyError(f"recipe not found: {path}")
    try:
        recipe = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise AssemblyError(f"recipe is not readable JSON: {path}: {exc}") from exc
    if recipe.get("recipe_schema") != 1:
        raise AssemblyError(f"unsupported recipe_schema {recipe.get('recipe_schema')!r}")
    source = recipe.get("source", {})
    for field in SOURCE_FIELDS:
        if field not in source:
            raise AssemblyError(f"source is missing {field!r}")
    width, height = source["size"]
    for name in ("hand_source_px", "elbow_source_px"):
        point = source["anchors"].get(name)
        if not (isinstance(point, list) and len(point) == 2 and 0 <= point[0] < width and 0 <= point[1] < height):
            raise AssemblyError(f"source.anchors.{name} must be a point inside the source")
    export = recipe.get("export", {})
    for field in ("padding_px", "downscale"):
        if not (isinstance(export.get(field), int) and export[field] > 0):
            raise AssemblyError(f"export.{field} must be a positive integer")
    if sorted(export.get("outputs", {})) != sorted(OUTPUT_FILES):
        raise AssemblyError(f"export.outputs must be exactly {OUTPUT_FILES}")
    return recipe


def crop_box(recipe: dict, source: Image.Image) -> Tuple[int, int, int, int]:
    """Alpha content bbox (must match the recipe) + padding, size rounded up to the downscale factor."""
    spec, export = recipe["source"], recipe["export"]
    threshold = spec["alpha_threshold"]
    bbox = source.getchannel("A").point(lambda v: 255 if v > threshold else 0).getbbox()
    if bbox is None or list(bbox) != spec["content_bbox_px"]:
        raise AssemblyError(f"alpha content bbox {bbox} != recipe {spec['content_bbox_px']}")
    pad, k = export["padding_px"], export["downscale"]
    x0, y0 = bbox[0] - pad, bbox[1] - pad
    w = math.ceil((bbox[2] + pad - x0) / k) * k
    h = math.ceil((bbox[3] + pad - y0) / k) * k
    return x0, y0, x0 + w, y0 + h


def build_textures(recipe: dict, input_dir: Path) -> List[GateTexture]:
    spec, export = recipe["source"], recipe["export"]
    source, _ = aw.load_source(input_dir / spec["file"], spec, "grip forearm hand")
    x0, y0, x1, y1 = crop_box(recipe, source)
    canvas = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    canvas.paste(source.crop((max(0, x0), max(0, y0), min(source.width, x1), min(source.height, y1))),
                 (max(0, -x0), max(0, -y0)))
    k = export["downscale"]
    size = (canvas.width // k, canvas.height // k)
    runtime = canvas.convert("RGBa").resize(size, Image.BOX).convert("RGBA")  # premultiplied: no dark fringes
    anchors = spec["anchors"]

    def to_runtime(p) -> Point:
        return ((p[0] - x0) / k, (p[1] - y0) / k)

    hand, elbow = to_runtime(anchors["hand_source_px"]), to_runtime(anchors["elbow_source_px"])
    mirrored = runtime.transpose(Image.FLIP_TOP_BOTTOM)
    flip = lambda p: (p[0], size[1] - p[1])  # noqa: E731
    return [
        GateTexture("forearm_hand.png", runtime, hand, elbow),
        GateTexture("forearm_hand_mirrored.png", mirrored, flip(hand), flip(elbow)),
    ]


def describe(texture: GateTexture, data: bytes) -> dict:
    return {
        "file": texture.file,
        "size": list(texture.image.size),
        "hand_px": [round(v, 6) for v in texture.hand],
        "elbow_px": [round(v, 6) for v in texture.elbow],
        "pixel_sha256": aw.pixel_sha256(texture.image),
        "file_sha256": hashlib.sha256(data).hexdigest(),
    }


def export(recipe: dict, input_dir: Path, out_dir: Path) -> List[dict]:
    textures = build_textures(recipe, input_dir)
    encoded: Dict[str, bytes] = {t.file: ex.png_bytes(t.image) for t in textures}
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
        fresh = describe(texture, ex.png_bytes(texture.image))
        if size != texture.image.size or pixels != fresh["pixel_sha256"]:
            raise AssemblyError(f"{path.name}: committed pixels differ from a fresh deterministic export")
        if hashlib.sha256(path.read_bytes()).hexdigest() != fresh["file_sha256"]:
            raise AssemblyError(f"{path.name}: committed PNG bytes differ from a fresh deterministic export")
        report.append(fresh)
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export (or --check) the Grip hand marker gate textures (ACTION-11L).")
    parser.add_argument("--recipe", type=Path, default=DEFAULT_RECIPE, help="Grip forearm hand gate recipe")
    parser.add_argument("--input-dir", type=Path, default=aw.DEFAULT_INPUT_DIR, help="directory with the authored source")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_GATE_DIR, help="gate asset directory")
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
        print(f"{'ok' if args.check else 'wrote'} {entry['file']}: size {entry['size'][0]}x{entry['size'][1]}, "
              f"hand {tuple(entry['hand_px'])}, elbow {tuple(entry['elbow_px'])}, pixel sha256 {entry['pixel_sha256']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
