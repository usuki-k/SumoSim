"""Focused tests for the dohyo art compositor.

Synthetic fixtures are generated in temporary directories; they are never
Product art. Most tests use a reduced 960x540 geometry for speed; the CLI
smoke test renders the real 3840x2160 master size.
"""

from __future__ import annotations

import ast
import json
import math
import subprocess
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

import numpy as np
from PIL import Image

TOOL_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOL_DIR))

import compose_dohyo as cd  # noqa: E402

SMALL = cd.Geometry(
    canvas_width=960,
    canvas_height=540,
    outer_radius=200,
    tawara_width=12,
    shikiri_offset_x=31,
    shikiri_length=70,
    shikiri_width=6,
    protected_radius=266,
    participant_offset_x=61,
)
TEX = cd.TextureOptions(repeat=7, trim_start=0.05, trim_end=0.05, seam_crossfade=0.05)


def make_arena(path: Path, size=(960, 540)) -> Path:
    w, h = size
    xs = np.linspace(0, 255, w, dtype=np.float64)[np.newaxis, :]
    ys = np.linspace(0, 255, h, dtype=np.float64)[:, np.newaxis]
    rgb = np.stack([np.broadcast_to(xs, (h, w)), np.broadcast_to(ys, (h, w)), np.full((h, w), 90.0)], axis=-1)
    Image.fromarray(rgb.astype(np.uint8)).save(path)
    return path


def make_tawara(path: Path, half_alpha_band: bool = False, noise: bool = True) -> Path:
    """400x120 RGBA: 20 px transparent padding left/right, opaque body rows 30..89."""
    rgba = np.zeros((120, 400, 4), dtype=np.uint8)
    xs = np.arange(20, 380)
    rgba[30:90, 20:380, 0] = (150 + (xs % 40) * 2)[np.newaxis, :]
    rgba[30:90, 20:380, 1] = 120
    rgba[30:90, 20:380, 2] = 60
    rgba[30:90, 20:380, 3] = 255
    if half_alpha_band:
        rgba[50:70, 20:380, 3] = 128
    if noise:
        rgba[2, 2] = (255, 255, 255, 3)  # below default alpha threshold
    Image.fromarray(rgba).save(path)
    return path


def ring_pixels(g: cd.Geometry):
    ys, xs = np.mgrid[0 : g.canvas_height, 0 : g.canvas_width]
    return np.hypot(xs + 0.5 - g.center_x, ys + 0.5 - g.center_y)


def shikiri_mask(g: cd.Geometry) -> np.ndarray:
    mask = np.zeros((g.canvas_height, g.canvas_width), dtype=bool)
    for x0, y0, x1, y1 in g.shikiri_rects():
        mask[int(math.floor(y0)) : int(math.ceil(y1)), int(math.floor(x0)) : int(math.ceil(x1))] = True
    return mask


class ComposeTestBase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.arena = make_arena(self.tmp / "arena.png")
        self.tawara = make_tawara(self.tmp / "tawara.png")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def compose(self, geometry: cd.Geometry = SMALL, texture: cd.TextureOptions = TEX, tawara=None):
        return cd.compose(self.arena, tawara or self.tawara, geometry, texture)


