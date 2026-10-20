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
            },
        )
        for name in (cd.OUTPUT_ARENA_MASTER, cd.OUTPUT_OVERLAY_MASTER, cd.OUTPUT_GUIDE_MASTER, cd.OUTPUT_COMPOSITE_MASTER):
            self.assertEqual(result.images[name].size, (960, 540), name)
        for name in (cd.OUTPUT_OVERLAY_1920, cd.OUTPUT_PREVIEW_1920):
            self.assertEqual(result.images[name].size, (480, 270), name)
        self.assertEqual(result.images[cd.OUTPUT_OVERLAY_MASTER].mode, "RGBA")
        self.assertEqual(result.images[cd.OUTPUT_OVERLAY_1920].mode, "RGBA")

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
        out, info = cd.normalize_arena(image, (3840, 2160))
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

    def test_cli_smoke_full_master_size(self):
        arena = make_arena(self.tmp / "arena.png", (1672, 941))
        tawara = make_tawara(self.tmp / "tawara.png")
        out = self.tmp / "out"
        proc = self.run_cli("--arena-base", str(arena), "--tawara-source", str(tawara), "--output-dir", str(out), "--repeat", "12")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        expected = {
            cd.OUTPUT_ARENA_MASTER: (3840, 2160),
            cd.OUTPUT_OVERLAY_MASTER: (3840, 2160),
            cd.OUTPUT_GUIDE_MASTER: (3840, 2160),
            cd.OUTPUT_COMPOSITE_MASTER: (3840, 2160),
            cd.OUTPUT_OVERLAY_1920: (1920, 1080),
            cd.OUTPUT_PREVIEW_1920: (1920, 1080),
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


class IndependenceTests(unittest.TestCase):
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
