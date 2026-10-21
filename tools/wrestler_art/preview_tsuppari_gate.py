"""Offline comparison evidence for the ACTION-07C Tsuppari Visual Gate (git-ignored output, no runtime assets).

Rebuilds exactly the textures of export_tsuppari_gate.py (same recipe, same code path) and renders the sheets
the User Visual Gate needs: normalized pivot guides, one sheet per art mode, idle <-> Tsuppari alignment,
rotations, faceoffs at body contact / Tsuppari reach, mawashi mask diagnostics and the authored blue
reference vs derived blue comparison. The authored blue candidates appear here only as references.

    PY tools/wrestler_art/preview_tsuppari_gate.py      # -> tools/wrestler_art/output-tsuppari-gate.local/
"""

from __future__ import annotations

import argparse
import hashlib
import math
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import PIL
from PIL import Image, ImageChops, ImageDraw, ImageFilter

import assemble_wrestler as aw
import export_runtime_wrestlers as ex
import export_tsuppari_gate as eg
import preview_dual_rigid_wrestlers as pd
import preview_idle_mirror_workflow as im
import preview_single_wrestler as ps
from assemble_wrestler import AssemblyError, Part, Vec

TOOL_NAME = "sumosim-wrestler-tsuppari-gate"
TOOL_VERSION = "0.1.0"
MANIFEST_SCHEMA = 1

DEFAULT_OUTPUT_DIR = aw.TOOL_DIR / "output-tsuppari-gate.local"
FACEOFF_VIEW_PX = (600, 440)
OUTLINE_COLOR = (0, 255, 255, 255)
SHEET_BACKGROUND = im.SHEET_BACKGROUND
# blue band used only to measure the authored blue references (the historical blue -> red source band)
BLUE_BAND = {"source_hue_deg": [190, 250], "min_saturation": 0.3, "min_value": 0.06}

OUTPUT_GUIDES = {key: f"pivot_guide_{key}.png" for key in eg.MASTERS + eg.REFERENCES}
OUTPUT_MODE_SHEETS = {mode: f"mode_{mode}.png" for mode in eg.MODES}
OUTPUT_ALIGNMENT = "idle_tsuppari_alignment.png"
OUTPUT_ROTATIONS = {mode: f"rotations_{mode}.png" for mode in eg.MODES}
OUTPUT_FACEOFF = {mode: f"faceoff_{mode}.png" for mode in eg.MODES}
OUTPUT_MASKS = "mawashi_mask_diagnostics.png"
OUTPUT_BLUE_REFERENCE = "blue_reference_vs_derived.png"
OUTPUT_JSON = "tsuppari_gate.json"
OUTPUT_MANIFEST = "build_tsuppari_gate_manifest.json"


@dataclass
class GateBuild:
    images: Dict[str, Image.Image]
    info: dict
    manifest: dict


# ---------------------------------------------------------------- sheet helpers


def _tile_size(parts: List[Part]) -> int:
    """Square tile that holds every part rotated about its pivot (pivot on the tile center)."""
    return aw._ceil4(2 * max(ps.rotation_radius(p) for p in parts) + 16)


def _tile(part: Part, label: str, tile: int, facing_deg: float = 0.0) -> Image.Image:
    return im._sprite_tile(im.Sprite(part, label), tile, math.radians(facing_deg))


def _silhouette_outline(part: Part, size: Tuple[int, int], center: Vec) -> Image.Image:
    """1 px outline of the part's alpha > 50% silhouette, pivot on `center` (FRONT = +x)."""
    layer = aw.place(part.image, size, part.pivot, center, 0.0, Image.BILINEAR)
    alpha = layer.getchannel("A").point(lambda a: 255 if a > 128 else 0)
    edge = ImageChops.subtract(alpha, alpha.filter(ImageFilter.MinFilter(3)))
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(Image.new("RGBA", size, OUTLINE_COLOR), (0, 0), edge)
    return out


def _stack(rows: List[Image.Image]) -> Image.Image:
    width = max(r.width for r in rows)
    sheet = Image.new("RGB", (width, sum(r.height for r in rows)), SHEET_BACKGROUND[:3])
    y = 0
    for row in rows:
        sheet.paste(row, (0, y))
        y += row.height
    return sheet


