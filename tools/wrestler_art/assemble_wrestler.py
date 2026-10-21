"""Deterministic wrestler parts extraction + idle assembly preview for SumoSim.

Offline asset-production tool (ART-WRESTLER-02A). AI draws isolated parts;
this tool owns the human assembly. Nothing here is used by the game runtime
(Phaser / TypeScript) and it changes no gameplay value.

    isolated Product parts -> explicit regions / pivots / joints
        -> deterministic assembly preview -> User Visual Approval
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
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import PIL
from PIL import Image, ImageDraw, ImageFilter, ImageFont

TOOL_NAME = "sumosim-wrestler-art"
TOOL_VERSION = "0.1.0"
MANIFEST_SCHEMA = 1
PARTS_SCHEMA = 1
RECIPE_SCHEMA = 1

TOOL_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOL_DIR.parent.parent
DEFAULT_RECIPE = TOOL_DIR / "base_parts_recipe.json"
DEFAULT_INPUT_DIR = TOOL_DIR / "input.local"
DEFAULT_OUTPUT_DIR = TOOL_DIR / "output-assembly.local"
DEFAULT_ARENA_DIR = REPO_ROOT / "public" / "assets" / "action" / "background"

# Accepted presentation scale (Do Not Reopen): gameplay bodyRadius 0.35 m on the
# 2.275 m ring that the runtime art draws with a 400 px radius.
BODY_RADIUS_M = 0.35
RING_RADIUS_M = 2.275
RING_RADIUS_PX = 400
R_RUNTIME = BODY_RADIUS_M * RING_RADIUS_PX / RING_RADIUS_M  # ~61.54 px
# Master working scale = runtime x 4; runtime previews downscale by exactly 4.
MASTER_FACTOR = 4
R_MASTER = R_RUNTIME * MASTER_FACTOR  # ~246.15 px

# Transparent margin around each normalized part (spec minimum: 16 master px).
PART_PADDING_MASTER = 24
# Square preview canvas half size, in R (the root sits at the canvas center).
PREVIEW_HALF_R = 2.4

PART_NAMES = ("torso", "mawashi", "upper_arm", "forearm_hand", "head", "foot")
MIRRORED_PARTS = ("upper_arm", "forearm_hand", "foot")
TORSO_JOINTS = ("shoulder_r", "head", "mawashi")

# Accepted Product arena (runtime 1920x1080, ring center at the canvas center).
ARENA_SIZE = (1920, 1080)
ARENA_CENTER = (960.0, 540.0)
ARENA_BASE_FILE = "arena_base_1920.png"
ARENA_OVERLAY_FILE = "dohyo_ring_overlay_1920.png"
# Prototype start positions (BoutScene PROTOTYPE_SETUP): x = -/+0.7 m, y = 0.
START_OFFSET_M = 0.7

# Preview-only shadow, same geometry as the current procedural WrestlerView.
SHADOW_SIZE_R = (2.25, 2.0)
SHADOW_ALPHA = 0.28
SHADOW_OFFSET_R = (0.07, 0.12)
SHADOW_BLUR_RUNTIME_PX = 2.0

ANGLES_DEG = (0, 45, 90, 180)

OUTPUT_PART_FILES = {name: f"{name}_master.png" for name in PART_NAMES}
OUTPUT_IDLE_MASTER = "idle_master.png"
OUTPUT_IDLE_RUNTIME = "idle_runtime.png"
OUTPUT_IDLE_ANGLES = "idle_runtime_4angles.png"
OUTPUT_ARENA = "idle_on_arena_1920.png"
OUTPUT_GUIDE = "pivot_guide.png"
OUTPUT_PARTS_JSON = "parts.json"
OUTPUT_MANIFEST = "build_manifest.json"

GUIDE_BACKGROUND = (46, 50, 58, 255)
ANGLES_BACKGROUND = (104, 100, 96, 255)
GUIDE_BODY = (90, 220, 110)
GUIDE_ROOT = (255, 255, 255)
GUIDE_SHOULDER = (235, 60, 60)
GUIDE_ELBOW = (255, 160, 40)
GUIDE_HAND = (255, 235, 60)
GUIDE_HEAD = (60, 210, 235)
GUIDE_MAWASHI = (120, 140, 255)
GUIDE_FOOT = (235, 80, 220)

Vec = Tuple[float, float]


class AssemblyError(Exception):
    """Fail-closed error: the run stops and writes nothing."""


@dataclass
class Part:
    image: Image.Image  # RGBA, axis along +x
    pivot: Vec  # image px (pixel edges on integers)
    joints: Dict[str, Vec] = field(default_factory=dict)


@dataclass
class BuildResult:
    images: Dict[str, Image.Image]
    parts_json: dict
    manifest: dict


# ---------------------------------------------------------------- helpers


def _ceil4(value: float) -> int:
    return int(math.ceil(value / 4.0 - 1e-9)) * 4


def _rot(v: Vec, angle: float) -> Vec:
    c, s = math.cos(angle), math.sin(angle)
    return (v[0] * c - v[1] * s, v[0] * s + v[1] * c)


def _add(a: Vec, b: Vec) -> Vec:
    return (a[0] + b[0], a[1] + b[1])


def _sub(a: Vec, b: Vec) -> Vec:
    return (a[0] - b[0], a[1] - b[1])


def _mul(a: Vec, k: float) -> Vec:
    return (a[0] * k, a[1] * k)


def _r6(v: Vec) -> List[float]:
    return [round(v[0], 6), round(v[1], 6)]


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pixel_sha256(image: Image.Image) -> str:
    """SHA-256 of the decoded pixel bytes in the image's own mode (row-major)."""
    return hashlib.sha256(image.tobytes()).hexdigest()


