"""Idle mirror + mawashi recolor workflow previews (ART-WRESTLER-04A, Candidate / Pending User Visual Gate).

Offline visual validation only. Reads the committed runtime idle sprites (read-only) and derives each
wrestler's counterpart from the other one:

    master (FRONT = local +X)  -> reflect local Y (wrestler left <-> right; FRONT kept)
                               -> deterministic mawashi recolor (hue band + largest component)
                               -> side-by-side / rotation / arena faceoff / diagnostic previews

The runtime assets, their metadata and the existing dual-sprite workflow are not changed.
"""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import json
import math
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import PIL
from PIL import Image, ImageDraw

import assemble_wrestler as aw
import preview_dual_rigid_wrestlers as pd
import preview_single_wrestler as ps
from assemble_wrestler import AssemblyError, Part, Vec

TOOL_NAME = "sumosim-wrestler-idle-mirror"
TOOL_VERSION = "0.1.0"
MANIFEST_SCHEMA = 1
RECIPE_SCHEMA = 1

DEFAULT_RECIPE = aw.TOOL_DIR / "idle_mirror_recipe.json"
DEFAULT_OUTPUT_DIR = aw.TOOL_DIR / "output-idle-mirror.local"

SPRITES = ("blue", "red")
# Derived counterpart per master and the recolor rule that produces it.
DERIVATIONS = {"blue": ("red", "blue_to_red"), "red": ("blue", "red_to_blue")}

TILE_PX = 280
ANGLE_TILE_PX = 260
FACEOFF_VIEW_PX = (560, 440)
DIAGNOSTIC_SCALE = 2
LABEL_HEIGHT = 24
SHEET_BACKGROUND = (92, 90, 86, 255)
MASK_COLOR = (255, 230, 40, 255)

OUTPUT_COMPARISON = "idle_mirror_comparison.png"
OUTPUT_ROTATIONS = {master: f"derived_{DERIVATIONS[master][0]}_from_{master}_rotations.png" for master in SPRITES}
OUTPUT_FACEOFF = "idle_mirror_faceoff_arena.png"
OUTPUT_DIAGNOSTICS = {master: f"diagnostics_{master}_master.png" for master in SPRITES}
OUTPUT_DERIVED = {master: f"derived_{DERIVATIONS[master][0]}_from_{master}.png" for master in SPRITES}
OUTPUT_JSON = "idle_mirror.json"
OUTPUT_MANIFEST = "build_idle_mirror_manifest.json"


@dataclass
class Sprite:
    part: Part  # joints: core_a / core_b (body-core reference, runtime px)
    label: str


@dataclass
class MirrorBuild:
    images: Dict[str, Image.Image]
    info: dict
    manifest: dict


# ---------------------------------------------------------------- recipe / inputs


def load_recipe(path: Path) -> dict:
    if not path.is_file():
        raise AssemblyError(f"recipe not found: {path}")
    try:
        recipe = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise AssemblyError(f"recipe is not readable JSON: {path}: {exc}") from exc
    if recipe.get("recipe_schema") != RECIPE_SCHEMA:
        raise AssemblyError(f"unsupported recipe_schema {recipe.get('recipe_schema')!r}")
    if sorted(recipe.get("sprites", {})) != sorted(SPRITES):
        raise AssemblyError("recipe must define the blue and red runtime sprites")
    for rule in ("blue_to_red", "red_to_blue"):
        if rule not in recipe.get("recolor", {}):
            raise AssemblyError(f"recipe is missing recolor.{rule}")
    return recipe