def _cell(image: Image.Image, scale: int = 2) -> Image.Image:
    out = Image.new("RGBA", image.size, SHEET_BACKGROUND)
    out.alpha_composite(image)
    return out.resize((image.width * scale, image.height * scale), Image.NEAREST)


# ---------------------------------------------------------------- landmarks (alignment evidence)


def _centroid(points) -> Optional[Vec]:
    pts = list(points)
    if not pts:
        return None
    return (sum(p[0] + 0.5 for p in pts) / len(pts), sum(p[1] + 0.5 for p in pts) / len(pts))


def hair_centroid(image: Image.Image) -> Vec:
    """Dark opaque pixels, 3 px erosion (drops the outline), largest 4-connected component."""
    dark = Image.new("L", image.size, 0)
    dp = dark.load()
    for i, (r, g, b, a) in enumerate(image.getdata()):
        if a > 200 and max(r, g, b) < 80:
            dp[i % image.width, i // image.width] = 255
    eroded = dark.filter(ImageFilter.MinFilter(3)).load()
    points = {(x, y) for y in range(image.height) for x in range(image.width) if eroded[x, y]}
    best: set = set()
    seen: set = set()
    for start in sorted(points):
        if start in seen:
            continue
        component, stack = {start}, [start]
        seen.add(start)
        while stack:
            x, y = stack.pop()
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in points and q not in seen:
                    seen.add(q)
                    component.add(q)
                    stack.append(q)
        if len(component) > len(best):
            best = component
    centroid = _centroid(best)
    if centroid is None:
        raise AssemblyError("alignment: no hair blob")
    return centroid


def landmarks(part: Part, rule: dict) -> dict:
    """Hair / mawashi centroids in the local frame (runtime px from the pivot, +x FRONT, +y RIGHT)."""
    local = lambda p: [round(p[0] - part.pivot[0], 3), round(p[1] - part.pivot[1], 3)]  # noqa: E731
    return {"hair": local(hair_centroid(part.image)), "mawashi": local(_centroid(im.mawashi_mask(part.image, rule)))}


# ---------------------------------------------------------------- previews


def build_mode_sheet(mode: str, textures: Dict[str, eg.GateTexture], idle: Dict[str, Part], tile: int) -> Image.Image:
    tiles = [(f"idle {color}", _tile(idle[color], color, tile)) for color in eg.COLORS]
    tiles += [(f"{mode} {t.variant.replace('_', ' ')} hand ({t.master}{' refl' if t.reflect else ''})",
               _tile(t.part, t.file, tile)) for t in (textures[v] for v in eg.VARIANTS)]
    return im._labeled_grid(tiles, 3)


def build_alignment(textures: List[eg.GateTexture], idle: Dict[str, Part], tile: int) -> Image.Image:
    """Each pose with the same-colour idle silhouette outline (cyan), both on the same pivot / FRONT."""
    rows = []
    for mode in eg.MODES:
        tiles = []
        for t in (x for x in textures if x.mode == mode):
            base = _tile(t.part, t.file, tile)
            base.alpha_composite(_silhouette_outline(idle[t.variant.split("_")[0]], base.size, (tile / 2, tile / 2)))
            tiles.append((f"{mode} {t.variant} + idle outline", base))
        rows.append(im._labeled_grid(tiles, len(tiles)))
    return _stack(rows)


def build_rotations(mode: str, textures: Dict[str, eg.GateTexture], angles: List[float], tile: int) -> Image.Image:
    tiles = [(f"{v} {a:g}°", _tile(textures[v].part, v, tile, a)) for v in eg.VARIANTS for a in angles]
    return im._labeled_grid(tiles, len(angles))


def build_faceoffs(mode: str, textures: Dict[str, eg.GateTexture], idle: Dict[str, Part], arena: Image.Image,
                   distances: List[dict]) -> Image.Image:
    """Blue (player, left) faces red (right) as in the prototype; one or both strike."""
    shadow = aw.shadow_part(aw.R_RUNTIME)
    scenes = [
        ("blue L strikes", {"blue": textures["blue_left"].part, "red": idle["red"]}),
        ("blue R strikes", {"blue": textures["blue_right"].part, "red": idle["red"]}),
        ("red L strikes", {"blue": idle["blue"], "red": textures["red_left"].part}),
        ("red R strikes", {"blue": idle["blue"], "red": textures["red_right"].part}),
        ("both L", {"blue": textures["blue_left"].part, "red": textures["red_left"].part}),
        ("both R", {"blue": textures["blue_right"].part, "red": textures["red_right"].part}),
    ]
    tiles = []
    for name, parts in scenes:
        for d in distances:
            frame = pd.pair(d["distance_m"] / aw.BODY_RADIUS_M, 0.0)
            box = pd.view_box(aw.ARENA_CENTER, FACEOFF_VIEW_PX)
            label = f"{mode} | {name} | {d['label']}"
            tiles.append((label, pd.render_view(arena, parts, shadow, frame, box).convert("RGBA")))
    return im._labeled_grid(tiles, len(distances))


def build_mask_diagnostics(recipe: dict, masters: Dict[str, Part]) -> Tuple[Image.Image, dict]:
    """Every distinct blue derivation: red source (after the optional reflection), mask, recolored result."""
    rule = recipe["recolor"]
    rows, info = [], {}
    for master in eg.MASTERS:
        for reflect in (False, True):
            source = aw.mirror_part(masters[master]) if reflect else masters[master]
            mask = im.mawashi_mask(source.image, rule)
            report = eg.mask_report(source.image, mask, rule)
            out = im.recolor(source.image, mask, rule)
            key = f"{master}{'_reflected' if reflect else ''}"
            report["hand_after"] = eg.OPPOSITE[recipe["masters"][master]["hand"]] if reflect else recipe["masters"][master]["hand"]
            report["mask_hsv_before"] = im.mask_hsv_stats(source.image, mask)
            report["mask_hsv_after"] = im.mask_hsv_stats(out, mask)
            info[key] = report
            cells = [(f"{key}: source", _cell(source.image)),
                     (f"mask {report['mask_px']} px, missed {report['missed_band_px']}, fringe {report['fringe_px']}",
                      _cell(im._mask_image(source.image.size, mask, source.image))),
                     ("mawashi recolor (blue)", _cell(out))]
            rows.append(im._labeled_grid(cells, len(cells)))
    return _stack(rows), info


def build_blue_reference(textures: List[eg.GateTexture], references: Dict[str, Part], idle_blue: Part,
                         tile: int) -> Image.Image:
    rows = []
    for hand in eg.HANDS:
        variant = f"blue_{hand}"
        tiles = [(f"authored blue {hand} (reference)", _tile(references[variant], variant, tile))]
        tiles += [(f"{t.mode} {variant} ({t.master}{' refl' if t.reflect else ''})", _tile(t.part, t.file, tile))
                  for t in textures if t.variant == variant]
        tiles.append(("idle blue (accepted)", _tile(idle_blue, "idle blue", tile)))
        rows.append(im._labeled_grid(tiles, len(tiles)))
    return _stack(rows)


def build_guides(recipe: dict, input_dir: Path) -> Dict[str, Image.Image]:
    out = {}
    for group in ("masters", "references"):
        for key, spec in sorted(recipe[group].items()):
            master = eg.normalize_master(spec, input_dir / spec["file"], key, recipe["alpha_threshold"])
            out[OUTPUT_GUIDES[key]] = ps.build_pivot_guide(master)
    return out


# ---------------------------------------------------------------- build


def build(recipe: dict, input_dir: Path, arena_dir: Path) -> GateBuild:
    masters = eg.build_masters(recipe, input_dir)
    references = eg.build_references(recipe, input_dir)
    textures = [eg.derive_texture(recipe, masters, mode, v) for mode in eg.MODES for v in eg.VARIANTS]
    by_mode = {mode: {t.variant: t for t in textures if t.mode == mode} for mode in eg.MODES}
    idle = ex.export_parts(ex.load_recipe(ex.DEFAULT_RECIPE), input_dir)
    arena, arena_assets = ps.load_arena(arena_dir)
    tile = _tile_size([t.part for t in textures] + list(references.values()) + list(idle.values()))

    images: Dict[str, Image.Image] = build_guides(recipe, input_dir)
    for mode in eg.MODES:
        images[OUTPUT_MODE_SHEETS[mode]] = build_mode_sheet(mode, by_mode[mode], idle, tile)
        images[OUTPUT_ROTATIONS[mode]] = build_rotations(mode, by_mode[mode], recipe["angles_deg"], tile)
        images[OUTPUT_FACEOFF[mode]] = build_faceoffs(mode, by_mode[mode], idle, arena, recipe["faceoff"])
    images[OUTPUT_ALIGNMENT] = build_alignment(textures, idle, tile)
    images[OUTPUT_MASKS], mask_info = build_mask_diagnostics(recipe, masters)
    images[OUTPUT_BLUE_REFERENCE] = build_blue_reference(textures, references, idle["blue"], tile)

    rule = recipe["recolor"]
    idle_marks = landmarks(idle["red"], rule)
    alignment = {"idle_red": idle_marks}
    for key in eg.MASTERS:
        marks = landmarks(masters[key], rule)
        alignment[key] = {
            **marks,
            "delta_vs_idle_px": {k: [round(marks[k][i] - idle_marks[k][i], 3) for i in (0, 1)] for k in marks},
            "note": "reflection mirrors these local offsets (y -> -y); the recolor does not move them",
        }
    info = {
        "status": "Visual Gate candidate (ACTION-07C) - pending User Visual Gate; no Tsuppari art strategy accepted",
        "hand_convention": "local +X = FRONT, +Y = wrestler RIGHT; local-Y reflection swaps the wrestler's hand",
        "textures": [eg.describe(t, ex.png_bytes(t.part.image)) for t in textures],
        "mawashi_masks": mask_info,
        "alignment_runtime_px": alignment,
        "references": {
            key: {
                "size": list(part.image.size),
                "pivot": ps._r6(part.pivot),
                "body_core_px": round(ps._dist(part.joints["core_a"], part.joints["core_b"]), 6),
                "mawashi": im.mask_hsv_stats(part.image, im.mawashi_mask(part.image, BLUE_BAND)),
            }
            for key, part in sorted(references.items())
        },
        "derived_blue_mawashi": {
            t.file: im.mask_hsv_stats(t.part.image, t.mask) for t in textures if t.variant.startswith("blue_")
        },
        "idle_blue_mawashi": im.mask_hsv_stats(idle["blue"].image, im.mawashi_mask(idle["blue"].image, BLUE_BAND)),
    }
    outputs = {name: {"size": list(img.size), "mode": img.mode, "pixel_sha256": aw.pixel_sha256(img)}
               for name, img in sorted(images.items())}
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "tool": TOOL_NAME,
        "tool_version": TOOL_VERSION,
        "pillow_version": PIL.__version__,
        "recipe_canonical_sha256": hashlib.sha256(aw.json_text(recipe).encode("ascii")).hexdigest(),
        "arena_assets": arena_assets,
        "tsuppari_gate_json_sha256": hashlib.sha256(aw.json_text(info).encode("ascii")).hexdigest(),
        "outputs": outputs,
    }
    return GateBuild(images, info, manifest)


def write_outputs(result: GateBuild, output_dir: Path) -> List[Path]:
    output_dir = output_dir.resolve()
    names = sorted(result.images) + [OUTPUT_JSON, OUTPUT_MANIFEST]
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
    parser = argparse.ArgumentParser(description="Render the Tsuppari Visual-Gate comparison evidence (ACTION-07C).")
    parser.add_argument("--recipe", type=Path, default=eg.DEFAULT_RECIPE)
    parser.add_argument("--input-dir", type=Path, default=aw.DEFAULT_INPUT_DIR, help="local Tsuppari candidates + idle red")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--arena-dir", type=Path, default=aw.DEFAULT_ARENA_DIR)
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        recipe = eg.load_recipe(args.recipe)
        written = write_outputs(build(recipe, args.input_dir, args.arena_dir), args.output_dir)
    except AssemblyError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for path in written:
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