def rgba_pixel_sha256(image: Image.Image) -> str:
    """Canonical source identity: SHA-256 of the decoded RGBA bytes, row-major."""
    return pixel_sha256(image.convert("RGBA"))


def alpha_bbox(image: Image.Image, threshold: int) -> Optional[Tuple[int, int, int, int]]:
    return image.getchannel("A").point(lambda a: 255 if a > threshold else 0).getbbox()


def place(image: Image.Image, canvas_size: Tuple[int, int], pivot: Vec, position: Vec, angle: float,
          resample: int) -> Image.Image:
    """Draw `image` on a transparent canvas: its `pivot` lands on `position`, rotated by `angle`
    (rad, +x toward +y, i.e. clockwise on screen like Phaser). Premultiplied resampling."""
    c, s = math.cos(angle), math.sin(angle)
    # canvas point q -> image point p = pivot + Rot(-angle) (q - position)
    data = (
        c, s, pivot[0] - (c * position[0] + s * position[1]),
        -s, c, pivot[1] - (-s * position[0] + c * position[1]),
    )
    out = image.convert("RGBa").transform(canvas_size, Image.AFFINE, data, resample=resample,
                                          fillcolor=(0, 0, 0, 0))
    return out.convert("RGBA")


# ---------------------------------------------------------------- recipe / sources


def load_recipe(path: Path) -> dict:
    if not path.is_file():
        raise AssemblyError(f"recipe not found: {path}")
    try:
        recipe = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise AssemblyError(f"recipe is not readable JSON: {path}: {exc}") from exc
    validate_recipe(recipe)
    return recipe


def _box(value, label: str) -> Tuple[int, int, int, int]:
    if not (isinstance(value, list) and len(value) == 4 and all(isinstance(v, int) for v in value)):
        raise AssemblyError(f"{label}: box must be 4 integers")
    x0, y0, x1, y1 = value
    if x1 <= x0 or y1 <= y0:
        raise AssemblyError(f"{label}: empty box {value}")
    return x0, y0, x1, y1


def _point(value, label: str) -> Vec:
    if not (isinstance(value, list) and len(value) == 2 and all(isinstance(v, (int, float)) for v in value)):
        raise AssemblyError(f"{label}: point must be 2 numbers")
    return float(value[0]), float(value[1])


def validate_recipe(recipe: dict) -> None:
    if recipe.get("recipe_schema") != RECIPE_SCHEMA:
        raise AssemblyError(f"unsupported recipe_schema {recipe.get('recipe_schema')!r}")
    sources = recipe.get("sources", {})
    parts = recipe.get("parts", {})
    for name in PART_NAMES:
        if name not in parts:
            raise AssemblyError(f"recipe is missing part {name!r}")
    # The original parts-sheet torso is REJECTED: the torso comes only from the replacement source.
    if parts["torso"].get("source") != "torso":
        raise AssemblyError("torso must come from the replacement torso source, never from the parts sheet")
    for name, spec in parts.items():
        if name not in PART_NAMES:
            raise AssemblyError(f"unknown part {name!r}")
        if spec.get("source") not in sources:
            raise AssemblyError(f"part {name!r}: unknown source {spec.get('source')!r}")
        box = _box(spec.get("box"), f"part {name!r}")
        width, height = sources[spec["source"]]["size"]
        if box[0] < 0 or box[1] < 0 or box[2] > width or box[3] > height:
            raise AssemblyError(f"part {name!r}: box {list(box)} is outside the source")
        scale = spec.get("scale", {})
        points = [("pivot", spec.get("pivot"))] + [(k, v) for k, v in spec.get("joints", {}).items()]
        if scale.get("measure") == "distance":
            points += [("scale.from", scale.get("from")), ("scale.to", scale.get("to"))]
        # A pivot may sit outside the crop (e.g. the shoulder rotation center under a cropped joint cap),
        # but every point must be on the source.
        for label, point in points:
            x, y = _point(point, f"part {name!r} {label}")
            if not (0 <= x <= width and 0 <= y <= height):
                raise AssemblyError(f"part {name!r}: {label} {point} is outside the source")
        if scale.get("measure") not in ("alpha_height", "pivot_to_joint", "distance"):
            raise AssemblyError(f"part {name!r}: unknown scale measure {scale.get('measure')!r}")
        if scale.get("measure") == "pivot_to_joint" and scale.get("joint") not in spec.get("joints", {}):
            raise AssemblyError(f"part {name!r}: scale joint {scale.get('joint')!r} is not defined")
        if not (isinstance(scale.get("target_r"), (int, float)) and scale["target_r"] > 0):
            raise AssemblyError(f"part {name!r}: scale target_r must be > 0")
        if "axis_to" in spec and spec["axis_to"] not in spec.get("joints", {}):
            raise AssemblyError(f"part {name!r}: axis joint {spec['axis_to']!r} is not defined")
    for joint in TORSO_JOINTS:
        if joint not in parts["torso"].get("joints", {}):
            raise AssemblyError(f"torso joint {joint!r} is missing")
    for name in ("upper_arm", "forearm_hand", "foot"):
        if "axis_to" not in parts[name]:
            raise AssemblyError(f"part {name!r} needs an explicit axis joint")
    for rejected in recipe.get("rejected_regions", []):
        if rejected.get("source") not in sources:
            raise AssemblyError(f"rejected region: unknown source {rejected.get('source')!r}")
        _box(rejected.get("box"), "rejected region")
    if sorted(recipe.get("layers", [])) != sorted(PART_NAMES):
        raise AssemblyError("layers must list every part exactly once")
    idle = recipe.get("idle", {})
    for key in ("upper_arm_angle_deg", "forearm_angle_deg", "foot_angle_deg"):
        if not isinstance(idle.get(key), (int, float)):
            raise AssemblyError(f"idle.{key} must be a number")
    _point(idle.get("foot_ankle"), "idle.foot_ankle")


