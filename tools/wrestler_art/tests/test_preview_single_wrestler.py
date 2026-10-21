"""Focused tests for preview_single_wrestler.py (ART-WRESTLER-02B).

Synthetic fixtures are built in temporary directories (never Product art). The
last test class also checks the real reviewed sprite when it is present in
tools/wrestler_art/input.local/ and is skipped otherwise.
"""

from __future__ import annotations

import copy
import io
import json
import math
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from PIL import Image, ImageDraw

TOOL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOL_DIR))

import assemble_wrestler as aw  # noqa: E402
import preview_single_wrestler as ps  # noqa: E402

REQUIRED_OUTPUTS = {
    "single_master.png", "single_runtime.png", "single_pivot_guide.png", "single_runtime_16angles.png",
    "single_on_arena_1920.png", "single_on_arena_8facings.png", "single_sprite.json", "build_single_manifest.json",
}
CORRECTION_DEG = -10.0
ROOT = (150.0, 150.0)
CORE_HALF = 60.0


def make_sprite() -> Image.Image:
    sprite = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(sprite)
    d.ellipse((80, 85, 220, 215), fill=(240, 190, 150, 255))  # body
    # knot (back): centered on the source axis, which is tilted +10 deg (center (78.6, 137.4))
    d.rectangle((64, 120, 94, 155), fill=(30, 50, 200, 255))
    d.ellipse((215, 70, 245, 100), fill=(240, 190, 150, 255))  # hands (front)
    d.ellipse((215, 200, 245, 230), fill=(240, 190, 150, 255))
    d.ellipse((150, 120, 200, 170), fill=(30, 25, 25, 255))  # head
    return sprite


def core_points() -> list:
    # Perpendicular to the corrected axis: source angle 90 - correction.
    a = math.radians(90.0 - CORRECTION_DEG)
    d = (math.cos(a) * CORE_HALF, math.sin(a) * CORE_HALF)
    return [[round(ROOT[0] - d[0], 4), round(ROOT[1] - d[1], 4)], [round(ROOT[0] + d[0], 4), round(ROOT[1] + d[1], 4)]]


def make_recipe(sprite: Image.Image) -> dict:
    return {
        "recipe_schema": 1,
        "name": "synthetic-single",
        "source": {"file": "wrestler_single.png", "size": list(sprite.size),
                   "pixel_sha256": aw.rgba_pixel_sha256(sprite), "reviewed_file_sha256": "0" * 64},
        "alpha_threshold": 8,
        "orientation_correction_deg": CORRECTION_DEG,
        "orientation_evidence": {"back_source_px": [70, 150], "front_source_px": [230, 178]},
        "root_source_px": list(ROOT),
        "body_core_source_px": core_points(),
        "body_core_target_r": 2.0,
    }


class Fixture:
    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.input_dir = root / "input.local"
        self.arena_dir = root / "arena"
        self.output_dir = root / "output-single.local"
        self.input_dir.mkdir()
        self.arena_dir.mkdir()
        self.sprite = make_sprite()
        self.sprite.save(self.input_dir / "wrestler_single.png")
        Image.new("RGB", aw.ARENA_SIZE, (200, 160, 110)).save(self.arena_dir / aw.ARENA_BASE_FILE)
        overlay = Image.new("RGBA", aw.ARENA_SIZE, (0, 0, 0, 0))
        ImageDraw.Draw(overlay).rectangle((893, 470, 905, 610), fill=(238, 230, 211, 255))
        overlay.save(self.arena_dir / aw.ARENA_OVERLAY_FILE)
        self.recipe = make_recipe(self.sprite)
        self.recipe_path = root / "single_sprite_recipe.json"
        self.recipe_path.write_text(json.dumps(self.recipe), encoding="utf-8")

    def build(self, recipe=None) -> ps.SingleBuild:
        recipe = self.recipe if recipe is None else recipe
        ps.validate_recipe(recipe)
        return ps.build(recipe, self.input_dir, self.arena_dir)

    def cleanup(self) -> None:
        self._tmp.cleanup()


class FixtureTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = Fixture()

    def tearDown(self) -> None:
        self.fx.cleanup()

    def assertFails(self, pattern: str, recipe=None) -> None:
        with self.assertRaisesRegex(aw.AssemblyError, pattern):
            self.fx.build(recipe)


