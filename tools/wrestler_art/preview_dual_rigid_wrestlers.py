"""Deterministic dual rigid-sprite wrestler validation previews for SumoSim.

Offline Product-art review tool (ART-WRESTLER-03A). Two separately authored
wrestler sprites (blue / red) are each treated as one rigid object: whole-sprite
rotation, whole-sprite translation and one uniform scale only. Nothing is
mirrored, warped, repainted or moved per limb. Motion paths are explicit
preview-only parameters; no gameplay formula or physics is used.

    blue + red sprites -> explicit root / front axis / body-core scale
        -> 360 deg rotation, faceoff, minimal rigid motion previews (PNG / GIF)
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
import preview_single_wrestler as ps
from assemble_wrestler import AssemblyError, Part, Vec

TOOL_NAME = "sumosim-wrestler-dual-rigid"
TOOL_VERSION = "0.1.0"
MANIFEST_SCHEMA = 1
DUAL_SCHEMA = 1
RECIPE_SCHEMA = 1

DEFAULT_RECIPE = aw.TOOL_DIR / "dual_rigid_recipe.json"
DEFAULT_OUTPUT_DIR = aw.TOOL_DIR / "output-dual-rigid.local"

SPRITES = ("blue", "red")  # draw order: blue first, red on top
BODY_CORE_PERPENDICULAR_TOLERANCE_DEG = 3.0
MAX_STAGGER_ROTATION_DEG = 6.0
VARIANT_TILE_PX = 560
SHEET_TILE_PX = (640, 400)

OUTPUT_ANGLES = {key: f"{key}_runtime_16angles.png" for key in SPRITES}
OUTPUT_GUIDES = {key: f"{key}_pivot_guide.png" for key in SPRITES}
OUTPUT_FACEOFF = "dual_faceoff_arena_1920.png"
OUTPUT_VARIANTS = "dual_faceoff_variants.png"
OUTPUT_SHEET = "rigid_motion_contact_sheet.png"
OUTPUT_ADVANCE = "dual_advance.gif"
OUTPUT_STAGGER = {(key, rotate): f"{key}_stagger_translation_{'plus_rotation' if rotate else 'only'}.gif"
                  for key in SPRITES for rotate in (False, True)}
OUTPUT_PUSH = "dual_push_contact.gif"
OUTPUT_JSON = "dual_rigid.json"
OUTPUT_MANIFEST = "build_dual_rigid_manifest.json"

# One frame: sprite key -> (world root px, world facing rad).
Frame = Dict[str, Tuple[Vec, float]]


@dataclass
class DualBuild:
    images: Dict[str, Image.Image]
    gifs: Dict[str, List[Image.Image]]
    dual_json: dict
    manifest: dict
    frame_ms: int


def _r4(v: Vec) -> List[float]:
    return [round(v[0], 4), round(v[1], 4)]


def _dir(angle: float) -> Vec:
    return math.cos(angle), math.sin(angle)


def ease_in_out(t: float) -> float:
    return 0.5 - 0.5 * math.cos(math.pi * min(1.0, max(0.0, t)))


def ease_out(t: float) -> float:
    return math.sin(0.5 * math.pi * min(1.0, max(0.0, t)))


# ---------------------------------------------------------------- recipe


def _sprite_recipe(spec: dict, alpha_threshold: int) -> dict:
    """The single-sprite normalization input for one sprite (one whole rotation: -source_front_deg)."""
    return {
        "root_source_px": spec["root_source_px"],
        "body_core_source_px": spec["body_core_source_px"],
        "body_core_target_r": spec["body_core_target_r"],
        "orientation_correction_deg": -spec["source_front_deg"],
        "alpha_threshold": alpha_threshold,
    }


def validate_recipe(recipe: dict) -> None:
    if recipe.get("recipe_schema") != RECIPE_SCHEMA:
        raise AssemblyError(f"unsupported recipe_schema {recipe.get('recipe_schema')!r}")
    if not isinstance(recipe.get("alpha_threshold"), int):
        raise AssemblyError("alpha_threshold must be an integer")
    sprites = recipe.get("sprites", {})
    if sorted(sprites) != sorted(SPRITES):
        raise AssemblyError(f"recipe must define exactly the sprites {list(SPRITES)}")
    files = set()
    for key in SPRITES:
        spec = sprites[key]
        for field in ("file", "size", "pixel_sha256", "source_front_deg", "root_source_px", "body_core_source_px",
                      "body_core_target_r"):
            if field not in spec:
                raise AssemblyError(f"sprite {key!r} is missing {field!r}")
        files.add(spec["file"])
        size = tuple(spec["size"])
        if not isinstance(spec["source_front_deg"], (int, float)):
            raise AssemblyError(f"sprite {key!r}: source_front_deg must be a number")
        ps._point(spec["root_source_px"], f"{key}.root_source_px", size)
        core = spec["body_core_source_px"]
        if not (isinstance(core, list) and len(core) == 2):
            raise AssemblyError(f"sprite {key!r}: body_core_source_px must be two points")
        a = ps._point(core[0], f"{key}.body_core_source_px[0]", size)
        b = ps._point(core[1], f"{key}.body_core_source_px[1]", size)
        if ps._dist(a, b) <= 0:
            raise AssemblyError(f"sprite {key!r}: body-core reference length is 0")
        line = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) - spec["source_front_deg"]
        off = abs(((line % 180.0) + 180.0) % 180.0 - 90.0)
        if off > BODY_CORE_PERPENDICULAR_TOLERANCE_DEG:
            raise AssemblyError(f"sprite {key!r}: body-core line is {off:.2f} deg off perpendicular to its front axis")
        if not (isinstance(spec["body_core_target_r"], (int, float)) and spec["body_core_target_r"] > 0):
            raise AssemblyError(f"sprite {key!r}: body_core_target_r must be > 0")
    if len(files) != len(SPRITES):
        raise AssemblyError("blue and red must be separate source files")
    variants = recipe.get("faceoff", {}).get("variants", [])
    if len(variants) < 6:
        raise AssemblyError("faceoff needs the six required variants")
    motion = recipe.get("motion", {})
    for section in ("advance", "stagger", "push"):
        if section not in motion:
            raise AssemblyError(f"motion.{section} is missing")
    rotation = motion["stagger"].get("rotation_max_deg")
    if not isinstance(rotation, (int, float)) or not 0 < rotation <= MAX_STAGGER_ROTATION_DEG:
        raise AssemblyError(f"motion.stagger.rotation_max_deg must be in (0, {MAX_STAGGER_ROTATION_DEG}]")
    if not (isinstance(motion.get("frame_ms"), int) and motion["frame_ms"] > 0):
        raise AssemblyError("motion.frame_ms must be a positive integer")


def load_recipe(path: Path) -> dict:
    if not path.is_file():
        raise AssemblyError(f"recipe not found: {path}")
    try:
        recipe = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise AssemblyError(f"recipe is not readable JSON: {path}: {exc}") from exc
    validate_recipe(recipe)
    return recipe


# ---------------------------------------------------------------- scenes (world px, arena space)


def pair(distance_r: float, line_deg: float, center: Vec = aw.ARENA_CENTER) -> Frame:
    """Blue and red on a line through `center`, each facing the other root exactly."""
    line = math.radians(line_deg)
    half = aw._mul(_dir(line), distance_r * aw.R_RUNTIME / 2)
    blue = aw._sub(center, half)
    red = aw._add(center, half)
    return {"blue": (blue, line), "red": (red, line + math.pi)}


def advance_frames(m: dict) -> List[Frame]:
    frames = []
    total = m["hold_start_frames"] + m["move_frames"] + m["hold_end_frames"]
    for i in range(total):
        t = (i - m["hold_start_frames"]) / max(1, m["move_frames"] - 1)
        distance = m["start_distance_r"] - 2 * m["distance_r_each"] * ease_in_out(t)
        frames.append(pair(distance, 0.0))
    return frames


def stagger_offsets(m: dict) -> List[Tuple[float, float, float]]:
    """(back R, lateral R, rotation 0..1) per frame: hold, push out, peak, recover, hold."""
    out = []
    for _ in range(m["hold_start_frames"]):
        out.append((0.0, 0.0, 0.0))
    for i in range(1, m["out_frames"] + 1):
        e = ease_out(i / m["out_frames"])
        out.append((m["back_r"] * e, m["lateral_r"] * e, e))
    for _ in range(m["hold_peak_frames"]):
        out.append((m["back_r"], m["lateral_r"], 1.0))
    for i in range(1, m["recover_frames"] + 1):
        e = ease_in_out(i / m["recover_frames"])
        out.append((m["back_r"] + (m["recover_back_r"] - m["back_r"]) * e,
                    m["lateral_r"] + (m["recover_lateral_r"] - m["lateral_r"]) * e, 1.0 - e))
    for _ in range(m["hold_end_frames"]):
        out.append(out[-1])
    return out


def stagger_frames(m: dict, key: str, rotate: bool) -> List[Frame]:
    base = pair(m["contact_distance_r"], 0.0)
    root, facing = base[key]
    back = aw._mul(_dir(facing + math.pi), aw.R_RUNTIME)
    side = aw._mul(_dir(facing + math.pi / 2), aw.R_RUNTIME)  # the staggering wrestler's local +Y
    frames = []
    for back_r, lateral_r, turn in stagger_offsets(m):
        position = aw._add(root, aw._add(aw._mul(back, back_r), aw._mul(side, lateral_r)))
        angle = facing + (math.radians(m["rotation_max_deg"]) * turn if rotate else 0.0)
        frame = dict(base)
        frame[key] = (position, angle)
        frames.append(frame)
    return frames


def push_frames(m: dict) -> List[Frame]:
    frames = []
    for i in range(1, m["approach_frames"] + 1):
        e = ease_in_out(i / m["approach_frames"])
        frames.append(pair(m["start_distance_r"] + (m["contact_distance_r"] - m["start_distance_r"]) * e, 0.0))
    for _ in range(m["hold_contact_frames"]):
        frames.append(pair(m["contact_distance_r"], 0.0))
    keys = m["shift_keys_r"]
    shift_r = keys[0]
    for a, b in zip(keys, keys[1:]):
        for i in range(1, m["segment_frames"] + 1):
            shift_r = a + (b - a) * ease_in_out(i / m["segment_frames"])
            center = (aw.ARENA_CENTER[0] + shift_r * aw.R_RUNTIME, aw.ARENA_CENTER[1])
            frames.append(pair(m["contact_distance_r"], 0.0, center))
    for _ in range(m["hold_end_frames"]):
        frames.append(frames[-1])
    return [pair(m["start_distance_r"], 0.0)] + frames


# ---------------------------------------------------------------- rendering


def view_box(center: Vec, size: Tuple[int, int]) -> Tuple[int, int, int, int]:
    x0 = int(round(center[0] - size[0] / 2))
    y0 = int(round(center[1] - size[1] / 2))
    return x0, y0, x0 + size[0], y0 + size[1]


def sprites_layer(parts: Dict[str, Part], frame: Frame, box: Tuple[int, int, int, int]) -> Image.Image:
    """Only the rigid sprites (no arena / shadow) in view space: whole-sprite rotation + translation."""
    size = (box[2] - box[0], box[3] - box[1])
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    for key in SPRITES:
        root, facing = frame[key]
        part = parts[key]
        local = (root[0] - box[0], root[1] - box[1])
        layer.alpha_composite(aw.place(part.image, size, part.pivot, local, facing, Image.BILINEAR))
    return layer


def render_view(arena: Image.Image, parts: Dict[str, Part], shadow: Part, frame: Frame,
                box: Tuple[int, int, int, int], label: str = "") -> Image.Image:
    view = arena.crop(box)
    layer = sprites_layer(parts, frame, box)
    bbox = aw.alpha_bbox(layer, 0)
    if bbox is None or bbox[0] == 0 or bbox[1] == 0 or bbox[2] == layer.width or bbox[3] == layer.height:
        raise AssemblyError(f"preview view {label or box}: a sprite touches the view edge (clipped)")
    for key in SPRITES:  # preview-only near-circular world shadows below both bodies
        root, facing = frame[key]
        position = (root[0] - box[0] + aw.SHADOW_OFFSET_R[0] * aw.R_RUNTIME,
                    root[1] - box[1] + aw.SHADOW_OFFSET_R[1] * aw.R_RUNTIME)
        view.alpha_composite(aw.place(shadow.image, view.size, shadow.pivot, position, facing, Image.BILINEAR))
    view.alpha_composite(layer)
    if label:
        draw = ImageDraw.Draw(view)
        draw.rectangle((0, 0, view.width, 24), fill=(30, 30, 30, 200))
        draw.text((8, 3), label, fill=(255, 255, 255, 255), font=aw._font(17))
    return view


def build_gif_frames(arena: Image.Image, parts: Dict[str, Part], shadow: Part, frames: List[Frame],
                     view: Tuple[int, int]) -> List[Image.Image]:
    box = view_box(aw.ARENA_CENTER, view)
    return [render_view(arena, parts, shadow, frame, box).convert("RGB") for frame in frames]


def frames_json(frames: List[Frame]) -> List[dict]:
    return [{key: {"root_px": _r4(frame[key][0]), "facing_deg": round(math.degrees(frame[key][1]), 4)}
             for key in SPRITES} for frame in frames]


def build_faceoff_arena(arena: Image.Image, parts: Dict[str, Part], shadow: Part, distance_r: float) -> Image.Image:
    frame = pair(distance_r, 0.0)
    canvas = render_view(arena, parts, shadow, frame, (0, 0) + aw.ARENA_SIZE)
    return canvas.convert("RGB")


def build_variants(arena: Image.Image, parts: Dict[str, Part], shadow: Part, variants: List[dict]) -> Tuple[Image.Image, List[dict]]:
    tile = VARIANT_TILE_PX
    cols = 3
    rows = math.ceil(len(variants) / cols)
    sheet = Image.new("RGBA", (tile * cols, tile * rows), aw.ANGLES_BACKGROUND)
    infos = []
    for i, variant in enumerate(variants):
        frame = pair(variant["distance_r"], variant["line_deg"])
        box = view_box(aw.ARENA_CENTER, (tile, tile))
        label = f"{variant['label']}: {variant['distance_r']:g}R, line {variant['line_deg']:g}°"
        sheet.alpha_composite(render_view(arena, parts, shadow, frame, box, label), ((i % cols) * tile, (i // cols) * tile))
        infos.append({"label": variant["label"], "distance_r": variant["distance_r"], "line_deg": variant["line_deg"],
                      "frame": frames_json([frame])[0], "facing_to_opponent_dot": facing_dots(frame)})
    return sheet.convert("RGB"), infos


def facing_dots(frame: Frame) -> Dict[str, float]:
    """cos(angle between each facing and the direction to the other root); 1 = exactly toward the opponent."""
    out = {}
    for key, other in (("blue", "red"), ("red", "blue")):
        (root, facing), (target, _) = frame[key], frame[other]
        to = aw._sub(target, root)
        length = math.hypot(*to)
        out[key] = round((math.cos(facing) * to[0] + math.sin(facing) * to[1]) / length, 9)
    return out


def build_contact_sheet(arena: Image.Image, parts: Dict[str, Part], shadow: Part,
                        entries: List[Tuple[str, Frame]]) -> Image.Image:
    w, h = SHEET_TILE_PX
    cols = 3
    rows = math.ceil(len(entries) / cols)
    sheet = Image.new("RGBA", (w * cols, h * rows), aw.ANGLES_BACKGROUND)
    for i, (label, frame) in enumerate(entries):
        # the view follows the pair center so close-up frames stay comparable
        mid = aw._mul(aw._add(frame["blue"][0], frame["red"][0]), 0.5)
        box = view_box((round(mid[0]), round(mid[1])), (w, h))
        sheet.alpha_composite(render_view(arena, parts, shadow, frame, box, label), ((i % cols) * w, (i // cols) * h))
    return sheet.convert("RGB")


# ---------------------------------------------------------------- build


def build(recipe: dict, input_dir: Path, arena_dir: Path) -> DualBuild:
    threshold = recipe["alpha_threshold"]
    parts: Dict[str, Part] = {}
    masters: Dict[str, Part] = {}
    sprite_info: Dict[str, dict] = {}
    source_info: Dict[str, dict] = {}
    images: Dict[str, Image.Image] = {}
    angle_info: Dict[str, dict] = {}
    for key in SPRITES:
        spec = recipe["sprites"][key]
        source, source_info[key] = aw.load_source(input_dir / spec["file"], spec, key)
        master, norm = ps.normalize_sprite(source, _sprite_recipe(spec, threshold))
        runtime = aw.runtime_part(master)
        for label, part in (("master", master), ("runtime", runtime)):
            ps._check_unclipped(part.image, f"{key}_{label}")
        masters[key], parts[key] = master, runtime
        tile = aw._ceil4(2 * (ps.rotation_radius(runtime) + ps.TILE_MARGIN_RUNTIME))
        images[OUTPUT_ANGLES[key]], angles = ps.build_rotation_sheet(runtime, tile)
        images[OUTPUT_GUIDES[key]] = ps.build_pivot_guide(master)
        angle_info[key] = {"tile_px": tile, "angles": angles}
        bbox = aw.alpha_bbox(runtime.image, threshold)
        core = [runtime.joints["core_a"], runtime.joints["core_b"]]
        evidence = spec.get("front_evidence")
        sprite_info[key] = {
            "source": {k: source_info[key][k] for k in ("file", "size", "file_sha256", "pixel_sha256")},
            "nominal_front": spec.get("nominal_front"),
            "source_front_deg": spec["source_front_deg"],
            "normalization_rotation_deg": -spec["source_front_deg"],
            "front_evidence_axis_deg": None if not evidence else round(math.degrees(math.atan2(
                evidence["front_source_px"][1] - evidence["back_source_px"][1],
                evidence["front_source_px"][0] - evidence["back_source_px"][0])), 6),
            "root_source_px": list(spec["root_source_px"]),
            "body_core_source_px": [list(p) for p in spec["body_core_source_px"]],
            "body_core_source_distance_px": norm["source_body_core_px"],
            "scale_source_to_master": norm["scale_source_to_master"],
            "scale_source_to_runtime": norm["scale_source_to_runtime"],
            "master": {"size": list(master.image.size), "pivot": ps._r6(master.pivot)},
            "runtime": {
                "size": list(runtime.image.size),
                "pivot": ps._r6(runtime.pivot),
                "body_core_px": [ps._r6(p) for p in core],
                "body_core_length_px": round(ps._dist(*core), 6),
                "alpha_bbox": list(bbox),
                "alpha_bbox_size": [bbox[2] - bbox[0], bbox[3] - bbox[1]],
                "rotation_radius_px": round(ps.rotation_radius(runtime), 6),
            },
        }

    arena, arena_assets = ps.load_arena(arena_dir)
    shadow = aw.shadow_part(aw.R_RUNTIME)
    faceoff = recipe["faceoff"]
    motion = recipe["motion"]
    view = tuple(motion["gif_view_px"])

    images[OUTPUT_FACEOFF] = build_faceoff_arena(arena, parts, shadow, faceoff["start_distance_r"])
    images[OUTPUT_VARIANTS], variant_info = build_variants(arena, parts, shadow, faceoff["variants"])

    scenes: Dict[str, List[Frame]] = {OUTPUT_ADVANCE: advance_frames(motion["advance"])}
    for key in SPRITES:
        for rotate in (False, True):
            scenes[OUTPUT_STAGGER[(key, rotate)]] = stagger_frames(motion["stagger"], key, rotate)
    scenes[OUTPUT_PUSH] = push_frames(motion["push"])
    gifs = {name: build_gif_frames(arena, parts, shadow, frames, view) for name, frames in scenes.items()}

    adv = motion["advance"]
    st = motion["stagger"]
    advance = scenes[OUTPUT_ADVANCE]
    push = scenes[OUTPUT_PUSH]
    push_peak = max(range(len(push)), key=lambda i: push[i]["blue"][0][0])
    stagger_plain = scenes[OUTPUT_STAGGER[("blue", False)]]
    stagger_turn = scenes[OUTPUT_STAGGER[("blue", True)]]
    peak = st["hold_start_frames"] + st["out_frames"]
    sheet_entries = [
        ("idle faceoff", advance[0]),
        ("advance start", advance[adv["hold_start_frames"] + 2]),
        ("advance mid", advance[adv["hold_start_frames"] + adv["move_frames"] // 2]),
        ("near contact", advance[-1]),
        ("push displacement", push[push_peak]),
        ("stagger start (blue)", stagger_plain[st["hold_start_frames"] + 1]),
        ("stagger peak (blue, translation only)", stagger_plain[peak]),
        ("recovery (blue)", stagger_plain[-1]),
        (f"stagger peak (blue, +{st['rotation_max_deg']:g}° rigid)", stagger_turn[peak]),
    ]
    images[OUTPUT_SHEET] = build_contact_sheet(arena, parts, shadow, sheet_entries)

    gif_info = {}
    for name, frames in scenes.items():
        gif_info[name] = {
            "frame_count": len(frames),
            "frame_ms": motion["frame_ms"],
            "view_box": list(view_box(aw.ARENA_CENTER, view)),
            "frames": frames_json(frames),
            "decoded_frames_sha256": hashlib.sha256(b"".join(f.tobytes() for f in gifs[name])).hexdigest(),
        }

    dual_json = {
        "schema": DUAL_SCHEMA,
        "tool": TOOL_NAME,
        "coordinates": "world = Product arena px (1920x1080, ring center (960, 540)); facing deg, + = clockwise; "
                       "local frame: +x FRONT, +y wrestler RIGHT",
        "transforms": "whole-sprite rotation + whole-sprite translation + one uniform scale; no mirroring",
        "r_runtime_px": round(aw.R_RUNTIME, 6),
        "r_master_px": round(aw.R_MASTER, 6),
        "sprites": sprite_info,
        "rotation_preview": angle_info,
        "faceoff_arena": {"frame": frames_json([pair(faceoff["start_distance_r"], 0.0)])[0],
                          "facing_to_opponent_dot": facing_dots(pair(faceoff["start_distance_r"], 0.0))},
        "faceoff_variants": variant_info,
        "motion_preview_parameters": motion,
        "contact_sheet": [label for label, _ in sheet_entries],
        "animations": gif_info,
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
        "sources": source_info,
        "scale": {"r_runtime_px": round(aw.R_RUNTIME, 6), "master_factor": aw.MASTER_FACTOR,
                  "r_master_px": round(aw.R_MASTER, 6), "body_radius_m": aw.BODY_RADIUS_M,
                  "ring_radius_m": aw.RING_RADIUS_M, "ring_radius_px": aw.RING_RADIUS_PX},
        "arena_assets": arena_assets,
        "shadow": {"size_r": list(aw.SHADOW_SIZE_R), "alpha": aw.SHADOW_ALPHA,
                   "world_offset_r": list(aw.SHADOW_OFFSET_R), "blur_runtime_px": aw.SHADOW_BLUR_RUNTIME_PX},
        "dual_rigid_json_sha256": hashlib.sha256(aw.json_text(dual_json).encode("ascii")).hexdigest(),
        "outputs": outputs,
        "animated_outputs": {name: {"frame_count": info["frame_count"],
                                    "decoded_frames_sha256": info["decoded_frames_sha256"]}
                             for name, info in sorted(gif_info.items())},
    }
    return DualBuild(images, gifs, dual_json, manifest, motion["frame_ms"])


def save_gif(frames: List[Image.Image], path: Path, frame_ms: int) -> None:
    paletted = [frame.convert("P", palette=Image.ADAPTIVE, colors=255) for frame in frames]
    paletted[0].save(path, format="GIF", save_all=True, append_images=paletted[1:], duration=frame_ms, loop=0,
                     optimize=False, disposal=1)


def write_outputs(result: DualBuild, output_dir: Path, input_paths: List[Path]) -> List[Path]:
    output_dir = output_dir.resolve()
    resolved_inputs = {p.resolve() for p in input_paths}
    names = list(result.images) + list(result.gifs) + [OUTPUT_JSON, OUTPUT_MANIFEST]
    for name in names:
        if (output_dir / name) in resolved_inputs:
            raise AssemblyError(f"output would overwrite an input: {output_dir / name}")
    output_dir.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".staging-", dir=output_dir))
    try:
        for name, image in result.images.items():
            image.save(staging / name, format="PNG")
        gif_files = {}
        for name, frames in result.gifs.items():
            save_gif(frames, staging / name, result.frame_ms)
            gif_files[name] = hashlib.sha256((staging / name).read_bytes()).hexdigest()
        manifest = dict(result.manifest)
        manifest["animated_outputs"] = {name: dict(info, file_sha256=gif_files[name])
                                        for name, info in result.manifest["animated_outputs"].items()}
        for name, data in ((OUTPUT_JSON, result.dual_json), (OUTPUT_MANIFEST, manifest)):
            with open(staging / name, "w", encoding="ascii", newline="\n") as handle:
                handle.write(aw.json_text(data))
        for name in names:  # manifest last
            os.replace(staging / name, output_dir / name)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    return [output_dir / name for name in names]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate the blue / red wrestler sprites as rigid objects: 360 deg "
                                                 "rotation, faceoff and minimal rigid-motion previews.")
    parser.add_argument("--recipe", type=Path, default=DEFAULT_RECIPE, help="explicit per-sprite recipe + motion paths")
    parser.add_argument("--input-dir", type=Path, default=aw.DEFAULT_INPUT_DIR, help="directory with the reviewed sprites")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="local output directory")
    parser.add_argument("--arena-dir", type=Path, default=aw.DEFAULT_ARENA_DIR,
                        help="committed Product arena runtime assets")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        recipe = load_recipe(args.recipe)
        result = build(recipe, args.input_dir, args.arena_dir)
        inputs = [args.input_dir / recipe["sprites"][key]["file"] for key in SPRITES] + [args.recipe]
        written = write_outputs(result, args.output_dir, inputs)
    except AssemblyError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for path in written:
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