def load_source(path: Path, spec: dict, label: str) -> Tuple[Image.Image, dict]:
    if not path.is_file():
        raise AssemblyError(f"{label}: source missing: {path}")
    try:
        with Image.open(path) as opened:
            opened.load()
            image = opened.copy()
    except (OSError, ValueError) as exc:
        raise AssemblyError(f"{label}: not a readable image: {path}: {exc}") from exc
    expected_size = tuple(spec["size"])
    if image.size != expected_size:
        raise AssemblyError(f"{label}: size {image.size[0]}x{image.size[1]} != reviewed "
                            f"{expected_size[0]}x{expected_size[1]}")
    has_alpha = "A" in image.getbands() or "transparency" in image.info
    if not has_alpha:
        raise AssemblyError(f"{label}: no alpha channel (mode {image.mode})")
    rgba = image.convert("RGBA")
    if rgba.getchannel("A").getextrema()[0] == 255:
        raise AssemblyError(f"{label}: alpha channel is fully opaque (no meaningful transparency)")
    pixel_hash = pixel_sha256(rgba)
    if pixel_hash != spec["pixel_sha256"]:
        raise AssemblyError(f"{label}: decoded RGBA pixel SHA-256 {pixel_hash} != reviewed {spec['pixel_sha256']}")
    actual_file_hash = file_sha256(path)
    info = {
        "file": path.name,
        "size": list(image.size),
        "decoded_mode": image.mode,
        "pixel_sha256": pixel_hash,
        "file_sha256": actual_file_hash,
        "reviewed_file_sha256": spec.get("reviewed_file_sha256"),
        # Informational only: a lossless re-encode changes bytes but not pixels.
        "file_sha256_matches_reviewed": actual_file_hash == spec.get("reviewed_file_sha256"),
    }
    return rgba, info


def check_rejected_regions(recipe: dict, sources: Dict[str, Image.Image]) -> None:
    """No part crop may contain a visible pixel of a rejected region (the original sheet torso)."""
    threshold = recipe["alpha_threshold"]
    for name, spec in recipe["parts"].items():
        bx0, by0, bx1, by1 = spec["box"]
        for rejected in recipe.get("rejected_regions", []):
            if rejected["source"] != spec["source"]:
                continue
            rx0, ry0, rx1, ry1 = rejected["box"]
            ix0, iy0, ix1, iy1 = max(bx0, rx0), max(by0, ry0), min(bx1, rx1), min(by1, ry1)
            if ix0 >= ix1 or iy0 >= iy1:
                continue
            overlap = sources[spec["source"]].crop((ix0, iy0, ix1, iy1))
            if alpha_bbox(overlap, threshold) is not None:
                raise AssemblyError(f"part {name!r}: crop {spec['box']} includes visible pixels of rejected "
                                    f"region {rejected['box']} ({rejected.get('reason', '')})")


# ---------------------------------------------------------------- extraction / normalization


