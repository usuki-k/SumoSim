"""Deterministic dohyo art compositor for SumoSim Product art.

Offline asset-production tool. AI/artist source images go in; exact ring
geometry and deterministic composition come out. Nothing here is used by the
game runtime (Phaser / TypeScript).

    AI/Artist Sources -> Deterministic Geometry/Composition -> Review/Runtime Assets
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

import numpy as np
from PIL import Image

TOOL_NAME = "sumosim-dohyo-art"
TOOL_VERSION = "1.0.0"
MANIFEST_SCHEMA = 4

# Product art space (accepted). The CLI always renders this master size.
MASTER_SIZE = (3840, 2160)

# Arena input may differ from 16:9 by at most 0.2 %. For the accepted
# 1672x941 source that is ~3 px of width: an imperceptible center crop.
# Anything larger would be a material crop and fails closed.
ASPECT_TOLERANCE = 0.002

# Arena alignment may zoom in at most 25 %: enough to cover a center
# correction, small enough not to visibly soften the painted arena.
MAX_ARENA_SCALE = 1.25

# Warm off-white for shikiri lines on the accepted clay arena.
SHIKIRI_COLOR = (238, 230, 211)

# Smallest usable tawara strip after alpha crop + trim (source px).
MIN_STRIP_WIDTH = 16
MIN_STRIP_HEIGHT = 4

OUTPUT_ARENA_MASTER = "arena_base_master.png"
OUTPUT_OVERLAY_MASTER = "dohyo_ring_overlay_master.png"
OUTPUT_GUIDE_MASTER = "geometry_guide_master.png"
OUTPUT_COMPOSITE_MASTER = "composite_master.png"
OUTPUT_OVERLAY_1920 = "dohyo_ring_overlay_1920.png"
OUTPUT_PREVIEW_1920 = "composite_preview_1920.png"
OUTPUT_ARENA_1920 = "arena_base_1920.png"  # runtime base layer (under the 1920 overlay)
OUTPUT_MANIFEST = "build_manifest.json"

# Geometry guide colors (developer reference only).
GUIDE_OUTER = (235, 60, 60)
GUIDE_INNER = (255, 170, 40)
GUIDE_PROTECTED = (60, 200, 235)
GUIDE_SHIKIRI = (120, 235, 90)
GUIDE_CENTER = (255, 255, 255)
GUIDE_PARTICIPANT = (235, 80, 220)
GUIDE_TOKUDAWARA = (255, 235, 60)

# Each Tokudawara maps the tile with its own local angle; this fraction of the
# tile sits on the section's axis, so all four sections look identical.
TOKUDAWARA_TEXTURE_PHASE = 0.5


class CompositorError(Exception):
    """Invalid input or parameter. The CLI exits non-zero without writing."""


@dataclass(frozen=True)
class Geometry:
    """Master-space geometry in px. Circle center is the canvas center."""

    canvas_width: int = MASTER_SIZE[0]
    canvas_height: int = MASTER_SIZE[1]
    outer_radius: float = 800.0
    tawara_width: float = 42.0
    shikiri_offset_x: float = 124.0
    shikiri_length: float = 280.0
    shikiri_width: float = 24.0
    protected_radius: float = 1064.0
    participant_offset_x: float = 246.0
    # Four cardinal Tokudawara (+x, +y, -x, -y). depth 0 = disabled (plain circle).
    tokudawara_depth: float = 0.0
    tokudawara_half_angle_deg: float = 0.0

    @property
    def tokudawara_enabled(self) -> bool:
        return self.tokudawara_depth > 0

    @property
    def max_outer_radius(self) -> float:
        return self.outer_radius + self.tokudawara_depth

    @property
    def center_x(self) -> float:
        return self.canvas_width / 2

    @property
    def center_y(self) -> float:
        return self.canvas_height / 2

    @property
    def inner_radius(self) -> float:
        return self.outer_radius - self.tawara_width

    @property
    def preview_size(self) -> Tuple[int, int]:
        return (self.canvas_width // 2, self.canvas_height // 2)

    def shikiri_rects(self) -> List[Tuple[float, float, float, float]]:
        """(x0, y0, x1, y1) continuous-space rectangles, left then right."""
        half_w = self.shikiri_width / 2
        half_l = self.shikiri_length / 2
        rects = []
        for sign in (-1, 1):
            cx = self.center_x + sign * self.shikiri_offset_x
            rects.append((cx - half_w, self.center_y - half_l, cx + half_w, self.center_y + half_l))
        return rects


@dataclass(frozen=True)
class TextureOptions:
    repeat: Optional[int] = None  # None = auto (preserve source aspect)
    trim_start: float = 0.06
    trim_end: float = 0.06
    seam_crossfade: float = 0.05
    alpha_threshold: int = 8


@dataclass(frozen=True)
class ArenaAlignment:
    """Aligns painted arena content to the fixed canvas center.

    Uniform scale about the canvas center, then translation in master px
    (+x right, +y down). Identity by default; Product values are passed
    explicitly on the command line (see README).
    """

    scale: float = 1.0
    offset_x: float = 0.0
    offset_y: float = 0.0


@dataclass
class BuildResult:
    images: Dict[str, Image.Image]
    manifest: dict


# ---------------------------------------------------------------- validation


def validate_geometry(g: Geometry) -> None:
    def finite(name: str, value: float) -> None:
        if not math.isfinite(value):
            raise CompositorError(f"{name} must be finite (got {value})")

    for name in (
        "outer_radius",
        "tawara_width",
        "shikiri_offset_x",
        "shikiri_length",
        "shikiri_width",
        "protected_radius",
        "participant_offset_x",
        "tokudawara_depth",
        "tokudawara_half_angle_deg",
    ):
        finite(name, getattr(g, name))

    if g.canvas_width <= 0 or g.canvas_height <= 0:
        raise CompositorError("canvas size must be positive")
    if g.canvas_width % 2 or g.canvas_height % 2:
        raise CompositorError("canvas size must be even (preview is an exact 1/2 downscale)")
    if g.outer_radius <= 0:
        raise CompositorError(f"outer radius must be > 0 (got {g.outer_radius})")
    if g.tawara_width <= 0:
        raise CompositorError(f"tawara width must be > 0 (got {g.tawara_width})")
    if g.inner_radius <= 0:
        raise CompositorError(
            f"inner radius must be > 0 (outer {g.outer_radius} - width {g.tawara_width})"
        )
    if (
        g.center_x - g.outer_radius < 0
        or g.center_x + g.outer_radius > g.canvas_width
        or g.center_y - g.outer_radius < 0
        or g.center_y + g.outer_radius > g.canvas_height
    ):
        raise CompositorError(
            f"ring (outer radius {g.outer_radius}) exceeds canvas {g.canvas_width}x{g.canvas_height}"
        )
    if g.protected_radius < g.outer_radius:
        raise CompositorError("protected radius must be >= outer radius")

    if g.shikiri_length <= 0 or g.shikiri_width <= 0:
        raise CompositorError("shikiri length and width must be > 0")
    if g.shikiri_offset_x - g.shikiri_width / 2 <= 0:
        raise CompositorError("shikiri lines overlap at the center (offset-x <= width / 2)")
    far_x = g.shikiri_offset_x + g.shikiri_width / 2
    far_y = g.shikiri_length / 2
    if math.hypot(far_x, far_y) >= g.inner_radius:
        raise CompositorError("shikiri lines must lie strictly inside the inner tawara radius")
    if g.participant_offset_x < 0:
        raise CompositorError("participant offset-x must be >= 0")

    if g.tokudawara_depth < 0:
        raise CompositorError(f"tokudawara depth must be >= 0 (got {g.tokudawara_depth})")
    if g.tokudawara_enabled:
        if not 0 < g.tokudawara_half_angle_deg < 45:
            raise CompositorError(
                f"tokudawara half angle must be within (0, 45) degrees (got {g.tokudawara_half_angle_deg})"
            )
        if g.tokudawara_depth > g.tawara_width:
            # Deeper sections would leave a radial gap between the normal and shifted tawara
            # at the side connection (no separate connector piece is drawn).
            raise CompositorError(
                f"tokudawara depth must be <= tawara width {g.tawara_width} (got {g.tokudawara_depth})"
            )
        if (
            g.center_x - g.max_outer_radius < 0
            or g.center_x + g.max_outer_radius > g.canvas_width
            or g.center_y - g.max_outer_radius < 0
            or g.center_y + g.max_outer_radius > g.canvas_height
        ):
            raise CompositorError(
                f"tokudawara (outer radius {g.max_outer_radius}) exceeds canvas {g.canvas_width}x{g.canvas_height}"
            )


def validate_alignment(a: ArenaAlignment) -> None:
    for name in ("scale", "offset_x", "offset_y"):
        if not math.isfinite(getattr(a, name)):
            raise CompositorError(f"arena {name} must be finite (got {getattr(a, name)})")
    if not 1.0 <= a.scale <= MAX_ARENA_SCALE:
        raise CompositorError(f"arena scale must be within [1, {MAX_ARENA_SCALE}] (got {a.scale})")


def validate_texture_options(t: TextureOptions) -> None:
    if t.repeat is not None and t.repeat < 1:
        raise CompositorError(f"repeat must be >= 1 (got {t.repeat})")
    for name in ("trim_start", "trim_end"):
        value = getattr(t, name)
        if not (math.isfinite(value) and 0 <= value <= 0.45):
            raise CompositorError(f"{name} must be within [0, 0.45] (got {value})")
    if t.trim_start + t.trim_end >= 0.9:
        raise CompositorError("trim-start + trim-end must be < 0.9")
    if not (math.isfinite(t.seam_crossfade) and 0 <= t.seam_crossfade <= 0.45):
        raise CompositorError(f"seam crossfade must be within [0, 0.45] (got {t.seam_crossfade})")
    if not 0 <= t.alpha_threshold <= 254:
        raise CompositorError(f"alpha threshold must be within [0, 254] (got {t.alpha_threshold})")


# ------------------------------------------------------------------- helpers


def _round_half_up(value: float) -> int:
    return int(math.floor(value + 0.5))


def _load_image(path: Path, label: str) -> Image.Image:
    if not path.is_file():
        raise CompositorError(f"{label} not found: {path}")
    try:
        with Image.open(path) as image:
            image.load()
            return image.copy()
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise CompositorError(f"{label} is not a readable image: {path} ({error})") from error


def _file_info(path: Path, image: Image.Image) -> dict:
    data = path.read_bytes()
    return {
        "file": path.name,
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
        "size": list(image.size),
        "mode": image.mode,
    }


def pixel_sha256(image: Image.Image) -> str:
    header = f"{image.mode}:{image.size[0]}x{image.size[1]}:".encode("ascii")
    return hashlib.sha256(header + image.tobytes()).hexdigest()


def _to_premultiplied(rgba: np.ndarray) -> np.ndarray:
    out = rgba.astype(np.float64) / 255.0
    out[..., :3] *= out[..., 3:4]
    return out


def _to_straight_u8(premult: np.ndarray) -> np.ndarray:
    alpha = np.clip(premult[..., 3:4], 0.0, 1.0)
    safe = np.where(alpha > 0, alpha, 1.0)
    rgb = np.where(alpha > 0, np.clip(premult[..., :3] / safe, 0.0, 1.0), 0.0)
    straight = np.concatenate([rgb, alpha], axis=-1)
    return np.floor(straight * 255.0 + 0.5).astype(np.uint8)


def _resize_premultiplied(premult: np.ndarray, size: Tuple[int, int]) -> np.ndarray:
    """Lanczos resize of a premultiplied float RGBA array, channel by channel."""
    channels = []
    for c in range(4):
        channel = Image.fromarray(premult[..., c].astype(np.float32))
        channels.append(np.asarray(channel.resize(size, Image.Resampling.LANCZOS), dtype=np.float64))
    out = np.clip(np.stack(channels, axis=-1), 0.0, 1.0)
    out[..., :3] = np.minimum(out[..., :3], out[..., 3:4])
    return out


def _axis_coverage(count: int, lo: float, hi: float) -> np.ndarray:
    """Exact fraction of each unit pixel [i, i+1] covered by [lo, hi]."""
    edges = np.arange(count, dtype=np.float64)
    return np.clip(np.minimum(edges + 1, hi) - np.maximum(edges, lo), 0.0, 1.0)


def _distance_field(g: Geometry, x0: int, y0: int, x1: int, y1: int) -> np.ndarray:
    xs = np.arange(x0, x1, dtype=np.float64) + 0.5 - g.center_x
    ys = np.arange(y0, y1, dtype=np.float64) + 0.5 - g.center_y
    return np.hypot(xs[np.newaxis, :], ys[:, np.newaxis])


# ------------------------------------------------------------- arena normalize


def required_arena_scale(size: Tuple[int, int], offset_x: float, offset_y: float) -> float:
    """Smallest uniform scale about the canvas center that still covers the canvas after the offset."""
    return max(1 + abs(offset_x) / (size[0] / 2), 1 + abs(offset_y) / (size[1] / 2))


def aligned_source_box(
    box: Tuple[float, float, float, float], size: Tuple[int, int], alignment: ArenaAlignment
) -> Tuple[float, float, float, float]:
    """Source-space box for: normalized 16:9 box -> scale about canvas center -> translate -> crop.

    Output pixel X samples normalized-master x = (X - cx - offset_x) / scale + cx,
    which maps linearly back into the source box. Composing everything into one
    box keeps it a single resample.
    """
    if alignment == ArenaAlignment():
        return box
    width, height = size
    cx, cy = width / 2, height / 2
    kx = (box[2] - box[0]) / width
    ky = (box[3] - box[1]) / height

    def src_x(x: float) -> float:
        return box[0] + ((x - cx - alignment.offset_x) / alignment.scale + cx) * kx

    def src_y(y: float) -> float:
        return box[1] + ((y - cy - alignment.offset_y) / alignment.scale + cy) * ky

    aligned = (src_x(0), src_y(0), src_x(width), src_y(height))
    eps = 1e-9
    if (
        aligned[0] < box[0] - eps
        or aligned[1] < box[1] - eps
        or aligned[2] > box[2] + eps
        or aligned[3] > box[3] + eps
    ):
        needed = required_arena_scale(size, alignment.offset_x, alignment.offset_y)
        raise CompositorError(
            f"arena scale {alignment.scale} with offset ({alignment.offset_x}, {alignment.offset_y}) "
            f"leaves canvas pixels uncovered; scale must be >= {needed:.6f}"
        )
    return aligned


def normalize_arena(
    image: Image.Image, size: Tuple[int, int], alignment: ArenaAlignment = ArenaAlignment()
) -> Tuple[Image.Image, dict, dict]:
    validate_alignment(alignment)
    rgba = image.convert("RGBA")
    alpha_min = rgba.getchannel("A").getextrema()[0]
    if alpha_min != 255:
        raise CompositorError("arena base must be fully opaque")

    width, height = image.size
    target = size[0] / size[1]
    aspect = width / height
    mismatch = aspect / target - 1
    if abs(mismatch) > ASPECT_TOLERANCE:
        raise CompositorError(
            f"arena aspect {aspect:.5f} differs from {target:.5f} by {mismatch:+.3%} "
            f"(tolerance {ASPECT_TOLERANCE:.1%}); refusing a material crop"
        )

    if aspect > target:
        crop_w, crop_h = height * target, float(height)
    else:
        crop_w, crop_h = float(width), width / target
    box = ((width - crop_w) / 2, (height - crop_h) / 2, (width + crop_w) / 2, (height + crop_h) / 2)
    source_box = aligned_source_box(box, size, alignment)
    normalized = rgba.convert("RGB").resize(size, Image.Resampling.LANCZOS, box=source_box)

    info = {
        "source_aspect": round(aspect, 6),
        "target_aspect": round(target, 6),
        "aspect_mismatch": round(mismatch, 6),
        "aspect_tolerance": ASPECT_TOLERANCE,
        "crop_box": [round(v, 4) for v in box],
        "scale": round(size[0] / crop_w, 6),
        "resample": "LANCZOS",
        "output_size": list(normalized.size),
        "output_mode": normalized.mode,
    }
    alignment_info = {
        "scale": alignment.scale,
        "offset_x": alignment.offset_x,
        "offset_y": alignment.offset_y,
        "units": "master px; +offset_x moves arena content right, +offset_y moves it down",
        "transform_order": "16:9 normalize -> uniform scale about canvas center -> translate -> crop "
        "to canvas (composed into one LANCZOS resample)",
        "min_scale_for_offset": round(required_arena_scale(size, alignment.offset_x, alignment.offset_y), 6),
        "coverage": "full (aligned box inside the normalized 16:9 source region)",
        "source_box": [round(v, 4) for v in source_box],
        "intended_anchor": "painted main dohyo/platform top surface center -> canvas center",
    }
    return normalized, info, alignment_info


# ----------------------------------------------------------- tawara texture


def prepare_tawara_strip(image: Image.Image, opts: TextureOptions) -> Tuple[np.ndarray, dict]:
    """Alpha-crop + end-trim the source. Returns premultiplied float RGBA."""
    bands = image.getbands()
    if "A" not in bands and "a" not in bands and "transparency" not in image.info:
        raise CompositorError("tawara source must have an alpha channel (RGBA)")
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8)

    mask = rgba[..., 3] > opts.alpha_threshold
    if not mask.any():
        raise CompositorError(
            f"tawara source has no pixels with alpha > {opts.alpha_threshold} (empty alpha)"
        )
    rows = np.flatnonzero(mask.any(axis=1))
    cols = np.flatnonzero(mask.any(axis=0))
    bx0, bx1 = int(cols[0]), int(cols[-1]) + 1
    by0, by1 = int(rows[0]), int(rows[-1]) + 1
    if bx1 - bx0 < by1 - by0:
        raise CompositorError("tawara source must be a horizontal strip (alpha bbox wider than tall)")

    crop_w = bx1 - bx0
    trim_start_px = _round_half_up(crop_w * opts.trim_start)
    trim_end_px = _round_half_up(crop_w * opts.trim_end)
    sx0, sx1 = bx0 + trim_start_px, bx1 - trim_end_px
    if sx1 - sx0 < MIN_STRIP_WIDTH:
        raise CompositorError("tawara strip is too narrow after trimming")

    # Re-crop vertically to what remains (frayed ends may be taller than the body).
    trimmed_mask = mask[by0:by1, sx0:sx1]
    trimmed_rows = np.flatnonzero(trimmed_mask.any(axis=1))
    if trimmed_rows.size == 0:
        raise CompositorError("tawara strip has empty alpha after trimming")
    sy0, sy1 = by0 + int(trimmed_rows[0]), by0 + int(trimmed_rows[-1]) + 1
    if sy1 - sy0 < MIN_STRIP_HEIGHT:
        raise CompositorError("tawara strip is too thin after cropping")

    strip = _to_premultiplied(rgba[sy0:sy1, sx0:sx1])
    info = {
        "alpha_threshold": opts.alpha_threshold,
        "alpha_bbox": [bx0, by0, bx1, by1],
        "trim_start": opts.trim_start,
        "trim_end": opts.trim_end,
        "trim_px": [trim_start_px, trim_end_px],
        "strip_box": [sx0, sy0, sx1, sy1],
        "strip_size": [sx1 - sx0, sy1 - sy0],
    }
    return strip, info


def make_seamless_tile(strip: np.ndarray, crossfade_px: int) -> np.ndarray:
    """Fold the last `crossfade_px` columns into the first ones (linear crossfade).

    The result tiles horizontally: its last column continues into the strip's
    column at width - crossfade_px, which is what its first column now shows.
    """
    width = strip.shape[1]
    if crossfade_px <= 0:
        return strip.copy()
    tile = strip[:, : width - crossfade_px].copy()
    weight = ((np.arange(crossfade_px, dtype=np.float64) + 0.5) / crossfade_px)[np.newaxis, :, np.newaxis]
    tile[:, :crossfade_px] = strip[:, width - crossfade_px :] * (1 - weight) + strip[:, :crossfade_px] * weight
    return tile


def resolve_repeat(g: Geometry, tile_size: Tuple[int, int], requested: Optional[int]) -> int:
    if requested is not None:
        return requested
    tile_w, tile_h = tile_size
    period_on_ring = tile_w * g.tawara_width / tile_h
    mid_circumference = 2 * math.pi * (g.outer_radius - g.tawara_width / 2)
    return max(1, _round_half_up(mid_circumference / period_on_ring))


def resample_tile(tile: np.ndarray, size: Tuple[int, int]) -> np.ndarray:
    """Lanczos-resize a horizontally periodic tile without edge artifacts at the wrap."""
    width, height = size
    padded = np.concatenate([tile, tile, tile], axis=1)
    resized = _resize_premultiplied(padded, (width * 3, height))
    return resized[:, width : width * 2]


def _sample_bilinear(tex: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Bilinear sample at pixel-center coordinates; u wraps, v clamps."""
    tex_h, tex_w = tex.shape[:2]
    u_floor = np.floor(u)
    fu = (u - u_floor)[:, np.newaxis]
    u0 = u_floor.astype(np.int64) % tex_w
    u1 = (u0 + 1) % tex_w
    v = np.clip(v, 0.0, tex_h - 1)
    v_floor = np.floor(v)
    fv = (v - v_floor)[:, np.newaxis]
    v0 = v_floor.astype(np.int64)
    v1 = np.minimum(v0 + 1, tex_h - 1)
    top = tex[v0, u0] * (1 - fu) + tex[v0, u1] * fu
    bottom = tex[v1, u0] * (1 - fu) + tex[v1, u1] * fu
    return top * (1 - fv) + bottom * fv