class CompositionTests(ComposeTestBase):
    def test_compose_succeeds_with_expected_outputs_and_sizes(self):
        result = self.compose()
        self.assertEqual(
            set(result.images),
            {
                cd.OUTPUT_ARENA_MASTER,
                cd.OUTPUT_OVERLAY_MASTER,
                cd.OUTPUT_GUIDE_MASTER,
                cd.OUTPUT_COMPOSITE_MASTER,
                cd.OUTPUT_OVERLAY_1920,
                cd.OUTPUT_PREVIEW_1920,
                cd.OUTPUT_ARENA_1920,
            },
        )
        for name in (cd.OUTPUT_ARENA_MASTER, cd.OUTPUT_OVERLAY_MASTER, cd.OUTPUT_GUIDE_MASTER, cd.OUTPUT_COMPOSITE_MASTER):
            self.assertEqual(result.images[name].size, (960, 540), name)
        for name in (cd.OUTPUT_OVERLAY_1920, cd.OUTPUT_PREVIEW_1920, cd.OUTPUT_ARENA_1920):
            self.assertEqual(result.images[name].size, (480, 270), name)
        self.assertEqual(result.images[cd.OUTPUT_OVERLAY_MASTER].mode, "RGBA")
        self.assertEqual(result.images[cd.OUTPUT_OVERLAY_1920].mode, "RGBA")
        self.assertEqual(result.images[cd.OUTPUT_ARENA_1920].mode, "RGB")

    def test_runtime_arena_is_exact_2x_box_downscale_of_master(self):
        for alignment in (cd.ArenaAlignment(), cd.ArenaAlignment(1.15, 6, -35)):
            result = cd.compose(self.arena, self.tawara, SMALL, TEX, alignment)
            master = np.asarray(result.images[cd.OUTPUT_ARENA_MASTER], dtype=np.float64)
            small = np.asarray(result.images[cd.OUTPUT_ARENA_1920])
            # BOX 2x = mean of each 2x2 block, rounded
            blocks = master.reshape(270, 2, 480, 2, 3).mean(axis=(1, 3))
            self.assertLessEqual(int(np.abs(np.floor(blocks + 0.5) - small).max()), 1)
            expected = result.images[cd.OUTPUT_ARENA_MASTER].resize((480, 270), Image.Resampling.BOX)
            self.assertEqual(cd.pixel_sha256(result.images[cd.OUTPUT_ARENA_1920]), cd.pixel_sha256(expected))
            again = cd.compose(self.arena, self.tawara, SMALL, TEX, alignment)
            self.assertEqual(
                cd.pixel_sha256(again.images[cd.OUTPUT_ARENA_1920]), cd.pixel_sha256(result.images[cd.OUTPUT_ARENA_1920])
            )
            entry = {o["file"]: o for o in result.manifest["outputs"]}[cd.OUTPUT_ARENA_1920]
            self.assertEqual(entry["size"], [480, 270])
            self.assertEqual(entry["mode"], "RGB")
            self.assertEqual(entry["pixel_sha256"], cd.pixel_sha256(result.images[cd.OUTPUT_ARENA_1920]))

    def test_ring_center_and_radius_are_exact(self):
        g = SMALL
        alpha = np.asarray(self.compose().images[cd.OUTPUT_OVERLAY_MASTER].getchannel("A"))
        ring_alpha = np.where(shikiri_mask(g), 0, alpha)
        rows = np.flatnonzero(ring_alpha.any(axis=1))
        cols = np.flatnonzero(ring_alpha.any(axis=0))
        self.assertEqual((cols[0], cols[-1] + 1), (480 - 200, 480 + 200))
        self.assertEqual((rows[0], rows[-1] + 1), (270 - 200, 270 + 200))
        # Opaque synthetic texture: the alpha is pure geometry, so it is centered.
        np.testing.assert_array_equal(alpha, alpha[:, ::-1])
        np.testing.assert_array_equal(alpha, alpha[::-1, :])

    def test_overlay_transparent_outside_outer_and_inside_inner(self):
        g = SMALL
        alpha = np.asarray(self.compose().images[cd.OUTPUT_OVERLAY_MASTER].getchannel("A"))
        dist = ring_pixels(g)
        self.assertEqual(int(alpha[dist >= g.outer_radius + 0.5].max()), 0)
        inside = (dist <= g.inner_radius - 0.5) & ~shikiri_mask(g)
        self.assertEqual(int(alpha[inside].max()), 0)

    def test_annulus_has_visible_alpha(self):
        g = SMALL
        alpha = np.asarray(self.compose().images[cd.OUTPUT_OVERLAY_MASTER].getchannel("A"))
        dist = ring_pixels(g)
        interior = (dist >= g.inner_radius + 0.5) & (dist <= g.outer_radius - 0.5)
        self.assertTrue(interior.any())
        self.assertEqual(int(alpha[interior].min()), 255)

    def test_shikiri_lines_at_exact_positions(self):
        g = SMALL
        overlay = np.asarray(self.compose().images[cd.OUTPUT_OVERLAY_MASTER])
        expected = np.zeros((g.canvas_height, g.canvas_width), dtype=bool)
        expected[235:305, 446:452] = True  # 480 - 31 +- 3, 270 +- 35
        expected[235:305, 508:514] = True  # 480 + 31 +- 3
        inner = ring_pixels(g) < g.inner_radius - 0.5
        alpha = overlay[..., 3]
        np.testing.assert_array_equal(alpha[inner] == 255, expected[inner])
        np.testing.assert_array_equal(alpha[inner & ~expected], 0)
        self.assertTrue((overlay[expected][:, :3] == cd.SHIKIRI_COLOR).all())

    def test_texture_alpha_is_preserved(self):
        g = SMALL
        tawara = make_tawara(self.tmp / "band.png", half_alpha_band=True)
        alpha = np.asarray(self.compose(tawara=tawara).images[cd.OUTPUT_OVERLAY_MASTER].getchannel("A"))
        dist = ring_pixels(g)
        mid = np.abs(dist - (g.outer_radius - g.tawara_width / 2)) < 0.5
        values = alpha[mid].astype(int)
        self.assertTrue(np.all(np.abs(values - 128) <= 6), (values.min(), values.max()))
        edge = (dist > g.outer_radius - 2.5) & (dist < g.outer_radius - 1.5)
        self.assertGreaterEqual(int(alpha[edge].min()), 250)

    def test_composite_is_alpha_composite_of_arena_and_overlay(self):
        images = self.compose().images
        expected = Image.alpha_composite(
            images[cd.OUTPUT_ARENA_MASTER].convert("RGBA"), images[cd.OUTPUT_OVERLAY_MASTER]
        ).convert("RGB")
        self.assertEqual(cd.pixel_sha256(images[cd.OUTPUT_COMPOSITE_MASTER]), cd.pixel_sha256(expected))

    def test_deterministic_pixels_and_manifest(self):
        first = self.compose()
        second = self.compose()
        for name in first.images:
            self.assertEqual(cd.pixel_sha256(first.images[name]), cd.pixel_sha256(second.images[name]), name)
        self.assertEqual(cd.manifest_text(first.manifest), cd.manifest_text(second.manifest))

    def test_manifest_records_geometry_and_parameters(self):
        manifest = self.compose().manifest
        geo = manifest["geometry"]
        self.assertEqual(geo["canvas_size"], [960, 540])
        self.assertEqual(geo["center"], [480, 270])
        self.assertEqual(geo["outer_radius"], 200)
        self.assertEqual(geo["inner_radius"], 188)
        self.assertEqual(geo["tawara_width"], 12)
        self.assertEqual(geo["protected_radius"], 266)
        self.assertEqual(geo["shikiri"]["centers"], [[449, 270], [511, 270]])
        self.assertEqual(geo["shikiri"]["length"], 70)
        self.assertEqual(geo["shikiri"]["width"], 6)
        tex = manifest["tawara_texture"]
        self.assertEqual(tex["repeat"], 7)
        self.assertEqual(tex["trim_start"], 0.05)
        self.assertEqual(tex["trim_end"], 0.05)
        self.assertEqual(tex["seam_crossfade"], 0.05)
        self.assertEqual(manifest["schema"], cd.MANIFEST_SCHEMA)
        self.assertEqual(manifest["inputs"]["arena_base"]["file"], "arena.png")
        self.assertEqual(len(manifest["inputs"]["tawara_source"]["sha256"]), 64)
        self.assertEqual(manifest["downscale"]["size"], [480, 270])
        self.assertNotIn(str(self.tmp), cd.manifest_text(manifest))
        sizes = {o["file"]: o["size"] for o in manifest["outputs"]}
        self.assertEqual(sizes[cd.OUTPUT_PREVIEW_1920], [480, 270])

    def test_auto_repeat_preserves_source_aspect(self):
        g = SMALL
        manifest = self.compose(texture=replace(TEX, repeat=None)).manifest
        tex = manifest["tawara_texture"]
        tile_w = tex["tile_period_px"]
        tile_h = tex["strip_size"][1]
        expected = round(2 * math.pi * (g.outer_radius - g.tawara_width / 2) / (tile_w * g.tawara_width / tile_h))
        self.assertEqual(tex["repeat_requested"], "auto")
        self.assertEqual(tex["repeat"], expected)