def extract_part(name: str, spec: dict, source: Image.Image, threshold: int) -> Tuple[Part, dict]:
    """Explicit crop -> axis to +x (only for parts with an axis joint) -> uniform scale to master R."""
    x0, y0, x1, y1 = spec["box"]
    if x0 < 0 or y0 < 0 or x1 > source.width or y1 > source.height:
        raise AssemblyError(f"part {name!r}: box {spec['box']} is outside the source")
    region = source.crop((x0, y0, x1, y1))
    pivot = _sub(tuple(spec["pivot"]), (x0, y0))
    joints = {k: _sub(tuple(v), (x0, y0)) for k, v in spec.get("joints", {}).items()}
    if alpha_bbox(region, threshold) is None:
        raise AssemblyError(f"part {name!r}: crop {spec['box']} is empty")

    axis_angle = 0.0
    if "axis_to" in spec:
        d = _sub(joints[spec["axis_to"]], pivot)
        if math.hypot(*d) <= 0:
            raise AssemblyError(f"part {name!r}: axis length is 0")
        axis_angle = math.atan2(d[1], d[0])
    if axis_angle != 0.0:
        # Rotate at source resolution so the part axis points exactly +x (one extra resample).
        corners = [_rot(_sub(c, pivot), -axis_angle) for c in
                   [(0, 0), (region.width, 0), (0, region.height), (region.width, region.height), pivot]]
        min_x = math.floor(min(c[0] for c in corners)) - 2
        min_y = math.floor(min(c[1] for c in corners)) - 2
        size = (math.ceil(max(c[0] for c in corners)) + 2 - min_x, math.ceil(max(c[1] for c in corners)) + 2 - min_y)
        new_pivot = (float(-min_x), float(-min_y))
        region = place(region, size, pivot, new_pivot, -axis_angle, Image.BICUBIC)
        joints = {k: _add(new_pivot, _rot(_sub(v, pivot), -axis_angle)) for k, v in joints.items()}
        pivot = new_pivot

    bbox = alpha_bbox(region, threshold)
    if bbox is None:
        raise AssemblyError(f"part {name!r}: empty after axis alignment")
    scale_spec = spec["scale"]
    if scale_spec["measure"] == "alpha_height":
        measured = float(bbox[3] - bbox[1])
    elif scale_spec["measure"] == "distance":
        measured = math.hypot(*_sub(tuple(scale_spec["to"]), tuple(scale_spec["from"])))
    else:
        measured = math.hypot(*_sub(joints[scale_spec["joint"]], pivot))
    if measured <= 0:
        raise AssemblyError(f"part {name!r}: scale reference length is 0")
    scale = scale_spec["target_r"] * R_MASTER / measured

    pad = PART_PADDING_MASTER
    # Content extents around the pivot (>= 0 keeps a pivot outside the content inside the canvas).
    left = max(0.0, (pivot[0] - bbox[0]) * scale)
    right = max(0.0, (bbox[2] - pivot[0]) * scale)
    top = max(0.0, (pivot[1] - bbox[1]) * scale)
    bottom = max(0.0, (bbox[3] - pivot[1]) * scale)
    # Pivot on a multiple of 4 master px so the runtime (/4) pivot is an integer pixel edge.
    pivot_out = (float(_ceil4(left + pad)), float(_ceil4(top + pad)))
    size = (_ceil4(pivot_out[0] + right + pad), _ceil4(pivot_out[1] + bottom + pad))

    offset = max(abs(pivot[0]), abs(pivot[1]), abs(pivot[0] - region.width), abs(pivot[1] - region.height))
    margin = int(math.ceil(max(size) / scale + offset)) + 4
    padded = Image.new("RGBA", (region.width + 2 * margin, region.height + 2 * margin), (0, 0, 0, 0))
    padded.paste(region, (margin, margin))
    p = _add(pivot, (margin, margin))
    box = (p[0] - pivot_out[0] / scale, p[1] - pivot_out[1] / scale,
           p[0] + (size[0] - pivot_out[0]) / scale, p[1] + (size[1] - pivot_out[1]) / scale)
    master = padded.resize(size, Image.LANCZOS, box=box)
    master_joints = {k: _add(pivot_out, _mul(_sub(v, pivot), scale)) for k, v in joints.items()}

    info = {
        "source": spec["source"],
        "crop_box": list(spec["box"]),
        "source_pivot": list(spec["pivot"]),
        "source_joints": {k: list(v) for k, v in spec.get("joints", {}).items()},
        "source_axis_angle_deg": round(math.degrees(axis_angle), 6),
        "aligned_alpha_bbox": list(bbox),
        "scale_measure": scale_spec["measure"],
        "scale_measured_source_px": round(measured, 6),
        "scale_target_r": scale_spec["target_r"],
        "scale": round(scale, 9),
    }
    return Part(master, pivot_out, master_joints), info


def mirror_part(part: Part) -> Part:
    """Left side = mirror across the local X axis (image top-bottom flip): y -> H - y."""
    height = part.image.height
    return Part(
        part.image.transpose(Image.FLIP_TOP_BOTTOM),
        (part.pivot[0], height - part.pivot[1]),
        {k: (v[0], height - v[1]) for k, v in part.joints.items()},
    )