def load_runtime_sprite(repo_root: Path, key: str, spec: dict) -> Sprite:
    """A committed runtime sprite, opened read-only and checked against its reviewed pixels / metadata."""
    path = repo_root / spec["file"]
    if not path.is_file():
        raise AssemblyError(f"{key}: runtime sprite missing: {path}")
    with Image.open(path) as opened:
        opened.load()
        image = opened.convert("RGBA")
    if list(image.size) != list(spec["size"]):
        raise AssemblyError(f"{key}: size {image.size} != recipe {spec['size']}")
    if aw.pixel_sha256(image) != spec["pixel_sha256"]:
        raise AssemblyError(f"{key}: runtime sprite pixels differ from the reviewed committed asset")
    core = {"core_a": tuple(spec["body_core_px"][0]), "core_b": tuple(spec["body_core_px"][1])}
    return Sprite(Part(image, tuple(spec["pivot"]), core), f"authored {key}")


# ---------------------------------------------------------------- mirror / mask / recolor


def mirror_local_y(sprite: Sprite, label: str) -> Sprite:
    """Reflection across the local X axis: (x, y) -> (x, H - y). FRONT (local +X) is unchanged; the
    wrestler's left and right swap. Pivot / body-core points map the same way (assemble_wrestler.mirror_part)."""
    return Sprite(aw.mirror_part(sprite.part), label)


def _hue_in_band(hue_deg: float, band: List[float]) -> bool:
    lo, hi = band
    if hi > 360:
        return hue_deg >= lo or hue_deg < hi - 360
    return lo <= hue_deg < hi


def mawashi_mask(image: Image.Image, rule: dict) -> Set[Tuple[int, int]]:
    """Pixels in the source mawashi hue band (with saturation / value floors, alpha > 8), restricted to
    the largest 4-connected component (drops tinted outline pixels elsewhere on the body)."""
    width, height = image.size
    px = image.load()
    band: Set[Tuple[int, int]] = set()
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a <= 8:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if _hue_in_band(h * 360, rule["source_hue_deg"]) and s >= rule["min_saturation"] and v >= rule["min_value"]:
                band.add((x, y))
    best: Set[Tuple[int, int]] = set()
    seen: Set[Tuple[int, int]] = set()
    for start in sorted(band):  # sorted: deterministic tie order
        if start in seen:
            continue
        component = {start}
        stack = [start]
        seen.add(start)
        while stack:
            x, y = stack.pop()
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in band and q not in seen:
                    seen.add(q)
                    component.add(q)
                    stack.append(q)
        if len(component) > len(best):
            best = component
    return best


def recolor(image: Image.Image, mask: Set[Tuple[int, int]], rule: dict) -> Image.Image:
    """Inside the mask: hue -> target, saturation * gain, value -> value * gain + offset (clamped);
    alpha unchanged. Outside the mask the pixels are copied unchanged."""
    out = image.copy()
    px = out.load()
    target = (rule["target_hue_deg"] % 360) / 360
    for x, y in mask:
        r, g, b, a = px[x, y]
        _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        s = min(1.0, max(0.0, s * rule["saturation_gain"]))
        v = min(1.0, max(0.0, v * rule["value_gain"] + rule["value_offset"]))
        nr, ng, nb = colorsys.hsv_to_rgb(target, s, v)
        px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


def derive(master: Sprite, master_key: str, recipe: dict) -> Tuple[Sprite, Sprite, Set[Tuple[int, int]]]:
    """master -> (mirror-only, mirror + recolor, mask on the mirrored image)."""
    target_key, rule_key = DERIVATIONS[master_key]
    mirrored = mirror_local_y(master, f"{master_key} mirrored")
    rule = recipe["recolor"][rule_key]
    mask = mawashi_mask(mirrored.part.image, rule)
    derived = Sprite(Part(recolor(mirrored.part.image, mask, rule), mirrored.part.pivot, dict(mirrored.part.joints)),
                     f"derived {target_key} (from {master_key})")
    return mirrored, derived, mask