class TextureTests(unittest.TestCase):
    def test_transparent_padding_crop_and_trim(self):
        rgba = np.zeros((120, 400, 4), dtype=np.uint8)
        rgba[30:90, 20:380] = (200, 150, 90, 255)
        rgba[2, 2] = (255, 255, 255, 3)  # noise below threshold is ignored
        image = Image.fromarray(rgba)
        strip, info = cd.prepare_tawara_strip(image, cd.TextureOptions(trim_start=0.0, trim_end=0.0))
        self.assertEqual(info["alpha_bbox"], [20, 30, 380, 90])
        self.assertEqual(strip.shape[:2], (60, 360))
        strip, info = cd.prepare_tawara_strip(image, cd.TextureOptions(trim_start=0.1, trim_end=0.05))
        self.assertEqual(info["trim_px"], [36, 18])
        self.assertEqual(info["strip_box"], [56, 30, 362, 90])
        self.assertEqual(strip.shape[:2], (60, 306))

    def test_seamless_tile_wraps_continuously(self):
        strip = np.zeros((4, 100, 4), dtype=np.float64)
        strip[..., 0] = np.linspace(0, 1, 100)[np.newaxis, :]
        strip[..., 3] = 1
        tile = cd.make_seamless_tile(strip, 10)
        self.assertEqual(tile.shape[1], 90)
        steps = np.abs(np.diff(np.concatenate([tile[0, :, 0], tile[0, :1, 0]])))
        self.assertLess(steps.max(), 0.1)

    def test_empty_alpha_fails(self):
        image = Image.new("RGBA", (300, 100), (200, 150, 90, 0))
        with self.assertRaises(cd.CompositorError):
            cd.prepare_tawara_strip(image, cd.TextureOptions())

    def test_source_without_alpha_fails(self):
        image = Image.new("RGB", (300, 100), (200, 150, 90))
        with self.assertRaises(cd.CompositorError):
            cd.prepare_tawara_strip(image, cd.TextureOptions())

    def test_vertical_source_fails(self):
        image = Image.new("RGBA", (100, 300), (200, 150, 90, 255))
        with self.assertRaises(cd.CompositorError):
            cd.prepare_tawara_strip(image, cd.TextureOptions())


class ArenaTests(unittest.TestCase):
    def test_tiny_aspect_mismatch_is_normalized(self):
        image = Image.new("RGB", (1672, 941), (120, 90, 60))  # accepted source shape
        out, info, _ = cd.normalize_arena(image, (3840, 2160))
        self.assertEqual(out.size, (3840, 2160))
        self.assertEqual(out.mode, "RGB")
        self.assertLess(abs(info["aspect_mismatch"]), cd.ASPECT_TOLERANCE)

    def test_material_aspect_mismatch_fails(self):
        for size in ((1600, 1000), (1000, 1000), (1920, 1060)):
            with self.subTest(size=size), self.assertRaises(cd.CompositorError):
                cd.normalize_arena(Image.new("RGB", size), (3840, 2160))

    def test_transparent_arena_fails(self):
        with self.assertRaises(cd.CompositorError):
            cd.normalize_arena(Image.new("RGBA", (1920, 1080), (0, 0, 0, 0)), (3840, 2160))


ARENA_BG = (100, 80, 60)


def marker_arena(size=(960, 540), box=(300, 200, 340, 240)) -> Image.Image:
    """Opaque background with one bright square marker (x0, y0, x1, y1)."""
    image = Image.new("RGB", size, ARENA_BG)
    image.paste((255, 255, 255), box)
    return image


def marker_centroid_and_extent(image: Image.Image):
    lum = np.asarray(image.convert("L"), dtype=np.float64)
    weight = np.clip(lum - 160, 0, None)
    ys, xs = np.mgrid[0 : lum.shape[0], 0 : lum.shape[1]]
    total = weight.sum()
    centroid = ((weight * (xs + 0.5)).sum() / total, (weight * (ys + 0.5)).sum() / total)
    mask = lum > 177  # ~half way between background and marker
    cols = np.flatnonzero(mask.any(axis=0))
    rows = np.flatnonzero(mask.any(axis=1))
    return centroid, (cols[-1] + 1 - cols[0], rows[-1] + 1 - rows[0])