# --------------------------------------------------------------- rendering


def tokudawara_window_distance(g: Geometry, dx: np.ndarray, dy: np.ndarray) -> np.ndarray:
    """Signed distance (px) from the nearest Tokudawara side boundary; > 0 inside a window.

    Folds the point into the first octant (|x|, |y| and swap are exact), so all four
    cardinal windows and both of their sides are computed identically.
    """
    ax, ay = np.abs(dx), np.abs(dy)
    along, across = np.maximum(ax, ay), np.minimum(ax, ay)
    half = math.radians(g.tokudawara_half_angle_deg)
    return along * math.sin(half) - across * math.cos(half)


def _tokudawara_local_angle(dx: np.ndarray, dy: np.ndarray) -> np.ndarray:
    """Angle relative to the nearest cardinal axis (exact 90 degree rotations)."""
    horizontal = np.abs(dx) >= np.abs(dy)
    lx = np.where(horizontal, np.abs(dx), np.abs(dy))
    ly = np.where(horizontal, np.where(dx >= 0, dy, -dy), np.where(dy >= 0, -dx, dx))
    return np.arctan2(ly, lx)


def _band_coverage(dist: np.ndarray, outer: float, width: float) -> np.ndarray:
    return np.clip(outer - dist + 0.5, 0.0, 1.0) * np.clip(dist - (outer - width) + 0.5, 0.0, 1.0)