def mask_fringe(image: Image.Image, mask: Set[Tuple[int, int]], rule: dict) -> int:
    """Opaque non-mask pixels touching the mask that still carry the source hue (anti-aliased edge)."""
    px = image.load()
    width, height = image.size
    count = 0
    seen: Set[Tuple[int, int]] = set()
    for x, y in mask:
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if q in mask or q in seen or not (0 <= q[0] < width and 0 <= q[1] < height):
                continue
            seen.add(q)
            r, g, b, a = px[q]
            if a <= 8:
                continue
            h, s, _ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if _hue_in_band(h * 360, rule["source_hue_deg"]) and s >= 0.15:
                count += 1
    return count


def mask_hsv_stats(image: Image.Image, mask: Set[Tuple[int, int]]) -> dict:
    px = image.load()
    hs, ss, vs = [], [], []
    for p in sorted(mask):
        r, g, b, _ = px[p]
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        hs.append(h)
        ss.append(s)
        vs.append(v)
    if not hs:
        return {"pixels": 0}
    hue = math.degrees(math.atan2(sum(math.sin(2 * math.pi * h) for h in hs),
                                  sum(math.cos(2 * math.pi * h) for h in hs))) % 360
    vs.sort()
    return {
        "pixels": len(hs),
        "mean_hue_deg": round(hue, 3),
        "mean_saturation": round(sum(ss) / len(ss), 4),
        "value_p10_p50_p90": [round(vs[int(len(vs) * q)], 4) for q in (0.1, 0.5, 0.9)],
    }


# ---------------------------------------------------------------- previews


def _font(size: int):
    return aw._font(size)


def _sprite_tile(sprite: Sprite, tile: int, facing: float, background=SHEET_BACKGROUND) -> Image.Image:
    """Sprite rotated by `facing` with its pivot on the tile center, over the body circle R reference."""
    canvas = Image.new("RGBA", (tile, tile), background)
    center = (tile / 2, tile / 2)
    layer = aw.place(sprite.part.image, (tile, tile), sprite.part.pivot, center, facing, Image.BILINEAR)
    ps._check_unclipped(layer, sprite.label)
    canvas.alpha_composite(layer)
    draw = ImageDraw.Draw(canvas)
    r = aw.R_RUNTIME
    draw.ellipse((center[0] - r, center[1] - r, center[0] + r, center[1] + r), outline=aw.GUIDE_BODY, width=1)
    draw.line((center[0] - 6, center[1], center[0] + 6, center[1]), fill=aw.GUIDE_ROOT, width=1)
    draw.line((center[0], center[1] - 6, center[0], center[1] + 6), fill=aw.GUIDE_ROOT, width=1)
    return canvas