class ArenaAlignmentTests(unittest.TestCase):
    SIZE = (960, 540)

    def expected_centroid(self, alignment: cd.ArenaAlignment):
        cx, cy = self.SIZE[0] / 2, self.SIZE[1] / 2
        return (
            (320 - cx) * alignment.scale + cx + alignment.offset_x,
            (220 - cy) * alignment.scale + cy + alignment.offset_y,
        )

    def test_identity_alignment_preserves_previous_normalization(self):
        image = marker_arena((1672, 941))
        default, _, info = cd.normalize_arena(image, (3840, 2160))
        explicit, _, _ = cd.normalize_arena(image, (3840, 2160), cd.ArenaAlignment(1.0, 0.0, 0.0))
        previous = image.resize((3840, 2160), Image.Resampling.LANCZOS, box=(0, 0.25, 1672, 940.75))
        self.assertEqual(cd.pixel_sha256(default), cd.pixel_sha256(previous))
        self.assertEqual(cd.pixel_sha256(explicit), cd.pixel_sha256(previous))
        self.assertEqual(info["source_box"], [0, 0.25, 1672, 940.75])

    def test_positive_offset_x_moves_content_right(self):
        alignment = cd.ArenaAlignment(scale=1.1, offset_x=30)
        out, _, _ = cd.normalize_arena(marker_arena(), self.SIZE, alignment)
        (x, y), _ = marker_centroid_and_extent(out)
        ex, ey = self.expected_centroid(alignment)
        self.assertGreater(x, ex - 30 + 20)
        self.assertAlmostEqual(x, ex, delta=0.5)
        self.assertAlmostEqual(y, ey, delta=0.5)

    def test_positive_offset_y_moves_content_down(self):
        alignment = cd.ArenaAlignment(scale=1.2, offset_y=40)
        out, _, _ = cd.normalize_arena(marker_arena(), self.SIZE, alignment)
        (x, y), _ = marker_centroid_and_extent(out)
        ex, ey = self.expected_centroid(alignment)
        self.assertAlmostEqual(x, ex, delta=0.5)
        self.assertAlmostEqual(y, ey, delta=0.5)

    def test_uniform_scale_without_stretch(self):
        alignment = cd.ArenaAlignment(scale=1.2, offset_x=-20, offset_y=30)
        out, _, info = cd.normalize_arena(marker_arena(), self.SIZE, alignment)
        self.assertEqual(out.size, self.SIZE)
        _, (w, h) = marker_centroid_and_extent(out)
        self.assertEqual(w, h)
        self.assertAlmostEqual(w, 40 * 1.2, delta=1)
        x0, y0, x1, y1 = info["source_box"]
        self.assertAlmostEqual((x1 - x0) / (y1 - y0), self.SIZE[0] / self.SIZE[1], places=3)

    def test_insufficient_coverage_fails(self):
        cases = [
            cd.ArenaAlignment(scale=1.0, offset_x=10),
            cd.ArenaAlignment(scale=1.05, offset_y=60),  # needs 1 + 60/270
            cd.ArenaAlignment(scale=0.9),
            cd.ArenaAlignment(scale=cd.MAX_ARENA_SCALE + 0.01, offset_y=10),
            cd.ArenaAlignment(scale=float("nan")),
            cd.ArenaAlignment(scale=1.1, offset_x=float("inf")),
        ]
        for alignment in cases:
            with self.subTest(alignment), self.assertRaises(cd.CompositorError):
                cd.normalize_arena(marker_arena(), self.SIZE, alignment)

    def test_minimum_valid_scale_covers_exact_canvas(self):
        scale = cd.required_arena_scale(self.SIZE, 12, -60)
        out, _, info = cd.normalize_arena(marker_arena(), self.SIZE, cd.ArenaAlignment(scale, 12, -60))
        self.assertEqual(out.size, self.SIZE)
        x0, y0, x1, y1 = info["source_box"]
        self.assertGreaterEqual(min(x0, y0), -1e-6)
        self.assertLessEqual(x1, self.SIZE[0] + 1e-6)
        self.assertLessEqual(y1, self.SIZE[1] + 1e-6)
        pixels = np.asarray(out)
        for edge in (pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]):
            np.testing.assert_allclose(edge, np.broadcast_to(ARENA_BG, edge.shape), atol=1)


class AlignedCompositionTests(ComposeTestBase):
    ALIGN = cd.ArenaAlignment(scale=1.15, offset_x=6, offset_y=-35)

    def test_manifest_records_alignment(self):
        manifest = cd.compose(self.arena, self.tawara, SMALL, TEX, self.ALIGN).manifest
        info = manifest["arena_alignment"]
        self.assertEqual(info["scale"], 1.15)
        self.assertEqual(info["offset_x"], 6)
        self.assertEqual(info["offset_y"], -35)
        self.assertIn("scale about canvas center -> translate", info["transform_order"])
        self.assertEqual(len(info["source_box"]), 4)
        identity = cd.compose(self.arena, self.tawara, SMALL, TEX).manifest["arena_alignment"]
        self.assertEqual((identity["scale"], identity["offset_x"], identity["offset_y"]), (1.0, 0.0, 0.0))

    def test_alignment_is_deterministic(self):
        first = cd.compose(self.arena, self.tawara, SMALL, TEX, self.ALIGN)
        second = cd.compose(self.arena, self.tawara, SMALL, TEX, self.ALIGN)
        for name in first.images:
            self.assertEqual(cd.pixel_sha256(first.images[name]), cd.pixel_sha256(second.images[name]), name)
        self.assertEqual(cd.manifest_text(first.manifest), cd.manifest_text(second.manifest))

    def test_alignment_changes_arena_only(self):
        plain = cd.compose(self.arena, self.tawara, SMALL, TEX)
        aligned = cd.compose(self.arena, self.tawara, SMALL, TEX, self.ALIGN)
        for name in (cd.OUTPUT_OVERLAY_MASTER, cd.OUTPUT_OVERLAY_1920):
            self.assertEqual(cd.pixel_sha256(plain.images[name]), cd.pixel_sha256(aligned.images[name]), name)
        self.assertNotEqual(
            cd.pixel_sha256(plain.images[cd.OUTPUT_ARENA_MASTER]),
            cd.pixel_sha256(aligned.images[cd.OUTPUT_ARENA_MASTER]),
        )
        self.assertEqual(plain.manifest["geometry"], aligned.manifest["geometry"])
        self.assertEqual(aligned.manifest["geometry"]["center"], [480, 270])
        self.assertEqual(aligned.manifest["geometry"]["outer_radius"], 200)