def runtime_part(part: Part) -> Part:
    """Exact /4 downscale (master sizes are multiples of 4; pivots scale exactly)."""
    w, h = part.image.size
    k = 1.0 / MASTER_FACTOR
    return Part(
        part.image.resize((w // MASTER_FACTOR, h // MASTER_FACTOR), Image.LANCZOS),
        _mul(part.pivot, k),
        {name: _mul(v, k) for name, v in part.joints.items()},
    )


# ---------------------------------------------------------------- assembly


def idle_geometry(parts: Dict[str, Part], recipe: dict) -> dict:
    """Local idle geometry in R (root = participant center, +x FRONT, +y wrestler's RIGHT)."""
    torso = parts["torso"]

    def torso_anchor(joint: str) -> Vec:
        return _mul(_sub(torso.joints[joint], torso.pivot), 1.0 / R_MASTER)

    idle = recipe["idle"]
    shoulder_r = torso_anchor("shoulder_r")
    upper_len = math.hypot(*_sub(parts["upper_arm"].joints["elbow"], parts["upper_arm"].pivot)) / R_MASTER
    fore_len = math.hypot(*_sub(parts["forearm_hand"].joints["hand"], parts["forearm_hand"].pivot)) / R_MASTER
    upper_angle = math.radians(idle["upper_arm_angle_deg"])
    fore_angle = math.radians(idle["forearm_angle_deg"])
    elbow_r = _add(shoulder_r, _mul((math.cos(upper_angle), math.sin(upper_angle)), upper_len))
    hand_r = _add(elbow_r, _mul((math.cos(fore_angle), math.sin(fore_angle)), fore_len))
    ankle_r = tuple(idle["foot_ankle"])
    foot_angle = math.radians(idle["foot_angle_deg"])
    toe_len = math.hypot(*_sub(parts["foot"].joints["toe"], parts["foot"].pivot)) / R_MASTER
    toe_r = _add(ankle_r, _mul((math.cos(foot_angle), math.sin(foot_angle)), toe_len))

    def left(v: Vec) -> Vec:
        return (v[0], -v[1])

    return {
        "torso": (0.0, 0.0),
        "head": torso_anchor("head"),
        "mawashi": torso_anchor("mawashi"),
        "shoulder_r": shoulder_r, "shoulder_l": left(shoulder_r),
        "elbow_r": elbow_r, "elbow_l": left(elbow_r),
        "hand_r": hand_r, "hand_l": left(hand_r),
        "ankle_r": ankle_r, "ankle_l": left(ankle_r),
        "toe_r": toe_r, "toe_l": left(toe_r),
        "upper_arm_angle_r": upper_angle, "forearm_angle_r": fore_angle, "foot_angle_r": foot_angle,
        "upper_arm_length_r": upper_len, "forearm_length_r": fore_len,
    }


def idle_placements(geometry: dict, layers: List[str]) -> List[Tuple[str, str, Vec, float]]:
    """(part, side, local position in R, local angle) in draw order. side: '' | 'l' | 'r'."""
    g = geometry
    by_part = {
        "foot": [("foot", "l", g["ankle_l"], -g["foot_angle_r"]), ("foot", "r", g["ankle_r"], g["foot_angle_r"])],
        "torso": [("torso", "", g["torso"], 0.0)],
        "mawashi": [("mawashi", "", g["mawashi"], 0.0)],
        "upper_arm": [("upper_arm", "l", g["shoulder_l"], -g["upper_arm_angle_r"]),
                      ("upper_arm", "r", g["shoulder_r"], g["upper_arm_angle_r"])],
        "forearm_hand": [("forearm_hand", "l", g["elbow_l"], -g["forearm_angle_r"]),
                         ("forearm_hand", "r", g["elbow_r"], g["forearm_angle_r"])],
        "head": [("head", "", g["head"], 0.0)],
    }
    return [placement for layer in layers for placement in by_part[layer]]


def render_wrestler(canvas: Image.Image, parts: Dict[str, Part], placements, r_px: float, root: Vec,
                    facing: float, resample: int) -> None:
    """Composite one wrestler onto `canvas` (RGBA) with its root at `root`, rotated by `facing`."""
    for name, side, local, local_angle in placements:
        part = parts[name + ("_l" if side == "l" else "")]
        position = _add(root, _rot(_mul(local, r_px), facing))
        canvas.alpha_composite(place(part.image, canvas.size, part.pivot, position, facing + local_angle, resample))


def shadow_part(r_px: float) -> Part:
    """Preview-only soft shadow (not a source part): ellipse 2.25R x 2.0R, alpha 0.28."""
    supersample = 4
    w = _ceil4(SHADOW_SIZE_R[0] * r_px + 8 * SHADOW_BLUR_RUNTIME_PX)
    h = _ceil4(SHADOW_SIZE_R[1] * r_px + 8 * SHADOW_BLUR_RUNTIME_PX)
    big = Image.new("L", (w * supersample, h * supersample), 0)
    ex, ey = SHADOW_SIZE_R[0] * r_px * supersample / 2, SHADOW_SIZE_R[1] * r_px * supersample / 2
    cx, cy = w * supersample / 2, h * supersample / 2
    ImageDraw.Draw(big).ellipse((cx - ex, cy - ey, cx + ex, cy + ey), fill=round(255 * SHADOW_ALPHA))
    alpha = big.resize((w, h), Image.BOX).filter(ImageFilter.GaussianBlur(SHADOW_BLUR_RUNTIME_PX))
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow.putalpha(alpha)
    return Part(shadow, (w / 2, h / 2))


# ---------------------------------------------------------------- previews


def _font(size: int) -> ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


def build_angles_preview(parts: Dict[str, Part], placements, tile: int) -> Image.Image:
    label_h = 30
    sheet = Image.new("RGBA", (tile * len(ANGLES_DEG), tile + label_h), ANGLES_BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    font = _font(18)
    for i, deg in enumerate(ANGLES_DEG):
        layer = Image.new("RGBA", (tile, tile), (0, 0, 0, 0))
        render_wrestler(layer, parts, placements, R_RUNTIME, (tile / 2, tile / 2), math.radians(deg), Image.BILINEAR)
        sheet.alpha_composite(layer, (i * tile, label_h))
        draw.text((i * tile + 8, 6), f"facing {deg}°", fill=(255, 255, 255, 255), font=font)
    return sheet


def build_arena_preview(arena_dir: Path, parts: Dict[str, Part], placements) -> Tuple[Image.Image, dict]:
    images = []
    infos = {}
    for file_name in (ARENA_BASE_FILE, ARENA_OVERLAY_FILE):
        path = arena_dir / file_name
        if not path.is_file():
            raise AssemblyError(f"arena asset missing: {path}")
        with Image.open(path) as opened:
            opened.load()
            image = opened.convert("RGBA")
        if image.size != ARENA_SIZE:
            raise AssemblyError(f"arena asset {file_name} is not {ARENA_SIZE[0]}x{ARENA_SIZE[1]}")
        images.append(image)
        infos[file_name] = {"file_sha256": file_sha256(path), "pixel_sha256": rgba_pixel_sha256(image)}
    canvas = images[0]
    canvas.alpha_composite(images[1])
    px_per_m = RING_RADIUS_PX / RING_RADIUS_M
    wrestlers = [
        ((ARENA_CENTER[0] - START_OFFSET_M * px_per_m, ARENA_CENTER[1]), 0.0),
        ((ARENA_CENTER[0] + START_OFFSET_M * px_per_m, ARENA_CENTER[1]), math.pi),
    ]
    shadow = shadow_part(R_RUNTIME)
    for root, facing in wrestlers:  # shadows below both bodies
        position = _add(root, _mul(SHADOW_OFFSET_R, R_RUNTIME))
        canvas.alpha_composite(place(shadow.image, canvas.size, shadow.pivot, position, facing, Image.BILINEAR))
    for root, facing in wrestlers:
        render_wrestler(canvas, parts, placements, R_RUNTIME, root, facing, Image.BILINEAR)
    info = {
        "assets": infos,
        "wrestlers": [{"root_px": _r6(root), "facing_deg": round(math.degrees(facing), 6)} for root, facing in wrestlers],
        "shadow": {"size_r": list(SHADOW_SIZE_R), "alpha": SHADOW_ALPHA, "world_offset_r": list(SHADOW_OFFSET_R),
                   "blur_runtime_px": SHADOW_BLUR_RUNTIME_PX},
    }
    return canvas.convert("RGB"), info


def build_pivot_guide(idle_master: Image.Image, geometry: dict) -> Image.Image:
    guide = Image.new("RGBA", idle_master.size, GUIDE_BACKGROUND)
    guide.alpha_composite(idle_master)
    draw = ImageDraw.Draw(guide)
    half = idle_master.width / 2
    root = (half, idle_master.height / 2)

    def px(local: Vec) -> Vec:
        return _add(root, _mul(local, R_MASTER))

    draw.ellipse((root[0] - R_MASTER, root[1] - R_MASTER, root[0] + R_MASTER, root[1] + R_MASTER),
                 outline=GUIDE_BODY, width=3)
    # Body axis: +x FRONT.
    front = px((1.9, 0.0))
    draw.line((px((-1.9, 0.0)), front), fill=GUIDE_ROOT, width=2)
    draw.polygon((front, _add(front, (-22, -11)), _add(front, (-22, 11))), fill=GUIDE_ROOT)
    font = _font(26)
    draw.text(_add(front, (-150, 14)), "+X FRONT", fill=GUIDE_ROOT, font=font)
    draw.text(_add(px((-1.9, 0.0)), (4, 14)), "-X BACK", fill=GUIDE_ROOT, font=font)
    draw.text(_add(px((-0.25, 2.2)), (0, 0)), "+Y RIGHT", fill=GUIDE_ROOT, font=font)
    draw.text(_add(px((-0.25, -2.3)), (0, 0)), "-Y LEFT", fill=GUIDE_ROOT, font=font)

    def mark(local: Vec, color, radius: float = 9) -> None:
        x, y = px(local)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=(0, 0, 0), fill=color, width=2)

    for side in ("l", "r"):
        draw.line((px(geometry[f"shoulder_{side}"]), px(geometry[f"elbow_{side}"]), px(geometry[f"hand_{side}"])),
                  fill=GUIDE_ELBOW, width=3)
        draw.line((px(geometry[f"ankle_{side}"]), px(geometry[f"toe_{side}"])), fill=GUIDE_FOOT, width=3)
        mark(geometry[f"shoulder_{side}"], GUIDE_SHOULDER)
        mark(geometry[f"elbow_{side}"], GUIDE_ELBOW)
        mark(geometry[f"hand_{side}"], GUIDE_HAND)
        mark(geometry[f"ankle_{side}"], GUIDE_FOOT)
    mark(geometry["mawashi"], GUIDE_MAWASHI, 7)
    mark(geometry["head"], GUIDE_HEAD)
    x, y = root
    draw.line((x - 14, y, x + 14, y), fill=GUIDE_ROOT, width=3)
    draw.line((x, y - 14, x, y + 14), fill=GUIDE_ROOT, width=3)

    legend = [
        (GUIDE_ROOT, "root = participant center"),
        (GUIDE_BODY, "gameplay body circle R (runtime ~123 px diameter)"),
        (GUIDE_SHOULDER, "shoulder pivot"),
        (GUIDE_ELBOW, "elbow joint"),
        (GUIDE_HAND, "hand end"),
        (GUIDE_HEAD, "head pivot"),
        (GUIDE_MAWASHI, "mawashi pivot"),
        (GUIDE_FOOT, "foot ankle pivot -> toe"),
    ]
    small = _font(20)
    for i, (color, text) in enumerate(legend):
        y0 = 12 + i * 26
        draw.rectangle((12, y0 + 3, 28, y0 + 19), fill=color)
        draw.text((36, y0), text, fill=(235, 235, 235), font=small)
    draw.text((12, guide.height - 34), f"master: R = {R_MASTER:.3f} px (runtime x{MASTER_FACTOR})",
              fill=(235, 235, 235), font=small)
    return guide.convert("RGB")


# ---------------------------------------------------------------- build


def build(recipe: dict, input_dir: Path, arena_dir: Path) -> BuildResult:
    sources: Dict[str, Image.Image] = {}
    source_infos: Dict[str, dict] = {}
    for key, spec in recipe["sources"].items():
        sources[key], source_infos[key] = load_source(input_dir / spec["file"], spec, key)
    check_rejected_regions(recipe, sources)

    threshold = recipe["alpha_threshold"]
    master: Dict[str, Part] = {}
    part_infos: Dict[str, dict] = {}
    for name in PART_NAMES:
        master[name], part_infos[name] = extract_part(name, recipe["parts"][name], sources[recipe["parts"][name]["source"]],
                                                      threshold)
    for name in MIRRORED_PARTS:
        master[name + "_l"] = mirror_part(master[name])
    runtime = {name: runtime_part(part) for name, part in master.items()}

    geometry = idle_geometry(master, recipe)
    placements = idle_placements(geometry, recipe["layers"])

    master_side = _ceil4(2 * PREVIEW_HALF_R * R_MASTER)
    idle_master = Image.new("RGBA", (master_side, master_side), (0, 0, 0, 0))
    render_wrestler(idle_master, master, placements, R_MASTER, (master_side / 2, master_side / 2), 0.0, Image.BICUBIC)
    runtime_side = master_side // MASTER_FACTOR
    idle_runtime = Image.new("RGBA", (runtime_side, runtime_side), (0, 0, 0, 0))
    render_wrestler(idle_runtime, runtime, placements, R_RUNTIME, (runtime_side / 2, runtime_side / 2), 0.0,
                    Image.BILINEAR)
    for label, image in (("idle_master", idle_master), ("idle_runtime", idle_runtime)):
        bbox = alpha_bbox(image, 0)
        if bbox is None or bbox[0] == 0 or bbox[1] == 0 or bbox[2] == image.width or bbox[3] == image.height:
            raise AssemblyError(f"{label}: assembled wrestler touches the preview canvas edge (clipped)")

    angles = build_angles_preview(runtime, placements, runtime_side)
    arena, arena_info = build_arena_preview(arena_dir, runtime, placements)
    guide = build_pivot_guide(idle_master, geometry)

    images: Dict[str, Image.Image] = {OUTPUT_PART_FILES[name]: master[name].image for name in PART_NAMES}
    images.update({
        OUTPUT_IDLE_MASTER: idle_master,
        OUTPUT_IDLE_RUNTIME: idle_runtime,
        OUTPUT_IDLE_ANGLES: angles,
        OUTPUT_ARENA: arena,
        OUTPUT_GUIDE: guide,
    })

    parts_json = {
        "schema": PARTS_SCHEMA,
        "tool": TOOL_NAME,
        "coordinates": "image px, pixel edges on integers, +x right, +y down; local frame: +x FRONT, +y wrestler RIGHT",
        "r_master_px": round(R_MASTER, 6),
        "r_runtime_px": round(R_RUNTIME, 6),
        "runtime_downscale": MASTER_FACTOR,
        "mirror": "left part = source/right part flipped top-bottom (local y -> -y); pivot/joints (x, H - y)",
        "parts": {},
        "torso_anchors_r": {
            "shoulder_r": _r6(geometry["shoulder_r"]),
            "shoulder_l": _r6(geometry["shoulder_l"]),
            "head": _r6(geometry["head"]),
            "mawashi": _r6(geometry["mawashi"]),
        },
    }
    for name in PART_NAMES:
        part = master[name]
        entry = {
            "file": OUTPUT_PART_FILES[name],
            "size": list(part.image.size),
            "pivot": _r6(part.pivot),
            "joints": {k: _r6(v) for k, v in part.joints.items()},
            "mirrored_for_left": name in MIRRORED_PARTS,
            "crop": part_infos[name],
        }
        if name == "upper_arm":
            entry["length_master_px"] = round(geometry["upper_arm_length_r"] * R_MASTER, 6)
            entry["length_r"] = round(geometry["upper_arm_length_r"], 6)
        if name == "forearm_hand":
            entry["length_master_px"] = round(geometry["forearm_length_r"] * R_MASTER, 6)
            entry["length_r"] = round(geometry["forearm_length_r"], 6)
        parts_json["parts"][name] = entry
    parts_json["idle_r"] = {
        key: _r6(value) for key, value in geometry.items() if isinstance(value, tuple)
    }
    parts_json["idle_angles_deg"] = {
        "upper_arm_r": recipe["idle"]["upper_arm_angle_deg"],
        "forearm_r": recipe["idle"]["forearm_angle_deg"],
        "foot_r": recipe["idle"]["foot_angle_deg"],
        "left": "negated (mirror)",
    }
    parts_json["layers"] = list(recipe["layers"])

    outputs = {
        name: {"size": list(image.size), "mode": image.mode, "pixel_sha256": pixel_sha256(image)}
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
        "sources": source_infos,
        "scale": {
            "body_radius_m": BODY_RADIUS_M,
            "ring_radius_m": RING_RADIUS_M,
            "ring_radius_px": RING_RADIUS_PX,
            "r_runtime_px": round(R_RUNTIME, 6),
            "master_factor": MASTER_FACTOR,
            "r_master_px": round(R_MASTER, 6),
            "part_padding_master_px": PART_PADDING_MASTER,
            "preview_canvas_master_px": master_side,
            "preview_canvas_runtime_px": runtime_side,
        },
        "arena_preview": arena_info,
        "parts_json_sha256": hashlib.sha256(json_text(parts_json).encode("ascii")).hexdigest(),
        "outputs": outputs,
    }
    return BuildResult(images, parts_json, manifest)


def json_text(data: dict) -> str:
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=True) + "\n"


def write_outputs(result: BuildResult, output_dir: Path, input_paths: List[Path]) -> List[Path]:
    output_dir = output_dir.resolve()
    resolved_inputs = {p.resolve() for p in input_paths}
    names = list(result.images) + [OUTPUT_PARTS_JSON, OUTPUT_MANIFEST]
    for name in names:
        if (output_dir / name) in resolved_inputs:
            raise AssemblyError(f"output would overwrite an input: {output_dir / name}")
    output_dir.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".staging-", dir=output_dir))
    try:
        for name, image in result.images.items():
            image.save(staging / name, format="PNG")
        for name, data in ((OUTPUT_PARTS_JSON, result.parts_json), (OUTPUT_MANIFEST, result.manifest)):
            with open(staging / name, "w", encoding="ascii", newline="\n") as handle:
                handle.write(json_text(data))
        for name in names:  # manifest last
            os.replace(staging / name, output_dir / name)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    return [output_dir / name for name in names]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Extract the reviewed wrestler parts and build the idle assembly previews.")
    parser.add_argument("--recipe", type=Path, default=DEFAULT_RECIPE, help="explicit region / pivot / joint recipe")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR, help="directory with the reviewed sources")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="local output directory")
    parser.add_argument("--arena-dir", type=Path, default=DEFAULT_ARENA_DIR, help="committed Product arena runtime assets")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        recipe = load_recipe(args.recipe)
        result = build(recipe, args.input_dir, args.arena_dir)
        inputs = [args.input_dir / spec["file"] for spec in recipe["sources"].values()]
        written = write_outputs(result, args.output_dir, inputs + [args.recipe])
    except AssemblyError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for path in written:
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