class InputTests(FixtureTestCase):
    def test_missing_source_fails(self) -> None:
        (self.fx.input_dir / "wrestler_single.png").unlink()
        self.assertFails("source missing")

    def test_wrong_dimensions_fail(self) -> None:
        self.fx.sprite.resize((301, 300)).save(self.fx.input_dir / "wrestler_single.png")
        self.assertFails("size 301x300")

    def test_wrong_pixel_sha_fails(self) -> None:
        sprite = self.fx.sprite.copy()
        sprite.putpixel((150, 150), (1, 2, 3, 255))
        sprite.save(self.fx.input_dir / "wrestler_single.png")
        self.assertFails("decoded RGBA pixel SHA-256")

    def test_missing_alpha_fails(self) -> None:
        self.fx.sprite.convert("RGB").save(self.fx.input_dir / "wrestler_single.png")
        self.assertFails("no alpha channel")

    def test_meaningless_alpha_fails(self) -> None:
        Image.new("RGBA", self.fx.sprite.size, (9, 9, 9, 255)).save(self.fx.input_dir / "wrestler_single.png")
        self.assertFails("fully opaque")

    def test_same_pixel_reencode_is_accepted(self) -> None:
        self.fx.sprite.save(self.fx.input_dir / "wrestler_single.png", compress_level=1)
        source = self.fx.build().manifest["source"]
        self.assertEqual(source["pixel_sha256"], self.fx.recipe["source"]["pixel_sha256"])
        self.assertFalse(source["file_sha256_matches_reviewed"])


class RecipeTests(FixtureTestCase):
    def test_zero_body_core_fails(self) -> None:
        recipe = copy.deepcopy(self.fx.recipe)
        recipe["body_core_source_px"] = [[150, 150], [150, 150]]
        with self.assertRaisesRegex(aw.AssemblyError, "body-core reference length is 0"):
            ps.validate_recipe(recipe)

    def test_non_perpendicular_body_core_fails(self) -> None:
        recipe = copy.deepcopy(self.fx.recipe)
        recipe["body_core_source_px"] = [[100, 100], [200, 200]]
        with self.assertRaisesRegex(aw.AssemblyError, "off perpendicular"):
            ps.validate_recipe(recipe)

    def test_root_off_source_fails(self) -> None:
        recipe = copy.deepcopy(self.fx.recipe)
        recipe["root_source_px"] = [400, 10]
        with self.assertRaisesRegex(aw.AssemblyError, "root_source_px"):
            ps.validate_recipe(recipe)

    def test_large_orientation_correction_fails(self) -> None:
        recipe = copy.deepcopy(self.fx.recipe)
        recipe["orientation_correction_deg"] = 45
        with self.assertRaisesRegex(aw.AssemblyError, "orientation_correction_deg"):
            ps.validate_recipe(recipe)


class NormalizationTests(FixtureTestCase):
    def test_root_maps_inside_padded_image(self) -> None:
        sprite = self.fx.build().sprite_json
        for key in ("master", "runtime"):
            w, h = sprite[key]["size"]
            x, y = sprite[key]["pivot"]
            self.assertTrue(0 < x < w and 0 < y < h, key)
            self.assertEqual(w % (4 if key == "master" else 1), 0)
        self.assertEqual(sprite["master"]["pivot"], [v * 4 for v in sprite["runtime"]["pivot"]])

    def test_body_core_non_zero_and_runtime_scale(self) -> None:
        sprite = self.fx.build().sprite_json
        self.assertGreater(sprite["body_core_source_distance_px"], 0)
        self.assertAlmostEqual(sprite["runtime"]["body_core_length_px"], 0.35 * 400 / 2.275 * 2, delta=0.01)
        self.assertAlmostEqual(sprite["master"]["body_core_length_px"], aw.R_MASTER * 2, delta=0.01)
        # perpendicular to +X after the whole-sprite correction: both ends share x
        (ax, _), (bx, _) = sprite["runtime"]["body_core_px"]
        self.assertAlmostEqual(ax, bx, delta=0.01)

    def test_alpha_does_not_touch_sprite_edges(self) -> None:
        result = self.fx.build()
        for name in ("single_master.png", "single_runtime.png"):
            image = result.images[name]
            bbox = aw.alpha_bbox(image, 0)
            self.assertTrue(bbox[0] > 0 and bbox[1] > 0 and bbox[2] < image.width and bbox[3] < image.height, name)

    def test_orientation_correction_moves_axis_to_plus_x(self) -> None:
        # The knot (pure blue) must end up straight behind the root after the -10 deg correction.
        result = self.fx.build()
        runtime = result.images["single_runtime.png"]
        root = result.sprite_json["runtime"]["pivot"]
        blue = [(x, y) for y in range(runtime.height) for x in range(runtime.width)
                if runtime.getpixel((x, y))[2] > 150 and runtime.getpixel((x, y))[0] < 80 and
                runtime.getpixel((x, y))[3] > 200]
        cx = sum(p[0] + 0.5 for p in blue) / len(blue)
        cy = sum(p[1] + 0.5 for p in blue) / len(blue)
        self.assertLess(cx, root[0])
        angle = math.degrees(math.atan2(cy - root[1], cx - root[0]))
        self.assertAlmostEqual(abs(angle), 180.0, delta=3.0)