class GeometryValidationTests(unittest.TestCase):
    def test_default_geometry_is_valid_master_geometry(self):
        g = cd.Geometry()
        cd.validate_geometry(g)
        self.assertEqual((g.canvas_width, g.canvas_height), (3840, 2160))
        self.assertEqual((g.center_x, g.center_y), (1920, 1080))
        self.assertEqual((g.outer_radius, g.inner_radius, g.tawara_width), (800, 758, 42))
        self.assertEqual(
            g.shikiri_rects(), [(1784, 940, 1808, 1220), (2032, 940, 2056, 1220)]
        )
        self.assertEqual(g.preview_size, (1920, 1080))

    def test_invalid_geometry_fails(self):
        invalid = {
            "zero outer": dict(outer_radius=0),
            "negative width": dict(tawara_width=-1),
            "inner <= 0": dict(tawara_width=800),
            "exceeds canvas": dict(outer_radius=1081),
            "protected < outer": dict(protected_radius=700),
            "nan radius": dict(outer_radius=float("nan")),
            "shikiri overlap": dict(shikiri_offset_x=10),
            "shikiri outside inner": dict(shikiri_length=1600),
            "shikiri zero width": dict(shikiri_width=0),
            "odd canvas": dict(canvas_width=3841),
        }
        for label, overrides in invalid.items():
            with self.subTest(label), self.assertRaises(cd.CompositorError):
                cd.validate_geometry(replace(cd.Geometry(), **overrides))

    def test_invalid_texture_options_fail(self):
        for overrides in (dict(repeat=0), dict(trim_start=-0.1), dict(trim_end=0.5), dict(trim_start=0.45, trim_end=0.45), dict(seam_crossfade=0.6)):
            with self.subTest(overrides), self.assertRaises(cd.CompositorError):
                cd.validate_texture_options(replace(cd.TextureOptions(), **overrides))


