"""Deterministic one-piece wrestler sprite evaluation previews for SumoSim.

Offline Product-art review tool (ART-WRESTLER-02B). One authored full-body
sprite goes in; it is only cropped / padded, rotated once as a whole, uniformly
scaled to the accepted body scale and resampled. Nothing is repainted, warped
or moved per body part. Nothing here is used by the game runtime.

    reviewed sprite -> explicit root / axis / body-core scale -> rotation + arena previews
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import PIL
from PIL import Image, ImageDraw

import assemble_wrestler as aw
from assemble_wrestler import AssemblyError, Part, Vec

TOOL_NAME = "sumosim-wrestler-single-sprite"
TOOL_VERSION = "0.1.0"
MANIFEST_SCHEMA = 1
SPRITE_SCHEMA = 1
RECIPE_SCHEMA = 1

DEFAULT_RECIPE = aw.TOOL_DIR / "single_sprite_recipe.json"
DEFAULT_OUTPUT_DIR = aw.TOOL_DIR / "output-single.local"

# Transparent margin around the normalized sprite (master px; runtime = /4).
SPRITE_PADDING_MASTER = 24
# Free margin around the rotation radius in each preview tile (runtime px).
TILE_MARGIN_RUNTIME = 8
LABEL_HEIGHT = 26
# The body-core reference must be perpendicular to the corrected +X axis.
BODY_CORE_PERPENDICULAR_TOLERANCE_DEG = 3.0
MAX_ORIENTATION_CORRECTION_DEG = 30.0

ANGLES_16 = tuple(i * 22.5 for i in range(16))
ANGLES_8 = tuple(i * 45.0 for i in range(8))

OUTPUT_MASTER = "single_master.png"
OUTPUT_RUNTIME = "single_runtime.png"
OUTPUT_GUIDE = "single_pivot_guide.png"
OUTPUT_ANGLES = "single_runtime_16angles.png"
OUTPUT_ARENA = "single_on_arena_1920.png"
OUTPUT_ARENA_FACINGS = "single_on_arena_8facings.png"
OUTPUT_SPRITE_JSON = "single_sprite.json"
OUTPUT_MANIFEST = "build_single_manifest.json"

GUIDE_CORE = (255, 160, 40)
GUIDE_AXIS_Y = (60, 210, 235)


@dataclass
class SingleBuild:
    images: Dict[str, Image.Image]
    sprite_json: dict
    manifest: dict


def _r6(v: Vec) -> List[float]:
    return [round(v[0], 6), round(v[1], 6)]


def _dist(a: Vec, b: Vec) -> float:
    return math.hypot(b[0] - a[0], b[1] - a[1])


# ---------------------------------------------------------------- recipe


def _point(value, label: str, size: Tuple[int, int]) -> Vec:
    if not (isinstance(value, list) and len(value) == 2 and all(isinstance(v, (int, float)) for v in value)):
        raise AssemblyError(f"{label}: point must be 2 numbers")
    x, y = float(value[0]), float(value[1])
    if not (0 <= x <= size[0] and 0 <= y <= size[1]):
        raise AssemblyError(f"{label}: {value} is outside the source")
    return x, y


def validate_recipe(recipe: dict) -> None:
    if recipe.get("recipe_schema") != RECIPE_SCHEMA:
        raise AssemblyError(f"unsupported recipe_schema {recipe.get('recipe_schema')!r}")
    source = recipe.get("source", {})
    for key in ("file", "size", "pixel_sha256"):
        if key not in source:
            raise AssemblyError(f"recipe source is missing {key!r}")
    size = tuple(source["size"])
    angle = recipe.get("orientation_correction_deg")
    if not isinstance(angle, (int, float)) or abs(angle) > MAX_ORIENTATION_CORRECTION_DEG:
        raise AssemblyError(f"orientation_correction_deg must be a number within +/-{MAX_ORIENTATION_CORRECTION_DEG}")
    _point(recipe.get("root_source_px"), "root_source_px", size)
    core = recipe.get("body_core_source_px")
    if not (isinstance(core, list) and len(core) == 2):
        raise AssemblyError("body_core_source_px must be two points")
    a = _point(core[0], "body_core_source_px[0]", size)
    b = _point(core[1], "body_core_source_px[1]", size)
    if _dist(a, b) <= 0:
        raise AssemblyError("body-core reference length is 0")
    # Perpendicular to the corrected facing axis: after the correction the core line is along local y.
    corrected = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) + angle
    off = abs(((corrected % 180.0) + 180.0) % 180.0 - 90.0)
    if off > BODY_CORE_PERPENDICULAR_TOLERANCE_DEG:
        raise AssemblyError(f"body-core line is {off:.2f} deg off perpendicular to the corrected +X axis")
    target = recipe.get("body_core_target_r")
    if not isinstance(target, (int, float)) or target <= 0:
        raise AssemblyError("body_core_target_r must be > 0")
    if not isinstance(recipe.get("alpha_threshold"), int):
        raise AssemblyError("alpha_threshold must be an integer")


def load_recipe(path: Path) -> dict:
    if not path.is_file():
        raise AssemblyError(f"recipe not found: {path}")
    try:
        recipe = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise AssemblyError(f"recipe is not readable JSON: {path}: {exc}") from exc
    validate_recipe(recipe)
    return recipe


# ---------------------------------------------------------------- normalization


def normalize_sprite(source: Image.Image, recipe: dict) -> Tuple[Part, dict]:
    """Whole-sprite rotation about the root (source resolution) -> trim -> uniform scale to master R."""
    root = tuple(recipe["root_source_px"])
    core = [tuple(p) for p in recipe["body_core_source_px"]]
    angle = math.radians(recipe["orientation_correction_deg"])
    image = source
    if angle != 0.0:
        corners = [aw._rot(aw._sub(c, root), angle) for c in
                   [(0, 0), (source.width, 0), (0, source.height), (source.width, source.height)]]
        min_x = math.floor(min(c[0] for c in corners)) - 2
        min_y = math.floor(min(c[1] for c in corners)) - 2
        size = (math.ceil(max(c[0] for c in corners)) + 2 - min_x, math.ceil(max(c[1] for c in corners)) + 2 - min_y)
        new_root = (float(-min_x), float(-min_y))
        image = aw.place(source, size, root, new_root, angle, Image.BICUBIC)
        core = [aw._add(new_root, aw._rot(aw._sub(p, root), angle)) for p in core]
        root = new_root

    threshold = recipe["alpha_threshold"]
    bbox = aw.alpha_bbox(image, threshold)
    if bbox is None:
        raise AssemblyError("sprite is empty")
    source_core = _dist(*[tuple(p) for p in recipe["body_core_source_px"]])
    scale = recipe["body_core_target_r"] * aw.R_MASTER / source_core

    pad = SPRITE_PADDING_MASTER
    left = max(0.0, (root[0] - bbox[0]) * scale)
    right = max(0.0, (bbox[2] - root[0]) * scale)
    top = max(0.0, (root[1] - bbox[1]) * scale)
    bottom = max(0.0, (bbox[3] - root[1]) * scale)
    # Root on a multiple of 4 master px so the runtime (/4) root is an integer pixel edge.
    pivot = (float(aw._ceil4(left + pad)), float(aw._ceil4(top + pad)))
    size = (aw._ceil4(pivot[0] + right + pad), aw._ceil4(pivot[1] + bottom + pad))
    # Only the alpha bbox content is kept (faint stray alpha outside it is dropped with the margin).
    content = Image.new("RGBA", image.size, (0, 0, 0, 0))
    content.paste(image.crop(bbox), bbox[:2])
    margin = int(math.ceil(max(size) / scale)) + 4
    padded = Image.new("RGBA", (image.width + 2 * margin, image.height + 2 * margin), (0, 0, 0, 0))
    padded.paste(content, (margin, margin))
    p = aw._add(root, (margin, margin))
    box = (p[0] - pivot[0] / scale, p[1] - pivot[1] / scale,
           p[0] + (size[0] - pivot[0]) / scale, p[1] + (size[1] - pivot[1]) / scale)
    master = padded.resize(size, Image.LANCZOS, box=box)
    master_core = [aw._add(pivot, aw._mul(aw._sub(c, root), scale)) for c in core]

    info = {
        "rotated_alpha_bbox": list(bbox),
        "source_body_core_px": round(source_core, 6),
        "scale_source_to_master": round(scale, 9),
        "scale_source_to_runtime": round(scale / aw.MASTER_FACTOR, 9),
    }
    return Part(master, pivot, {"core_a": master_core[0], "core_b": master_core[1]}), info


# ---------------------------------------------------------------- previews


def rotation_radius(part: Part) -> float:
    """Largest distance from the root to any kept pixel corner (bounds every rotation)."""
    bbox = aw.alpha_bbox(part.image, 0)
    corners = [(bbox[0], bbox[1]), (bbox[2], bbox[1]), (bbox[0], bbox[3]), (bbox[2], bbox[3])]
    return max(_dist(part.pivot, c) for c in corners)


def _tile_layer(part: Part, tile: int, facing_deg: float) -> Image.Image:
    return aw.place(part.image, (tile, tile), part.pivot, (tile / 2, tile / 2), math.radians(facing_deg),
                    Image.BILINEAR)


def _alpha_centroid(image: Image.Image) -> Vec:
    alpha = image.getchannel("A")
    hist_x = [0] * image.width
    hist_y = [0] * image.height
    data = alpha.load()
    total = 0
    for y in range(image.height):
        row = 0
        for x in range(image.width):
            v = data[x, y]
            if v:
                hist_x[x] += v
                row += v
        hist_y[y] = row
        total += row
    cx = sum((x + 0.5) * v for x, v in enumerate(hist_x)) / total
    cy = sum((y + 0.5) * v for y, v in enumerate(hist_y)) / total
    return cx, cy


def _check_unclipped(layer: Image.Image, label: str) -> List[int]:
    bbox = aw.alpha_bbox(layer, 0)
    if bbox is None:
        raise AssemblyError(f"{label}: empty")
    if bbox[0] == 0 or bbox[1] == 0 or bbox[2] == layer.width or bbox[3] == layer.height:
        raise AssemblyError(f"{label}: sprite touches the tile edge (clipped)")
    return list(bbox)


def build_rotation_sheet(part: Part, tile: int) -> Tuple[Image.Image, List[dict]]:
    cols = 4
    rows = len(ANGLES_16) // cols
    sheet = Image.new("RGBA", (tile * cols, (tile + LABEL_HEIGHT) * rows), aw.ANGLES_BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    font = aw._font(17)
    infos = []
    for i, deg in enumerate(ANGLES_16):
        layer = _tile_layer(part, tile, deg)
        bbox = _check_unclipped(layer, f"rotation {deg}")
        centroid = _alpha_centroid(layer)
        x0, y0 = (i % cols) * tile, (i // cols) * (tile + LABEL_HEIGHT)
        sheet.alpha_composite(layer, (x0, y0 + LABEL_HEIGHT))
        draw.text((x0 + 8, y0 + 4), f"facing {deg:g}°", fill=(255, 255, 255, 255), font=font)
        infos.append({
            "facing_deg": deg,
            "root_in_tile_px": [tile / 2, tile / 2],
            "alpha_bbox_in_tile": bbox,
            "alpha_centroid_distance_from_root_px": round(_dist((tile / 2, tile / 2), centroid), 4),
        })
    return sheet, infos


def load_arena(arena_dir: Path) -> Tuple[Image.Image, dict]:
    images = []
    infos = {}
    for file_name in (aw.ARENA_BASE_FILE, aw.ARENA_OVERLAY_FILE):
        path = arena_dir / file_name
        if not path.is_file():
            raise AssemblyError(f"arena asset missing: {path}")
        with Image.open(path) as opened:
            opened.load()
            image = opened.convert("RGBA")
        if image.size != aw.ARENA_SIZE:
            raise AssemblyError(f"arena asset {file_name} is not {aw.ARENA_SIZE[0]}x{aw.ARENA_SIZE[1]}")
        images.append(image)
        infos[file_name] = {"file_sha256": aw.file_sha256(path), "pixel_sha256": aw.rgba_pixel_sha256(image)}
    arena = images[0]
    arena.alpha_composite(images[1])
    return arena, infos


def _draw_wrestler(canvas: Image.Image, part: Part, shadow: Part, root: Vec, facing: float) -> None:
    # Preview-only near-circular world shadow (same geometry as the current WrestlerView), then the sprite.
    position = aw._add(root, aw._mul(aw.SHADOW_OFFSET_R, aw.R_RUNTIME))
    canvas.alpha_composite(aw.place(shadow.image, canvas.size, shadow.pivot, position, facing, Image.BILINEAR))
    canvas.alpha_composite(aw.place(part.image, canvas.size, part.pivot, root, facing, Image.BILINEAR))


def start_roots() -> List[Tuple[Vec, float]]:
    px_per_m = aw.RING_RADIUS_PX / aw.RING_RADIUS_M
    return [
        ((aw.ARENA_CENTER[0] - aw.START_OFFSET_M * px_per_m, aw.ARENA_CENTER[1]), 0.0),
        ((aw.ARENA_CENTER[0] + aw.START_OFFSET_M * px_per_m, aw.ARENA_CENTER[1]), math.pi),
    ]


def build_arena_preview(arena: Image.Image, part: Part, shadow: Part) -> Tuple[Image.Image, List[dict]]:
    canvas = arena.copy()
    for root, facing in start_roots():
        _draw_wrestler(canvas, part, shadow, root, facing)
    infos = [{"root_px": _r6(root), "facing_deg": round(math.degrees(facing), 6)} for root, facing in start_roots()]
    return canvas.convert("RGB"), infos


def build_arena_facings(arena: Image.Image, part: Part, shadow: Part, tile: int) -> Tuple[Image.Image, dict]:
    cols = 4
    rows = len(ANGLES_8) // cols
    cx, cy = int(aw.ARENA_CENTER[0]), int(aw.ARENA_CENTER[1])
    crop_box = (cx - tile // 2, cy - tile // 2, cx - tile // 2 + tile, cy - tile // 2 + tile)
    section = arena.crop(crop_box)
    root = (aw.ARENA_CENTER[0] - crop_box[0], aw.ARENA_CENTER[1] - crop_box[1])
    sheet = Image.new("RGBA", (tile * cols, (tile + LABEL_HEIGHT) * rows), aw.ANGLES_BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    font = aw._font(17)
    for i, deg in enumerate(ANGLES_8):
        layer = Image.new("RGBA", section.size, (0, 0, 0, 0))
        layer.alpha_composite(aw.place(part.image, section.size, part.pivot, root, math.radians(deg), Image.BILINEAR))
        _check_unclipped(layer, f"arena facing {deg}")
        tile_image = section.copy()
        _draw_wrestler(tile_image, part, shadow, root, math.radians(deg))
        x0, y0 = (i % cols) * tile, (i // cols) * (tile + LABEL_HEIGHT)
        sheet.alpha_composite(tile_image, (x0, y0 + LABEL_HEIGHT))
        draw.text((x0 + 8, y0 + 4), f"facing {deg:g}°", fill=(255, 255, 255, 255), font=font)
    info = {"arena_crop_box": list(crop_box), "root_px": _r6(aw.ARENA_CENTER), "facings_deg": list(ANGLES_8)}
    return sheet.convert("RGB"), info


def build_pivot_guide(master: Part) -> Image.Image:
    half = aw._ceil4(rotation_radius(master) + 80)
    side = 2 * half
    guide = Image.new("RGBA", (side, side), aw.GUIDE_BACKGROUND)
    root = (float(half), float(half))
    guide.alpha_composite(aw.place(master.image, (side, side), master.pivot, root, 0.0, Image.NEAREST))
    draw = ImageDraw.Draw(guide)
    r = aw.R_MASTER
    draw.ellipse((root[0] - r, root[1] - r, root[0] + r, root[1] + r), outline=aw.GUIDE_BODY, width=3)
    reach = half - 20
    font = aw._font(24)
    front = (root[0] + reach, root[1])
    draw.line(((root[0] - reach, root[1]), front), fill=aw.GUIDE_ROOT, width=2)
    draw.polygon((front, aw._add(front, (-22, -11)), aw._add(front, (-22, 11))), fill=aw.GUIDE_ROOT)
    right = (root[0], root[1] + reach)
    draw.line(((root[0], root[1] - reach), right), fill=GUIDE_AXIS_Y, width=2)
    draw.polygon((right, aw._add(right, (-11, -22)), aw._add(right, (11, -22))), fill=GUIDE_AXIS_Y)
    draw.text((front[0] - 130, front[1] + 12), "+X FRONT", fill=aw.GUIDE_ROOT, font=font)
    draw.text((root[0] - reach, root[1] + 12), "-X BACK", fill=aw.GUIDE_ROOT, font=font)
    draw.text((root[0] + 12, right[1] - 34), "+Y RIGHT", fill=GUIDE_AXIS_Y, font=font)
    draw.text((root[0] + 12, root[1] - reach + 4), "-Y LEFT", fill=GUIDE_AXIS_Y, font=font)
    core = [aw._add(root, aw._sub(master.joints[k], master.pivot)) for k in ("core_a", "core_b")]
    draw.line(core, fill=GUIDE_CORE, width=5)
    for x, y in core:
        draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill=GUIDE_CORE, outline=(0, 0, 0), width=2)
    x, y = root
    draw.line((x - 16, y, x + 16, y), fill=aw.GUIDE_ROOT, width=4)
    draw.line((x, y - 16, x, y + 16), fill=aw.GUIDE_ROOT, width=4)
    small = aw._font(20)
    legend = [
        (aw.GUIDE_ROOT, "root = participant center / rotation pivot"),
        (aw.GUIDE_BODY, "gameplay body circle R (runtime ~123 px diameter)"),
        (GUIDE_CORE, "body-core scale reference = 2R"),
        (GUIDE_AXIS_Y, "+Y = wrestler RIGHT"),
    ]
    for i, (color, text) in enumerate(legend):
        y0 = 12 + i * 26
        draw.rectangle((12, y0 + 3, 28, y0 + 19), fill=color)
        draw.text((36, y0), text, fill=(235, 235, 235), font=small)
    draw.text((12, side - 34), f"master: R = {aw.R_MASTER:.3f} px (runtime x{aw.MASTER_FACTOR})",
              fill=(235, 235, 235), font=small)
    return guide.convert("RGB")


# ---------------------------------------------------------------- build


def build(recipe: dict, input_dir: Path, arena_dir: Path) -> SingleBuild:
    source_spec = recipe["source"]
    source, source_info = aw.load_source(input_dir / source_spec["file"], source_spec, "wrestler_single")
    master, norm_info = normalize_sprite(source, recipe)
    runtime = aw.runtime_part(master)
    for label, part in (("master", master), ("runtime", runtime)):
        _check_unclipped(part.image, f"single_{label}")
        px, py = part.pivot
        if not (0 < px < part.image.width and 0 < py < part.image.height):
            raise AssemblyError(f"single_{label}: root is outside the normalized image")

    tile = aw._ceil4(2 * (rotation_radius(runtime) + TILE_MARGIN_RUNTIME))
    angles_sheet, angle_infos = build_rotation_sheet(runtime, tile)
    arena, arena_assets = load_arena(arena_dir)
    shadow = aw.shadow_part(aw.R_RUNTIME)
    arena_image, arena_roots = build_arena_preview(arena, runtime, shadow)
    facings_sheet, facings_info = build_arena_facings(arena, runtime, shadow, tile)
    guide = build_pivot_guide(master)

    images = {
        OUTPUT_MASTER: master.image,
        OUTPUT_RUNTIME: runtime.image,
        OUTPUT_GUIDE: guide,
        OUTPUT_ANGLES: angles_sheet,
        OUTPUT_ARENA: arena_image,
        OUTPUT_ARENA_FACINGS: facings_sheet,
    }

    runtime_bbox = aw.alpha_bbox(runtime.image, recipe["alpha_threshold"])
    evidence_deg = None
    evidence = recipe.get("orientation_evidence")
    if evidence:  # informational: axis angle implied by the documented landmarks
        back, front = evidence["back_source_px"], evidence["front_source_px"]
        evidence_deg = round(math.degrees(math.atan2(front[1] - back[1], front[0] - back[0])), 6)
    sprite_json = {
        "schema": SPRITE_SCHEMA,
        "tool": TOOL_NAME,
        "coordinates": "image px, pixel edges on integers, +x right, +y down; local frame: +x FRONT, +y wrestler RIGHT",
        "source": {
            "file": source_info["file"],
            "size": source_info["size"],
            "file_sha256": source_info["file_sha256"],
            "pixel_sha256": source_info["pixel_sha256"],
        },
        "orientation_correction_deg": recipe["orientation_correction_deg"],
        "orientation_evidence_axis_deg": evidence_deg,
        "root_source_px": list(recipe["root_source_px"]),
        "body_core_source_px": [list(p) for p in recipe["body_core_source_px"]],
        "body_core_source_distance_px": norm_info["source_body_core_px"],
        "body_core_target_r": recipe["body_core_target_r"],
        "r_runtime_px": round(aw.R_RUNTIME, 6),
        "r_master_px": round(aw.R_MASTER, 6),
        "scale_source_to_master": norm_info["scale_source_to_master"],
        "scale_source_to_runtime": norm_info["scale_source_to_runtime"],
        "master": {
            "file": OUTPUT_MASTER,
            "size": list(master.image.size),
            "pivot": _r6(master.pivot),
            "body_core_px": [_r6(master.joints["core_a"]), _r6(master.joints["core_b"])],
            "body_core_length_px": round(_dist(master.joints["core_a"], master.joints["core_b"]), 6),
        },
        "runtime": {
            "file": OUTPUT_RUNTIME,
            "size": list(runtime.image.size),
            "pivot": _r6(runtime.pivot),
            "body_core_px": [_r6(runtime.joints["core_a"]), _r6(runtime.joints["core_b"])],
            "body_core_length_px": round(_dist(runtime.joints["core_a"], runtime.joints["core_b"]), 6),
            "alpha_bbox": list(runtime_bbox),
            "alpha_bbox_size": [runtime_bbox[2] - runtime_bbox[0], runtime_bbox[3] - runtime_bbox[1]],
            "rotation_radius_px": round(rotation_radius(runtime), 6),
        },
        "rotation_preview": {"tile_px": tile, "angles": angle_infos},
        "arena_preview": {"wrestlers": arena_roots},
        "arena_facings_preview": facings_info,
    }

    outputs = {
        name: {"size": list(image.size), "mode": image.mode, "pixel_sha256": aw.pixel_sha256(image)}
        for name, image in sorted(images.items())
    }
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "tool": TOOL_NAME,
        "tool_version": TOOL_VERSION,
        "pillow_version": PIL.__version__,
        "recipe_name": recipe.get("name"),
        "recipe_canonical_sha256": hashlib.sha256(
            json.dumps(recipe, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest(),
        "recipe": recipe,
        "source": source_info,
        "scale": {
            "body_radius_m": aw.BODY_RADIUS_M,
            "ring_radius_m": aw.RING_RADIUS_M,
            "ring_radius_px": aw.RING_RADIUS_PX,
            "r_runtime_px": round(aw.R_RUNTIME, 6),
            "master_factor": aw.MASTER_FACTOR,
            "r_master_px": round(aw.R_MASTER, 6),
            "sprite_padding_master_px": SPRITE_PADDING_MASTER,
        },
        "arena_assets": arena_assets,
        "shadow": {"size_r": list(aw.SHADOW_SIZE_R), "alpha": aw.SHADOW_ALPHA,
                   "world_offset_r": list(aw.SHADOW_OFFSET_R), "blur_runtime_px": aw.SHADOW_BLUR_RUNTIME_PX},
        "single_sprite_json_sha256": hashlib.sha256(aw.json_text(sprite_json).encode("ascii")).hexdigest(),
        "outputs": outputs,
    }
    return SingleBuild(images, sprite_json, manifest)


def write_outputs(result: SingleBuild, output_dir: Path, input_paths: List[Path]) -> List[Path]:
    output_dir = output_dir.resolve()
    resolved_inputs = {p.resolve() for p in input_paths}
    names = list(result.images) + [OUTPUT_SPRITE_JSON, OUTPUT_MANIFEST]
    for name in names:
        if (output_dir / name) in resolved_inputs:
            raise AssemblyError(f"output would overwrite an input: {output_dir / name}")
    output_dir.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".staging-", dir=output_dir))
    try:
        for name, image in result.images.items():
            image.save(staging / name, format="PNG")
        for name, data in ((OUTPUT_SPRITE_JSON, result.sprite_json), (OUTPUT_MANIFEST, result.manifest)):
            with open(staging / name, "w", encoding="ascii", newline="\n") as handle:
                handle.write(aw.json_text(data))
        for name in names:  # manifest last
            os.replace(staging / name, output_dir / name)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    return [output_dir / name for name in names]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Normalize the reviewed one-piece wrestler sprite and build its "
                                                 "rotation / arena evaluation previews.")
    parser.add_argument("--recipe", type=Path, default=DEFAULT_RECIPE, help="explicit root / axis / scale recipe")
    parser.add_argument("--input-dir", type=Path, default=aw.DEFAULT_INPUT_DIR, help="directory with the reviewed sprite")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="local output directory")
    parser.add_argument("--arena-dir", type=Path, default=aw.DEFAULT_ARENA_DIR,
                        help="committed Product arena runtime assets")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        recipe = load_recipe(args.recipe)
        result = build(recipe, args.input_dir, args.arena_dir)
        written = write_outputs(result, args.output_dir, [args.input_dir / recipe["source"]["file"], args.recipe])
    except AssemblyError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for path in written:
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