def render_tawara_ring_tokudawara(g: Geometry, tex: np.ndarray, repeat: int, out: np.ndarray) -> None:
    """Normal ring plus four cardinal sections shifted outward by `tokudawara_depth`.

    Inside a window (|angle - k*pi/2| <= half angle) only the shifted band is drawn,
    outside it only the normal band; the side boundary is the radial line at the window
    edge, anti-aliased by its signed distance. The shifted band reuses the same tile,
    mapped by the section's local angle.
    """
    tex_h, tex_w = tex.shape[:2]
    reach = g.max_outer_radius
    x0 = max(0, int(math.floor(g.center_x - reach)) - 1)
    x1 = min(g.canvas_width, int(math.ceil(g.center_x + reach)) + 1)
    y0 = max(0, int(math.floor(g.center_y - reach)) - 1)
    y1 = min(g.canvas_height, int(math.ceil(g.center_y + reach)) + 1)

    dist = _distance_field(g, x0, y0, x1, y1)
    dx, dy = np.broadcast_arrays(
        (np.arange(x0, x1, dtype=np.float64) + 0.5 - g.center_x)[np.newaxis, :],
        (np.arange(y0, y1, dtype=np.float64) + 0.5 - g.center_y)[:, np.newaxis],
    )
    inside = np.clip(tokudawara_window_distance(g, dx, dy) + 0.5, 0.0, 1.0)
    shifted_outer = g.max_outer_radius
    weight_normal = _band_coverage(dist, g.outer_radius, g.tawara_width) * (1 - inside)
    weight_shifted = _band_coverage(dist, shifted_outer, g.tawara_width) * inside
    hit = (weight_normal + weight_shifted) > 0

    hdx, hdy, hdist = dx[hit], dy[hit], dist[hit]
    u_normal = np.arctan2(hdy, hdx) / (2 * math.pi) * repeat * tex_w - 0.5
    v_normal = (g.outer_radius - hdist) / g.tawara_width * tex_h - 0.5
    u_shifted = (
        _tokudawara_local_angle(hdx, hdy) / (2 * math.pi) * repeat * tex_w
        + TOKUDAWARA_TEXTURE_PHASE * tex_w
        - 0.5
    )
    v_shifted = (shifted_outer - hdist) / g.tawara_width * tex_h - 0.5

    sampled = _sample_bilinear(tex, u_normal, v_normal) * weight_normal[hit][:, np.newaxis]
    sampled += _sample_bilinear(tex, u_shifted, v_shifted) * weight_shifted[hit][:, np.newaxis]
    window = out[y0:y1, x0:x1]
    window[hit] = sampled