class CliTests(unittest.TestCase):
    SCRIPT = TOOL_DIR / "compose_dohyo.py"

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def run_cli(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(self.SCRIPT), *args], capture_output=True, text=True, check=False
        )

    def test_cli_smoke_full_size_tokudawara_candidate_a(self):
        arena = make_arena(self.tmp / "arena.png", (1672, 941))
        tawara = make_tawara(self.tmp / "tawara.png")
        out = self.tmp / "out"
        proc = self.run_cli(
            "--arena-base", str(arena), "--tawara-source", str(tawara), "--output-dir", str(out),
            "--arena-scale", "1.072", "--arena-offset-x", "5.36", "--arena-offset-y", "77.72",
            "--tokudawara-depth", "42", "--tokudawara-half-angle-deg", "9",
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        manifest = json.loads((out / cd.OUTPUT_MANIFEST).read_text(encoding="ascii"))
        self.assertEqual(manifest["schema"], cd.MANIFEST_SCHEMA)
        tok = manifest["tokudawara"]
        self.assertEqual((tok["depth"], tok["half_angle_deg"], tok["outer_radius"], tok["inner_radius"]), (42, 9, 842, 800))
        with Image.open(out / cd.OUTPUT_OVERLAY_MASTER) as master:
            self.assertEqual(master.size, (3840, 2160))
            alpha = np.asarray(master.getchannel("A"))
        with Image.open(out / cd.OUTPUT_PREVIEW_1920) as preview:
            self.assertEqual(preview.size, (1920, 1080))
        # Center lines: shifted band [800, 842] present, base band [758, 800] gone (all four sections).
        for x, y in ((1920 + 821, 1080), (1920 - 822, 1080), (1920, 1080 + 821), (1920, 1080 - 822)):
            self.assertEqual(int(alpha[y, x]), 255, (x, y))
        for x, y in ((1920 + 779, 1080), (1920 - 780, 1080), (1920, 1080 + 779), (1920, 1080 - 780)):
            self.assertEqual(int(alpha[y, x]), 0, (x, y))
        row = np.flatnonzero(alpha[1080])
        self.assertEqual((row[0], row[-1] + 1), (1920 - 842, 1920 + 842))

    def test_cli_smoke_full_master_size(self):
        arena = make_arena(self.tmp / "arena.png", (1672, 941))
        tawara = make_tawara(self.tmp / "tawara.png")
        out = self.tmp / "out"
        proc = self.run_cli(
            "--arena-base", str(arena), "--tawara-source", str(tawara), "--output-dir", str(out), "--repeat", "12",
            "--arena-scale", "1.072", "--arena-offset-x", "5.36", "--arena-offset-y", "77.72",
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        expected = {
            cd.OUTPUT_ARENA_MASTER: (3840, 2160),
            cd.OUTPUT_OVERLAY_MASTER: (3840, 2160),
            cd.OUTPUT_GUIDE_MASTER: (3840, 2160),
            cd.OUTPUT_COMPOSITE_MASTER: (3840, 2160),
            cd.OUTPUT_OVERLAY_1920: (1920, 1080),
            cd.OUTPUT_PREVIEW_1920: (1920, 1080),
            cd.OUTPUT_ARENA_1920: (1920, 1080),
        }
        self.assertEqual(sorted(p.name for p in out.iterdir()), sorted(list(expected) + [cd.OUTPUT_MANIFEST]))
        for name, size in expected.items():
            with Image.open(out / name) as image:
                self.assertEqual(image.size, size, name)
        manifest = json.loads((out / cd.OUTPUT_MANIFEST).read_text(encoding="ascii"))
        self.assertEqual(manifest["geometry"]["center"], [1920, 1080])
        self.assertEqual(manifest["geometry"]["outer_radius"], 800)
        self.assertEqual(manifest["geometry"]["inner_radius"], 758)
        self.assertEqual(manifest["geometry"]["shikiri"]["centers"], [[1796, 1080], [2044, 1080]])
        self.assertEqual(manifest["tawara_texture"]["repeat"], 12)
        alignment = manifest["arena_alignment"]
        self.assertEqual((alignment["scale"], alignment["offset_x"], alignment["offset_y"]), (1.072, 5.36, 77.72))
        with Image.open(out / cd.OUTPUT_OVERLAY_1920) as small:
            alpha = np.asarray(small.getchannel("A"))
        # Runtime space: ring outer edge 400 px around (960, 540).
        row = alpha[540]
        cols = np.flatnonzero(row)
        self.assertEqual((cols[0], cols[-1] + 1), (560, 1360))

    def test_cli_fails_closed_without_writing(self):
        arena = make_arena(self.tmp / "arena.png")
        tawara = make_tawara(self.tmp / "tawara.png")
        empty = self.tmp / "empty.png"
        Image.new("RGBA", (300, 100), (0, 0, 0, 0)).save(empty)
        wrong_aspect = make_arena(self.tmp / "square.png", (800, 800))
        cases = {
            "missing arena": ["--arena-base", str(self.tmp / "nope.png"), "--tawara-source", str(tawara)],
            "unreadable arena": ["--arena-base", str(self.SCRIPT), "--tawara-source", str(tawara)],
            "empty tawara": ["--arena-base", str(arena), "--tawara-source", str(empty)],
            "wrong aspect": ["--arena-base", str(wrong_aspect), "--tawara-source", str(tawara)],
            "bad geometry": ["--arena-base", str(arena), "--tawara-source", str(tawara), "--tawara-width", "900"],
            "uncovered arena": ["--arena-base", str(arena), "--tawara-source", str(tawara), "--arena-offset-y", "50"],
            "arena scale too large": ["--arena-base", str(arena), "--tawara-source", str(tawara), "--arena-scale", "2"],
            "tokudawara without half angle": ["--arena-base", str(arena), "--tawara-source", str(tawara), "--tokudawara-depth", "42"],
            "tokudawara too deep": [
                "--arena-base", str(arena), "--tawara-source", str(tawara),
                "--tokudawara-depth", "43", "--tokudawara-half-angle-deg", "9",
            ],
        }
        for label, args in cases.items():
            with self.subTest(label):
                out = self.tmp / f"out-{label.replace(' ', '-')}"
                proc = self.run_cli(*args, "--output-dir", str(out))
                self.assertNotEqual(proc.returncode, 0)
                self.assertIn("error:", proc.stderr)
                self.assertFalse(out.exists() and any(out.iterdir()))

    def test_output_may_not_overwrite_input(self):
        arena = make_arena(self.tmp / cd.OUTPUT_ARENA_MASTER)
        tawara = make_tawara(self.tmp / "tawara.png")
        before = arena.read_bytes()
        result = cd.compose(arena, tawara, SMALL, TEX)
        with self.assertRaises(cd.CompositorError):
            cd.write_outputs(result, self.tmp, [arena, tawara])
        self.assertEqual(arena.read_bytes(), before)


# Pixel hashes produced by the pre-Tokudawara compositor (791fb16) for SMALL / TEX and the
# synthetic fixtures above, on the verified toolchain in requirements.txt.
LEGACY_CIRCLE_HASHES = {
    cd.OUTPUT_OVERLAY_MASTER: "52356241c03ed9dd6cedd0db53edf52e20179ab8e722053981357421fc006ea1",
    cd.OUTPUT_GUIDE_MASTER: "949b397e8428afb56c13c341681e0dcc6a7fa221ba350e85bd8dac8b04d88f30",
    cd.OUTPUT_COMPOSITE_MASTER: "481d863d3aa371430092013ce4739e5e4ed81c46042a2b235f5af5546a9c572f",
}

TOK = replace(SMALL, tokudawara_depth=12, tokudawara_half_angle_deg=9)


def window_distance(g: cd.Geometry) -> np.ndarray:
    ys, xs = np.mgrid[0 : g.canvas_height, 0 : g.canvas_width]
    return cd.tokudawara_window_distance(g, xs + 0.5 - g.center_x, ys + 0.5 - g.center_y)


class TokudawaraTests(ComposeTestBase):
    def tok_alpha(self, g: cd.Geometry = TOK) -> np.ndarray:
        return np.asarray(self.compose(g).images[cd.OUTPUT_OVERLAY_MASTER].getchannel("A"))

    def test_disabled_reproduces_legacy_circle_pixels(self):
        for g in (SMALL, replace(SMALL, tokudawara_depth=0, tokudawara_half_angle_deg=9)):
            images = self.compose(g).images
            for name, expected in LEGACY_CIRCLE_HASHES.items():
                self.assertEqual(cd.pixel_sha256(images[name]), expected, name)

    def test_depth_zero_is_disabled_in_manifest(self):
        self.assertEqual(self.compose().manifest["tokudawara"], {"enabled": False})

    def test_four_cardinal_sections_present_and_base_band_absent(self):
        g = TOK
        alpha = self.tok_alpha()
        cx, cy = 480, 270
        shifted_mid = g.max_outer_radius - g.tawara_width / 2  # 206
        base_mid = g.outer_radius - g.tawara_width / 2  # 194
        for k, (ux, uy) in enumerate(((1, 0), (0, 1), (-1, 0), (0, -1))):
            with self.subTest(section=k):
                px = int(math.floor(cx + ux * shifted_mid)), int(math.floor(cy + uy * shifted_mid))
                self.assertEqual(int(alpha[px[1], px[0]]), 255)
                bx = int(math.floor(cx + ux * base_mid)), int(math.floor(cy + uy * base_mid))
                self.assertEqual(int(alpha[bx[1], bx[0]]), 0)
                # just outside the window side, the normal band is back
                for side in (-1, 1):
                    a = k * math.pi / 2 + side * math.radians(g.tokudawara_half_angle_deg + 2)
                    nx = int(math.floor(cx + math.cos(a) * base_mid))
                    ny = int(math.floor(cy + math.sin(a) * base_mid))
                    self.assertEqual(int(alpha[ny, nx]), 255)

    def test_alpha_geometry_is_symmetric(self):
        alpha = self.tok_alpha()
        np.testing.assert_array_equal(alpha, alpha[:, ::-1])
        np.testing.assert_array_equal(alpha, alpha[::-1, :])
        # x <-> y swap: 540x540 square centered on the ring; shikiri (vertical lines) excluded.
        square = np.where(ring_pixels(TOK) < TOK.inner_radius - 1, 0, alpha)[:, 210:750]
        np.testing.assert_array_equal(square, square.T)

    def test_sections_share_identical_rgb_under_rotation(self):
        overlay = np.asarray(self.compose(TOK).images[cd.OUTPUT_OVERLAY_MASTER])
        square = overlay[:, 210:750]
        dist = ring_pixels(TOK)[:, 210:750]
        inside = window_distance(TOK)[:, 210:750] >= 1
        mask = inside & (dist > TOK.outer_radius + 1)  # shifted band only
        rotated = np.rot90(square)
        diff = np.abs(rotated[mask].astype(int) - square[np.rot90(mask)].astype(int))
        self.assertLessEqual(int(diff.max()), 1)

    def test_normal_and_shifted_radii_are_exact(self):
        g = TOK
        alpha = self.tok_alpha()
        dist = ring_pixels(g)
        signed = window_distance(g)
        shikiri = shikiri_mask(g)
        outside_window = signed <= -1
        inside_window = signed >= 1
        r, w, d = g.outer_radius, g.tawara_width, g.tokudawara_depth
        # normal section: [R - w, R]
        self.assertEqual(int(alpha[outside_window & (dist >= r + 0.5)].max()), 0)
        self.assertEqual(int(alpha[outside_window & (dist >= r - w + 0.5) & (dist <= r - 0.5)].min()), 255)
        self.assertEqual(int(alpha[outside_window & (dist <= r - w - 0.5) & ~shikiri].max()), 0)
        # shifted section: [R + d - w, R + d]; no base band left inside the window
        self.assertEqual(int(alpha[inside_window & (dist >= r + d + 0.5)].max()), 0)
        self.assertEqual(int(alpha[inside_window & (dist >= r + d - w + 0.5) & (dist <= r + d - 0.5)].min()), 255)
        self.assertEqual(int(alpha[inside_window & (dist <= r + d - w - 0.5) & ~shikiri].max()), 0)
        # nothing beyond the Tokudawara outer radius anywhere
        self.assertEqual(int(alpha[dist >= r + d + 0.5].max()), 0)

    def test_section_center_line_outer_radius(self):
        g = TOK
        alpha = self.tok_alpha()
        row = alpha[270]
        cols = np.flatnonzero(row)
        self.assertEqual((cols[0], cols[-1] + 1), (480 - 212, 480 + 212))
        col = alpha[:, 480]
        rows = np.flatnonzero(col)
        self.assertEqual((rows[0], rows[-1] + 1), (270 - 212, 270 + 212))

    def test_side_connections_have_no_alpha_gap(self):
        # Every pixel straddling a side boundary between R - width and R + depth is covered:
        # the normal band on one side and the shifted band on the other meet without a gap.
        g = TOK
        alpha = self.tok_alpha()
        dist = ring_pixels(g)
        signed = window_distance(g)
        ys, xs = np.mgrid[0 : g.canvas_height, 0 : g.canvas_width]
        dx, dy = xs + 0.5 - 480, ys + 0.5 - 270
        seam = (np.abs(signed) < 0.45) & (dist >= g.inner_radius + 0.5) & (dist <= g.max_outer_radius - 0.5)
        for label, quadrant in (
            ("+x", dx > np.abs(dy)), ("-x", -dx > np.abs(dy)), ("+y", dy > np.abs(dx)), ("-y", -dy > np.abs(dx))
        ):
            for side_label, side in (("cw", dx * dy > 0), ("ccw", dx * dy < 0)):
                with self.subTest(section=label, side=side_label):
                    region = seam & quadrant & side
                    self.assertGreater(int(region.sum()), 10)
                    self.assertGreater(int(alpha[region].min()), 0)

    def test_shikiri_unchanged(self):
        plain = np.asarray(self.compose(SMALL).images[cd.OUTPUT_OVERLAY_MASTER])
        tok = np.asarray(self.compose(TOK).images[cd.OUTPUT_OVERLAY_MASTER])
        inner = ring_pixels(SMALL) < SMALL.inner_radius - 0.5
        np.testing.assert_array_equal(plain[inner], tok[inner])

    def test_arena_alignment_does_not_affect_overlay(self):
        plain = cd.compose(self.arena, self.tawara, TOK, TEX)
        aligned = cd.compose(self.arena, self.tawara, TOK, TEX, cd.ArenaAlignment(1.15, 6, -35))
        for name in (cd.OUTPUT_OVERLAY_MASTER, cd.OUTPUT_OVERLAY_1920):
            self.assertEqual(cd.pixel_sha256(plain.images[name]), cd.pixel_sha256(aligned.images[name]))

    def test_guide_marks_tokudawara_only_when_enabled(self):
        guide = np.asarray(self.compose(TOK).images[cd.OUTPUT_GUIDE_MASTER]).astype(int)
        color = np.array(cd.GUIDE_TOKUDAWARA)
        hits = np.all(np.abs(guide - color) <= 2, axis=-1)
        ys, xs = np.nonzero(hits)
        dist = np.hypot(xs + 0.5 - 480, ys + 0.5 - 270)
        self.assertTrue(hits.any())
        self.assertGreaterEqual(dist.min(), TOK.outer_radius - 2)
        self.assertLessEqual(dist.max(), TOK.max_outer_radius + 2)
        plain = np.asarray(self.compose(SMALL).images[cd.OUTPUT_GUIDE_MASTER]).astype(int)
        self.assertFalse(np.all(np.abs(plain - color) <= 2, axis=-1).any())

    def test_manifest_records_tokudawara(self):
        info = self.compose(TOK).manifest["tokudawara"]
        self.assertEqual(info["enabled"], True)
        self.assertEqual(info["count"], 4)
        self.assertEqual(info["depth"], 12)
        self.assertEqual(info["half_angle_deg"], 9)
        self.assertEqual(info["outer_radius"], 212)
        self.assertEqual(info["inner_radius"], 200)
        self.assertIn("cardinal", info["directions"])

    def test_tokudawara_is_deterministic(self):
        first = self.compose(TOK)
        second = self.compose(TOK)
        for name in first.images:
            self.assertEqual(cd.pixel_sha256(first.images[name]), cd.pixel_sha256(second.images[name]), name)
        self.assertEqual(cd.manifest_text(first.manifest), cd.manifest_text(second.manifest))

    def test_invalid_tokudawara_fails(self):
        cases = {
            "negative depth": dict(tokudawara_depth=-1, tokudawara_half_angle_deg=9),
            "nan depth": dict(tokudawara_depth=float("nan"), tokudawara_half_angle_deg=9),
            "missing half angle": dict(tokudawara_depth=12),
            "half angle 45": dict(tokudawara_depth=12, tokudawara_half_angle_deg=45),
            "negative half angle": dict(tokudawara_depth=12, tokudawara_half_angle_deg=-9),
            "nan half angle": dict(tokudawara_depth=12, tokudawara_half_angle_deg=float("nan")),
            "deeper than tawara": dict(tokudawara_depth=13, tokudawara_half_angle_deg=9),
            "exceeds canvas": dict(outer_radius=262, tokudawara_depth=12, tokudawara_half_angle_deg=9),
        }
        for label, overrides in cases.items():
            with self.subTest(label), self.assertRaises(cd.CompositorError):
                cd.validate_geometry(replace(SMALL, **overrides))
        cd.validate_geometry(replace(cd.Geometry(), tokudawara_depth=42, tokudawara_half_angle_deg=9))


class IndependenceTests(unittest.TestCase):
    def test_product_inputs_and_outputs_are_git_ignored(self):
        repo = TOOL_DIR.parents[1]
        if not (repo / ".git").exists():
            self.skipTest("not a git checkout")
        for rel in (
            "tools/dohyo_art/input.local/arena_base.png",
            "tools/dohyo_art/input.local/tawara_source.png",
            "tools/dohyo_art/output.local/composite_preview_1920.png",
            "tools/dohyo_art/output-aligned.local/composite_preview_1920.png",
        ):
            proc = subprocess.run(["git", "check-ignore", "-q", rel], cwd=repo, check=False)
            self.assertEqual(proc.returncode, 0, f"{rel} is not git-ignored")
        tracked = subprocess.run(
            ["git", "ls-files", "tools/dohyo_art"], cwd=repo, capture_output=True, text=True, check=True
        ).stdout.split()
        self.assertFalse([f for f in tracked if f.endswith(".png") or ".local/" in f])

    def test_tool_imports_only_stdlib_numpy_and_pillow(self):
        tree = ast.parse((TOOL_DIR / "compose_dohyo.py").read_text(encoding="utf-8"))
        modules = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                modules.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                modules.add((node.module or "").split(".")[0])
        allowed = {
            "__future__", "argparse", "dataclasses", "hashlib", "json", "math", "os",
            "pathlib", "shutil", "sys", "tempfile", "typing", "numpy", "PIL",
        }
        self.assertLessEqual(modules, allowed)
        source = (TOOL_DIR / "compose_dohyo.py").read_text(encoding="utf-8").lower()
        for marker in ("src/game", "package.json", "boutsimulation"):
            self.assertNotIn(marker, source)


if __name__ == "__main__":
    unittest.main()