def _labeled_grid(tiles: List[Tuple[str, Image.Image]], cols: int) -> Image.Image:
    tw, th = tiles[0][1].size
    rows = math.ceil(len(tiles) / cols)
    sheet = Image.new("RGBA", (tw * cols, (th + LABEL_HEIGHT) * rows), SHEET_BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    font = _font(15)
    for i, (label, tile) in enumerate(tiles):
        x0, y0 = (i % cols) * tw, (i // cols) * (th + LABEL_HEIGHT)
        sheet.alpha_composite(tile, (x0, y0 + LABEL_HEIGHT))
        draw.text((x0 + 6, y0 + 4), label, fill=(255, 255, 255, 255), font=font)
    return sheet.convert("RGB")


def build_comparison(sprites: List[Sprite]) -> Image.Image:
    # local frame (FRONT = right), pivot on the tile center, body circle R
    return _labeled_grid([(s.label, _sprite_tile(s, TILE_PX, 0.0)) for s in sprites], 4)


def build_rotations(sprite: Sprite, angles: List[float]) -> Image.Image:
    tiles = [(f"{sprite.label} {a:g}°", _sprite_tile(sprite, ANGLE_TILE_PX, math.radians(a))) for a in angles]
    return _labeled_grid(tiles, len(tiles))


def build_faceoff(arena: Image.Image, pairs: List[Tuple[str, Dict[str, Part]]], variants: List[dict]) -> Image.Image:
    shadow = aw.shadow_part(aw.R_RUNTIME)
    tiles = []
    for name, parts in pairs:
        for v in variants:
            frame = pd.pair(v["distance_r"], v["line_deg"])
            box = pd.view_box(aw.ARENA_CENTER, FACEOFF_VIEW_PX)
            tiles.append((f"{name} | {v['label']}", pd.render_view(arena, parts, shadow, frame, box).convert("RGBA")))
    return _labeled_grid(tiles, len(variants))


def _mask_image(size: Tuple[int, int], mask: Set[Tuple[int, int]], base: Image.Image) -> Image.Image:
    shown = Image.new("RGBA", size, (30, 30, 30, 255))
    dim = base.copy()
    dim.putalpha(dim.getchannel("A").point(lambda a: a // 3))
    shown.alpha_composite(dim)
    px = shown.load()
    for p in mask:
        px[p] = MASK_COLOR
    return shown


def _overlay(sprite: Sprite) -> Image.Image:
    img = Image.new("RGBA", sprite.part.image.size, SHEET_BACKGROUND)
    img.alpha_composite(sprite.part.image)
    draw = ImageDraw.Draw(img)
    px, py = sprite.part.pivot
    r = aw.R_RUNTIME
    draw.ellipse((px - r, py - r, px + r, py + r), outline=aw.GUIDE_BODY, width=1)
    draw.line([sprite.part.joints["core_a"], sprite.part.joints["core_b"]], fill=(255, 160, 40), width=1)
    draw.line((px - 6, py, px + 6, py), fill=(255, 255, 255), width=1)
    draw.line((px, py - 6, px, py + 6), fill=(255, 255, 255), width=1)
    draw.line((px, py, px + 40, py), fill=(255, 255, 255), width=1)  # +X FRONT
    return img


def build_diagnostics(master: Sprite, mirrored: Sprite, mask: Set[Tuple[int, int]], derived: Sprite) -> Image.Image:
    size = master.part.image.size
    cells = [
        ("source (master)", Image.alpha_composite(Image.new("RGBA", size, SHEET_BACKGROUND), master.part.image)),
        ("mirror only (local Y)", Image.alpha_composite(Image.new("RGBA", size, SHEET_BACKGROUND), mirrored.part.image)),
        ("mawashi mask", _mask_image(size, mask, mirrored.part.image)),
        ("mirror + recolor", Image.alpha_composite(Image.new("RGBA", size, SHEET_BACKGROUND), derived.part.image)),
        ("pivot / body core / +X", _overlay(derived)),
    ]
    scaled = [(label, img.resize((size[0] * DIAGNOSTIC_SCALE, size[1] * DIAGNOSTIC_SCALE), Image.NEAREST)) for label, img in cells]
    return _labeled_grid(scaled, len(scaled))


# ---------------------------------------------------------------- build


def body_core_length(sprite: Sprite) -> float:
    return ps._dist(sprite.part.joints["core_a"], sprite.part.joints["core_b"])


def build(recipe: dict, repo_root: Path, arena_dir: Path) -> MirrorBuild:
    authored = {key: load_runtime_sprite(repo_root, key, recipe["sprites"][key]) for key in SPRITES}
    images: Dict[str, Image.Image] = {}
    derived: Dict[str, Sprite] = {}
    info: dict = {
        "status": "Candidate / Pending User Visual Gate",
        "transform": "reflection across the local X axis: (x, y) -> (x, H - y); FRONT stays local +X; "
                     "pivot / body-core points mapped the same way",
        "authored": {},
        "derived": {},
    }
    for key in SPRITES:
        s = authored[key]
        # the authored mawashi, selected with the rule whose source band is this sprite's colour
        own_mask = mawashi_mask(s.part.image, recipe["recolor"][DERIVATIONS[key][1]])
        info["authored"][key] = {
            "size": list(s.part.image.size),
            "pivot": list(s.part.pivot),
            "body_core_px": round(body_core_length(s), 6),
            "mawashi": mask_hsv_stats(s.part.image, own_mask),
        }
    for master in SPRITES:
        target_key, rule_key = DERIVATIONS[master]
        mirrored, out, mask = derive(authored[master], master, recipe)
        derived[master] = out
        rule = recipe["recolor"][rule_key]
        images[OUTPUT_DERIVED[master]] = out.part.image
        images[OUTPUT_DIAGNOSTICS[master]] = build_diagnostics(authored[master], mirrored, mask, out)
        images[OUTPUT_ROTATIONS[master]] = build_rotations(out, recipe["angles_deg"])
        info["derived"][f"{target_key}_from_{master}"] = {
            "size": list(out.part.image.size),
            "pivot": list(out.part.pivot),
            "authored_counterpart_pivot": list(authored[target_key].part.pivot),
            "body_core_px": round(body_core_length(out), 6),
            "mask_pixels": len(mask),
            "mask_fringe_pixels": mask_fringe(mirrored.part.image, mask, rule),
            "recolor_rule": rule_key,
            "mawashi_after": mask_hsv_stats(out.part.image, mask),
            "pixel_sha256": aw.pixel_sha256(out.part.image),
        }

    images[OUTPUT_COMPARISON] = build_comparison(
        [authored["blue"], authored["red"], derived["blue"], derived["red"]])
    arena, arena_assets = ps.load_arena(arena_dir)
    pairs = [
        ("authored blue + authored red", {"blue": authored["blue"].part, "red": authored["red"].part}),
        ("blue master: authored blue + derived red", {"blue": authored["blue"].part, "red": derived["blue"].part}),
        ("red master: derived blue + authored red", {"blue": derived["red"].part, "red": authored["red"].part}),
    ]
    images[OUTPUT_FACEOFF] = build_faceoff(arena, pairs, recipe["faceoff"])

    outputs = {name: {"size": list(img.size), "mode": img.mode, "pixel_sha256": aw.pixel_sha256(img)}
               for name, img in sorted(images.items())}
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "tool": TOOL_NAME,
        "tool_version": TOOL_VERSION,
        "pillow_version": PIL.__version__,
        "recipe_canonical_sha256": hashlib.sha256(
            json.dumps(recipe, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest(),
        "recipe": recipe,
        "arena_assets": arena_assets,
        "idle_mirror_json_sha256": hashlib.sha256(aw.json_text(info).encode("ascii")).hexdigest(),
        "outputs": outputs,
    }
    return MirrorBuild(images, info, manifest)


def write_outputs(result: MirrorBuild, output_dir: Path) -> List[Path]:
    output_dir = output_dir.resolve()
    names = list(result.images) + [OUTPUT_JSON, OUTPUT_MANIFEST]
    output_dir.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".staging-", dir=output_dir))
    try:
        for name, image in result.images.items():
            image.save(staging / name, format="PNG")
        for name, data in ((OUTPUT_JSON, result.info), (OUTPUT_MANIFEST, result.manifest)):
            with open(staging / name, "w", encoding="ascii", newline="\n") as handle:
                handle.write(aw.json_text(data))
        for name in names:  # manifest last
            os.replace(staging / name, output_dir / name)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    return [output_dir / name for name in names]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Preview the idle mirror + mawashi recolor workflow (ART-WRESTLER-04A).")
    parser.add_argument("--recipe", type=Path, default=DEFAULT_RECIPE)
    parser.add_argument("--repo-root", type=Path, default=aw.REPO_ROOT, help="where the committed runtime sprites live")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--arena-dir", type=Path, default=aw.DEFAULT_ARENA_DIR)
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        recipe = load_recipe(args.recipe)
        result = build(recipe, args.repo_root, args.arena_dir)
        written = write_outputs(result, args.output_dir)
    except AssemblyError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for path in written:
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