def render_tawara_ring(g: Geometry, tex: np.ndarray, repeat: int, out: np.ndarray) -> None:
    """Polar-map `tex` onto the exact annulus, writing premultiplied RGBA into `out`.

    angle -> texture u (repeats `repeat` times around 2*pi)
    radius -> texture v (outer edge = top row, inner edge = bottom row)
    Edges use analytic 1 px coverage; texture alpha is multiplied in.
    With Tokudawara enabled the separate renderer above is used; this path is unchanged.
    """
    if g.tokudawara_enabled:
        render_tawara_ring_tokudawara(g, tex, repeat, out)
        return
    tex_h, tex_w = tex.shape[:2]
    x0 = max(0, int(math.floor(g.center_x - g.outer_radius)) - 1)
    x1 = min(g.canvas_width, int(math.ceil(g.center_x + g.outer_radius)) + 1)
    y0 = max(0, int(math.floor(g.center_y - g.outer_radius)) - 1)
    y1 = min(g.canvas_height, int(math.ceil(g.center_y + g.outer_radius)) + 1)

    dist = _distance_field(g, x0, y0, x1, y1)
    coverage = np.clip(g.outer_radius - dist + 0.5, 0.0, 1.0) * np.clip(
        dist - g.inner_radius + 0.5, 0.0, 1.0
    )
    hit = coverage > 0
    ys, xs = np.nonzero(hit)
    dx = xs + x0 + 0.5 - g.center_x
    dy = ys + y0 + 0.5 - g.center_y
    angle = np.arctan2(dy, dx)
    u = angle / (2 * math.pi) * repeat * tex_w - 0.5
    v = (g.outer_radius - dist[hit]) / g.tawara_width * tex_h - 0.5

    sampled = _sample_bilinear(tex, u, v) * coverage[hit][:, np.newaxis]
    window = out[y0:y1, x0:x1]
    window[hit] = sampled