class PreviewTests(FixtureTestCase):
    def test_all_16_angles_generated_and_unclipped(self) -> None:
        result = self.fx.build()
        angles = result.sprite_json["rotation_preview"]["angles"]
        self.assertEqual([a["facing_deg"] for a in angles], [i * 22.5 for i in range(16)])
        tile = result.sprite_json["rotation_preview"]["tile_px"]
        sheet = result.images["single_runtime_16angles.png"]
        self.assertEqual(sheet.size, (tile * 4, (tile + ps.LABEL_HEIGHT) * 4))
        for a in angles:
            x0, y0, x1, y1 = a["alpha_bbox_in_tile"]
            self.assertTrue(x0 > 0 and y0 > 0 and x1 < tile and y1 < tile, a["facing_deg"])

    def test_runtime_pivot_identical_across_rotations(self) -> None:
        angles = self.fx.build().sprite_json["rotation_preview"]["angles"]
        roots = {tuple(a["root_in_tile_px"]) for a in angles}
        self.assertEqual(len(roots), 1)
        # no orbit / wobble: the alpha centroid keeps the same distance from the root at every angle
        distances = [a["alpha_centroid_distance_from_root_px"] for a in angles]
        self.assertLess(max(distances) - min(distances), 0.1)

    def test_rotated_tile_matches_direct_rotation(self) -> None:
        part = ps.aw.runtime_part(ps.normalize_sprite(self.fx.sprite, self.fx.recipe)[0])
        tile = 200
        layer = ps._tile_layer(part, tile, 90.0)
        expected = aw.place(part.image, (tile, tile), part.pivot, (100.0, 100.0), math.pi / 2, Image.BILINEAR)
        self.assertEqual(aw.pixel_sha256(layer), aw.pixel_sha256(expected))

    def test_arena_preview_size_and_roots(self) -> None:
        result = self.fx.build()
        self.assertEqual(result.images["single_on_arena_1920.png"].size, (1920, 1080))
        wrestlers = result.sprite_json["arena_preview"]["wrestlers"]
        px_per_m = 400 / 2.275
        self.assertAlmostEqual(wrestlers[0]["root_px"][0], 960 - 0.7 * px_per_m, places=5)
        self.assertAlmostEqual(wrestlers[1]["root_px"][0], 960 + 0.7 * px_per_m, places=5)
        self.assertEqual([w["root_px"][1] for w in wrestlers], [540.0, 540.0])
        self.assertEqual([w["facing_deg"] for w in wrestlers], [0.0, 180.0])

    def test_eight_facing_arena_sheet_generated(self) -> None:
        result = self.fx.build()
        info = result.sprite_json["arena_facings_preview"]
        tile = result.sprite_json["rotation_preview"]["tile_px"]
        self.assertEqual(info["facings_deg"], [i * 45.0 for i in range(8)])
        self.assertEqual(result.images["single_on_arena_8facings.png"].size, (tile * 4, (tile + ps.LABEL_HEIGHT) * 2))
        x0, y0, x1, y1 = info["arena_crop_box"]
        self.assertEqual(((x0 + x1) / 2, (y0 + y1) / 2), (960.0, 540.0))

    def test_all_output_names_produced(self) -> None:
        written = ps.write_outputs(self.fx.build(), self.fx.output_dir, [])
        self.assertEqual({p.name for p in written}, REQUIRED_OUTPUTS)
        self.assertEqual({p.name for p in self.fx.output_dir.iterdir()}, REQUIRED_OUTPUTS)

    def test_manifest_has_no_timestamp(self) -> None:
        result = self.fx.build()

        def keys(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    yield key
                    yield from keys(item)
            elif isinstance(value, list):
                for item in value:
                    yield from keys(item)

        for data in (result.manifest, result.sprite_json):
            for key in keys(data):
                self.assertNotRegex(key.lower(), r"timestamp|^time|_time|date|created|generated", key)
            self.assertNotRegex(aw.json_text(data), r"\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}")

    def test_deterministic_rerun_identical(self) -> None:
        first, second = self.fx.build(), self.fx.build()
        self.assertEqual(aw.json_text(first.manifest), aw.json_text(second.manifest))
        self.assertEqual(aw.json_text(first.sprite_json), aw.json_text(second.sprite_json))
        out_a, out_b = self.fx.output_dir / "a", self.fx.output_dir / "b"
        ps.write_outputs(first, out_a, [])
        ps.write_outputs(second, out_b, [])
        for name in REQUIRED_OUTPUTS:
            if name.endswith(".json"):
                self.assertEqual((out_a / name).read_bytes(), (out_b / name).read_bytes(), name)
            else:
                with Image.open(out_a / name) as a, Image.open(out_b / name) as b:
                    self.assertEqual(aw.pixel_sha256(a), aw.pixel_sha256(b), name)

    def test_cli_fail_closed_writes_nothing(self) -> None:
        (self.fx.input_dir / "wrestler_single.png").unlink()
        with redirect_stderr(io.StringIO()) as err:
            code = ps.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--arena-dir", str(self.fx.arena_dir), "--output-dir", str(self.fx.output_dir)])
        self.assertEqual(code, 2)
        self.assertIn("error:", err.getvalue())
        self.assertFalse(self.fx.output_dir.exists())

    def test_cli_success(self) -> None:
        with redirect_stdout(io.StringIO()):
            code = ps.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--arena-dir", str(self.fx.arena_dir), "--output-dir", str(self.fx.output_dir)])
        self.assertEqual(code, 0)
        manifest = json.loads((self.fx.output_dir / "build_single_manifest.json").read_text(encoding="ascii"))
        self.assertEqual(set(manifest["outputs"]), REQUIRED_OUTPUTS - {"single_sprite.json", "build_single_manifest.json"})


class RepositoryTests(unittest.TestCase):
    def test_local_input_and_outputs_are_git_ignored(self) -> None:
        repo = TOOL_DIR.parent.parent
        for path in ("tools/wrestler_art/input.local/wrestler_single.png",
                     "tools/wrestler_art/output-single.local/single_runtime.png",
                     "tools/wrestler_art/output-single.local/build_single_manifest.json"):
            result = subprocess.run(["git", "check-ignore", "-q", path], cwd=repo)
            self.assertEqual(result.returncode, 0, f"{path} is not ignored")
        tracked = subprocess.run(["git", "ls-files", "tools/wrestler_art"], cwd=repo, capture_output=True, text=True)
        self.assertNotRegex(tracked.stdout, r"\.local/|\.png")


REAL_INPUT = (aw.DEFAULT_INPUT_DIR / "wrestler_single.png").is_file()


@unittest.skipUnless(REAL_INPUT, "reviewed wrestler_single.png is not present in input.local/")
class RealSpriteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.recipe = ps.load_recipe(ps.DEFAULT_RECIPE)
        cls.result = ps.build(cls.recipe, aw.DEFAULT_INPUT_DIR, aw.DEFAULT_ARENA_DIR)

    def test_reviewed_pixels(self) -> None:
        self.assertEqual(self.result.manifest["source"]["pixel_sha256"],
                         "b621d2f56efa80968b71dba1cc4e31bfcc3ad133968adcebb33864b89de5fdf3")

    def test_runtime_body_core_is_accepted_scale(self) -> None:
        runtime = self.result.sprite_json["runtime"]
        self.assertAlmostEqual(runtime["body_core_length_px"], 123.0769, delta=0.01)
        # the painted torso really spans ~2R along that line at runtime
        image = self.result.images["single_runtime.png"]
        (ax, ay), (_, by) = runtime["body_core_px"]
        x = int(ax)
        mid = int((ay + by) / 2)
        alpha = [image.getpixel((x, y))[3] > 128 for y in range(image.height)]
        top = mid
        while top > 0 and alpha[top - 1]:
            top -= 1
        bottom = mid
        while bottom < image.height and alpha[bottom]:
            bottom += 1
        self.assertAlmostEqual(bottom - top, 2 * aw.R_RUNTIME, delta=3.0)

    def test_real_rerun_is_deterministic(self) -> None:
        again = ps.build(self.recipe, aw.DEFAULT_INPUT_DIR, aw.DEFAULT_ARENA_DIR)
        self.assertEqual(aw.json_text(self.result.manifest), aw.json_text(again.manifest))


if __name__ == "__main__":
    unittest.main()