def render_shikiri(g: Geometry, out: np.ndarray) -> None:
    """Composite exact anti-aliased shikiri rectangles over `out` (premultiplied)."""
    color = np.array(SHIKIRI_COLOR + (255,), dtype=np.float64) / 255.0
    for rx0, ry0, rx1, ry1 in g.shikiri_rects():
        x0, x1 = max(0, int(math.floor(rx0))), min(g.canvas_width, int(math.ceil(rx1)))
        y0, y1 = max(0, int(math.floor(ry0))), min(g.canvas_height, int(math.ceil(ry1)))
        cov_x = _axis_coverage(x1 - x0, rx0 - x0, rx1 - x0)
        cov_y = _axis_coverage(y1 - y0, ry0 - y0, ry1 - y0)
        coverage = (cov_y[:, np.newaxis] * cov_x[np.newaxis, :])[..., np.newaxis]
        window = out[y0:y1, x0:x1]
        window[...] = color * coverage + window * (1 - coverage)


def build_overlay(g: Geometry, tex: np.ndarray, repeat: int) -> Image.Image:
    premult = np.zeros((g.canvas_height, g.canvas_width, 4), dtype=np.float64)
    render_tawara_ring(g, tex, repeat, premult)
    render_shikiri(g, premult)
    return Image.fromarray(_to_straight_u8(premult))


def build_guide(g: Geometry, composite: Image.Image) -> Image.Image:
    """Developer guide: dimmed composite + exact reference geometry. No text/fonts."""
    canvas = np.asarray(composite.convert("RGB"), dtype=np.float32) / 255.0 * 0.5
    line = max(1.0, float(_round_half_up(g.canvas_width / 960)))
    dist = _distance_field(g, 0, 0, g.canvas_width, g.canvas_height)

    def paint(coverage: np.ndarray, color: Tuple[int, int, int]) -> None:
        cov = coverage.astype(np.float32)[..., np.newaxis]
        rgb = np.array(color, dtype=np.float32) / 255.0
        canvas[...] = rgb * cov + canvas * (1 - cov)

    def ring(radius: float, color: Tuple[int, int, int]) -> None:
        paint(np.clip(line / 2 - np.abs(dist - radius) + 0.5, 0.0, 1.0), color)

    def rect(x0: float, y0: float, x1: float, y1: float, color: Tuple[int, int, int]) -> None:
        cov_x = _axis_coverage(g.canvas_width, x0, x1)
        cov_y = _axis_coverage(g.canvas_height, y0, y1)
        paint(cov_y[:, np.newaxis] * cov_x[np.newaxis, :], color)

    def outline(x0: float, y0: float, x1: float, y1: float, color: Tuple[int, int, int]) -> None:
        rect(x0, y0, x1, y0 + line, color)
        rect(x0, y1 - line, x1, y1, color)
        rect(x0, y0, x0 + line, y1, color)
        rect(x1 - line, y0, x1, y1, color)

    def cross(cx: float, cy: float, arm: float, color: Tuple[int, int, int]) -> None:
        rect(cx - arm, cy - line / 2, cx + arm, cy + line / 2, color)
        rect(cx - line / 2, cy - arm, cx + line / 2, cy + arm, color)

    ring(g.protected_radius, GUIDE_PROTECTED)
    ring(g.outer_radius, GUIDE_OUTER)
    ring(g.inner_radius, GUIDE_INNER)
    if g.tokudawara_enabled:
        # Future Ring-out boundary in the windows: outer arcs at R + depth and the radial
        # side boundaries from R to R + depth (all eight via the folded frame).
        dx, dy = np.broadcast_arrays(
            (np.arange(g.canvas_width, dtype=np.float64) + 0.5 - g.center_x)[np.newaxis, :],
            (np.arange(g.canvas_height, dtype=np.float64) + 0.5 - g.center_y)[:, np.newaxis],
        )
        signed = tokudawara_window_distance(g, dx, dy)
        inside = np.clip(signed + line / 2 + 0.5, 0.0, 1.0)
        paint(np.clip(line / 2 - np.abs(dist - g.max_outer_radius) + 0.5, 0.0, 1.0) * inside, GUIDE_TOKUDAWARA)
        half = math.radians(g.tokudawara_half_angle_deg)
        ax, ay = np.abs(dx), np.abs(dy)
        along = np.maximum(ax, ay) * math.cos(half) + np.minimum(ax, ay) * math.sin(half)
        span = np.clip(along - g.outer_radius + line / 2 + 0.5, 0.0, 1.0) * np.clip(
            g.max_outer_radius + line / 2 - along + 0.5, 0.0, 1.0
        )
        paint(np.clip(line / 2 - np.abs(signed) + 0.5, 0.0, 1.0) * span, GUIDE_TOKUDAWARA)
    for x0, y0, x1, y1 in g.shikiri_rects():
        outline(x0, y0, x1, y1, GUIDE_SHIKIRI)
    arm = g.outer_radius * 0.04
    for sign in (-1, 1):
        cross(g.center_x + sign * g.participant_offset_x, g.center_y, arm, GUIDE_PARTICIPANT)
    cross(g.center_x, g.center_y, arm * 1.5, GUIDE_CENTER)

    return Image.fromarray(np.floor(canvas * 255.0 + 0.5).astype(np.uint8))


# ----------------------------------------------------------------- compose


def compose(
    arena_path: Path,
    tawara_path: Path,
    geometry: Geometry = Geometry(),
    texture: TextureOptions = TextureOptions(),
    alignment: ArenaAlignment = ArenaAlignment(),
) -> BuildResult:
    validate_geometry(geometry)
    validate_texture_options(texture)
    validate_alignment(alignment)

    arena_source = _load_image(arena_path, "arena base")
    tawara_source = _load_image(tawara_path, "tawara source")

    canvas_size = (geometry.canvas_width, geometry.canvas_height)
    arena, arena_info, alignment_info = normalize_arena(arena_source, canvas_size, alignment)

    strip, texture_info = prepare_tawara_strip(tawara_source, texture)
    strip_w = strip.shape[1]
    crossfade_px = _round_half_up(strip_w * texture.seam_crossfade)
    tile = make_seamless_tile(strip, crossfade_px)
    tile_size = (tile.shape[1], tile.shape[0])
    repeat = resolve_repeat(geometry, tile_size, texture.repeat)

    mid_circumference = 2 * math.pi * (geometry.outer_radius - geometry.tawara_width / 2)
    ring_tile_size = (
        max(2, _round_half_up(mid_circumference / repeat)),
        max(2, _round_half_up(geometry.tawara_width)),
    )
    ring_tex = resample_tile(tile, ring_tile_size)

    overlay = build_overlay(geometry, ring_tex, repeat)
    composite = Image.alpha_composite(arena.convert("RGBA"), overlay).convert("RGB")
    guide = build_guide(geometry, composite)
    preview_size = geometry.preview_size
    overlay_small = overlay.resize(preview_size, Image.Resampling.BOX)
    preview = composite.resize(preview_size, Image.Resampling.BOX)
    arena_small = arena.resize(preview_size, Image.Resampling.BOX)

    images = {
        OUTPUT_ARENA_MASTER: arena,
        OUTPUT_OVERLAY_MASTER: overlay,
        OUTPUT_GUIDE_MASTER: guide,
        OUTPUT_COMPOSITE_MASTER: composite,
        OUTPUT_OVERLAY_1920: overlay_small,
        OUTPUT_PREVIEW_1920: preview,
        OUTPUT_ARENA_1920: arena_small,
    }

    texture_info.update(
        {
            "seam": "linear crossfade of strip end into strip start (premultiplied)",
            "seam_crossfade": texture.seam_crossfade,
            "seam_crossfade_px": crossfade_px,
            "tile_period_px": tile_size[0],
            "repeat_requested": "auto" if texture.repeat is None else texture.repeat,
            "repeat": repeat,
            "ring_tile_size": list(ring_tile_size),
            "ring_tile_resample": "LANCZOS (premultiplied, wrap-padded)",
            "ring_sampling": "polar: angle->u (wraps), radius->v (outer=top); bilinear",
            "edge_antialias": "analytic 1px coverage x texture alpha",
        }
    )
    g = geometry
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "tool": TOOL_NAME,
        "tool_version": TOOL_VERSION,
        "inputs": {
            "arena_base": _file_info(arena_path, arena_source),
            "tawara_source": _file_info(tawara_path, tawara_source),
        },
        "arena_normalization": arena_info,
        "arena_alignment": alignment_info,
        "geometry": {
            "space": "master",
            "canvas_size": [g.canvas_width, g.canvas_height],
            "center": [g.center_x, g.center_y],
            "outer_radius": g.outer_radius,
            "inner_radius": g.inner_radius,
            "tawara_width": g.tawara_width,
            "protected_radius": g.protected_radius,
            "shikiri": {
                "offset_x": g.shikiri_offset_x,
                "centers": [[g.center_x - g.shikiri_offset_x, g.center_y], [g.center_x + g.shikiri_offset_x, g.center_y]],
                "length": g.shikiri_length,
                "width": g.shikiri_width,
                "orientation": "length along Y",
                "color": list(SHIKIRI_COLOR),
            },
            "participant_guide_centers": [
                [g.center_x - g.participant_offset_x, g.center_y],
                [g.center_x + g.participant_offset_x, g.center_y],
            ],
        },
        "tokudawara": tokudawara_info(g),
        "tawara_texture": texture_info,
        "downscale": {
            "size": list(preview_size),
            "resample": "BOX (exact 2x2 area average; RGBA premultiplied by Pillow)",
        },
        "outputs": [
            {
                "file": name,
                "size": list(image.size),
                "mode": image.mode,
                "pixel_sha256": pixel_sha256(image),
            }
            for name, image in images.items()
        ],
    }
    return BuildResult(images=images, manifest=manifest)


def tokudawara_info(g: Geometry) -> dict:
    if not g.tokudawara_enabled:
        return {"enabled": False}
    return {
        "enabled": True,
        "count": 4,
        "directions": "cardinal (+x, +y, -x, -y)",
        "depth": g.tokudawara_depth,
        "half_angle_deg": g.tokudawara_half_angle_deg,
        "window": "|angle - k*pi/2| <= half_angle (closed)",
        "outer_radius": g.max_outer_radius,
        "inner_radius": g.max_outer_radius - g.tawara_width,
        "side_boundary": "radial line at the window edge, from outer_radius R to R + depth",
        "normal_band_inside_window": "absent",
        "texture_mapping": f"same tile; local angle per section, tile phase {TOKUDAWARA_TEXTURE_PHASE} on the axis",
    }


def manifest_text(manifest: dict) -> str:
    return json.dumps(manifest, indent=2, ensure_ascii=True) + "\n"


def write_outputs(result: BuildResult, output_dir: Path, input_paths: List[Path]) -> List[Path]:
    """Stage every file, then move them into place. Nothing is touched on failure."""
    if output_dir.exists() and not output_dir.is_dir():
        raise CompositorError(f"output dir is not a directory: {output_dir}")
    names = list(result.images) + [OUTPUT_MANIFEST]
    resolved_inputs = {p.resolve() for p in input_paths}
    for name in names:
        if (output_dir / name).resolve() in resolved_inputs:
            raise CompositorError(f"output {output_dir / name} would overwrite an input file")

    output_dir.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".staging-", dir=output_dir))
    try:
        for name, image in result.images.items():
            image.save(staging / name, format="PNG")
        with open(staging / OUTPUT_MANIFEST, "w", encoding="ascii", newline="\n") as handle:
            handle.write(manifest_text(result.manifest))
        written = []
        for name in names:  # manifest last
            os.replace(staging / name, output_dir / name)
            written.append(output_dir / name)
        return written
    finally:
        shutil.rmtree(staging, ignore_errors=True)


# --------------------------------------------------------------------- CLI


def _repeat_arg(text: str) -> Optional[int]:
    if text == "auto":
        return None
    try:
        return int(text)
    except ValueError as error:
        raise argparse.ArgumentTypeError("repeat must be 'auto' or an integer") from error


def build_parser() -> argparse.ArgumentParser:
    d_geo = Geometry()
    d_tex = TextureOptions()
    parser = argparse.ArgumentParser(
        description="Deterministically compose the SumoSim dohyo ring over an accepted arena base. "
        "All geometry is in master space (3840x2160, center 1920,1080).",
    )
    parser.add_argument("--arena-base", type=Path, required=True, help="accepted arena background image (opaque, ~16:9)")
    parser.add_argument("--tawara-source", type=Path, required=True, help="horizontal RGBA tawara texture source")
    parser.add_argument("--output-dir", type=Path, required=True, help="directory for generated outputs")

    geo = parser.add_argument_group("geometry (master px)")
    geo.add_argument("--outer-radius", type=float, default=d_geo.outer_radius, help="gameplay radius / tawara outer edge (default %(default)s)")
    geo.add_argument("--tawara-width", type=float, default=d_geo.tawara_width, help="tawara radial width (default %(default)s)")
    geo.add_argument("--shikiri-offset-x", type=float, default=d_geo.shikiri_offset_x, help="shikiri center distance from ring center (default %(default)s)")
    geo.add_argument("--shikiri-length", type=float, default=d_geo.shikiri_length, help="shikiri length along Y (default %(default)s)")
    geo.add_argument("--shikiri-width", type=float, default=d_geo.shikiri_width, help="shikiri width along X (default %(default)s)")
    geo.add_argument("--protected-radius", type=float, default=d_geo.protected_radius, help="guide only (default %(default)s)")
    geo.add_argument("--participant-offset-x", type=float, default=d_geo.participant_offset_x, help="guide only (default %(default)s)")

    tok = parser.add_argument_group("tokudawara (four cardinal sections shifted outward)")
    tok.add_argument("--tokudawara-depth", type=float, default=0.0, help="outward shift, master px, <= tawara width; 0 = disabled (default %(default)s)")
    tok.add_argument("--tokudawara-half-angle-deg", type=float, default=None, help="half of each section's angular span in degrees, (0, 45); required when depth > 0")

    arena = parser.add_argument_group("arena alignment (uniform scale about canvas center, then translate)")
    arena.add_argument("--arena-scale", type=float, default=1.0, help=f"uniform zoom of the arena, 1..{MAX_ARENA_SCALE}; must cover the canvas after the offset (default %(default)s)")
    arena.add_argument("--arena-offset-x", type=float, default=0.0, help="move arena content right, master px (default %(default)s)")
    arena.add_argument("--arena-offset-y", type=float, default=0.0, help="move arena content down, master px (default %(default)s)")

    tex = parser.add_argument_group("tawara texture")
    tex.add_argument("--repeat", type=_repeat_arg, default=d_tex.repeat, metavar="N|auto", help="texture repeats around the ring (default auto: keep source aspect)")
    tex.add_argument("--trim-start", type=float, default=d_tex.trim_start, help="fraction of alpha-cropped width cut from the left end (default %(default)s)")
    tex.add_argument("--trim-end", type=float, default=d_tex.trim_end, help="fraction of alpha-cropped width cut from the right end (default %(default)s)")
    tex.add_argument("--seam-crossfade", type=float, default=d_tex.seam_crossfade, help="fraction of trimmed width crossfaded at the wrap seam (default %(default)s)")
    tex.add_argument("--alpha-threshold", type=int, default=d_tex.alpha_threshold, help="alpha above this defines the source bbox (default %(default)s)")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    geometry = Geometry(
        outer_radius=args.outer_radius,
        tawara_width=args.tawara_width,
        shikiri_offset_x=args.shikiri_offset_x,
        shikiri_length=args.shikiri_length,
        shikiri_width=args.shikiri_width,
        protected_radius=args.protected_radius,
        participant_offset_x=args.participant_offset_x,
        tokudawara_depth=args.tokudawara_depth,
        tokudawara_half_angle_deg=0.0 if args.tokudawara_half_angle_deg is None else args.tokudawara_half_angle_deg,
    )
    alignment = ArenaAlignment(scale=args.arena_scale, offset_x=args.arena_offset_x, offset_y=args.arena_offset_y)
    texture = TextureOptions(
        repeat=args.repeat,
        trim_start=args.trim_start,
        trim_end=args.trim_end,
        seam_crossfade=args.seam_crossfade,
        alpha_threshold=args.alpha_threshold,
    )
    try:
        result = compose(args.arena_base, args.tawara_source, geometry, texture, alignment)
        written = write_outputs(result, args.output_dir, [args.arena_base, args.tawara_source])
    except CompositorError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    for path in written:
        print(path)
    print(f"repeat: {result.manifest['tawara_texture']['repeat']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
