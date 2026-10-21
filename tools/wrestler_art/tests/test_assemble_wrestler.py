"""Focused tests for assemble_wrestler.py (ART-WRESTLER-02A).

Synthetic fixtures are built in temporary directories (never Product art). The
last test class also checks the real reviewed sources when they are present in
tools/wrestler_art/input.local/ and is skipped otherwise.
"""

from __future__ import annotations

import ast
import copy
import io
import json
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

REQUIRED_OUTPUTS = {
    "torso_master.png", "mawashi_master.png", "upper_arm_master.png", "forearm_hand_master.png",
    "head_master.png", "foot_master.png", "parts.json", "build_manifest.json", "idle_master.png",
    "idle_runtime.png", "idle_runtime_4angles.png", "idle_on_arena_1920.png", "pivot_guide.png",
}
SKIN = (240, 190, 150, 255)


def make_sheet() -> Image.Image:
    sheet = Image.new("RGBA", (400, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(sheet)
    d.ellipse((10, 10, 110, 90), fill=(30, 25, 25, 255))  # head
    d.ellipse((130, 10, 250, 100), fill=(30, 50, 200, 255))  # mawashi
    d.ellipse((165, 35, 215, 75), fill=(0, 0, 0, 0))
    d.ellipse((270, 10, 390, 120), fill=(255, 0, 0, 255))  # rejected sheet torso
    d.rounded_rectangle((10, 150, 130, 190), 15, fill=SKIN)  # upper arm
    d.rounded_rectangle((150, 150, 260, 185), 15, fill=SKIN)  # forearm + hand
    d.rounded_rectangle((280, 150, 360, 180), 12, fill=SKIN)  # foot
    return sheet


def make_torso() -> Image.Image:
    torso = Image.new("RGBA", (200, 180), (0, 0, 0, 0))
    ImageDraw.Draw(torso).ellipse((20, 20, 180, 160), fill=SKIN)
    return torso


def make_recipe(sheet: Image.Image, torso: Image.Image) -> dict:
    return {
        "recipe_schema": 1,
        "name": "synthetic",
        "sources": {
            "parts_sheet": {"file": "parts_sheet.png", "size": list(sheet.size),
                            "pixel_sha256": aw.rgba_pixel_sha256(sheet), "reviewed_file_sha256": "0" * 64},
            "torso": {"file": "torso.png", "size": list(torso.size),
                      "pixel_sha256": aw.rgba_pixel_sha256(torso), "reviewed_file_sha256": "0" * 64},
        },
        "rejected_regions": [{"source": "parts_sheet", "box": [265, 5, 395, 125], "reason": "test reject"}],
        "alpha_threshold": 8,
        "parts": {
            "torso": {"source": "torso", "box": [10, 10, 190, 170], "pivot": [100, 90],
                      "scale": {"measure": "alpha_height", "target_r": 2.0},
                      "joints": {"shoulder_r": [110, 150], "head": [130, 90], "mawashi": [90, 90]}},
            "mawashi": {"source": "parts_sheet", "box": [125, 5, 255, 105], "pivot": [190, 55],
                        "scale": {"measure": "alpha_height", "target_r": 1.3}, "joints": {}},
            "upper_arm": {"source": "parts_sheet", "box": [20, 145, 135, 195], "pivot": [12, 168], "axis_to": "elbow",
                          "scale": {"measure": "distance", "from": [12, 168], "to": [125, 172], "target_r": 0.85},
                          "joints": {"elbow": [125, 172]}},
            "forearm_hand": {"source": "parts_sheet", "box": [145, 145, 265, 190], "pivot": [165, 167],
                             "axis_to": "hand",
                             "scale": {"measure": "distance", "from": [155, 167], "to": [250, 167], "target_r": 0.95},
                             "joints": {"hand": [250, 167]}},
            "head": {"source": "parts_sheet", "box": [5, 5, 115, 95], "pivot": [60, 50],
                     "scale": {"measure": "alpha_height", "target_r": 0.9}, "joints": {}},
            "foot": {"source": "parts_sheet", "box": [275, 145, 365, 185], "pivot": [285, 165], "axis_to": "toe",
                     "scale": {"measure": "pivot_to_joint", "joint": "toe", "target_r": 0.6},
                     "joints": {"toe": [355, 165]}},
        },
        "idle": {"upper_arm_angle_deg": 95, "forearm_angle_deg": -10, "foot_ankle": [0.4, 0.7], "foot_angle_deg": 0},
        "layers": ["foot", "torso", "mawashi", "upper_arm", "forearm_hand", "head"],
    }


class Fixture:
    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.input_dir = root / "input.local"
        self.arena_dir = root / "arena"
        self.output_dir = root / "output.local"
        self.input_dir.mkdir()
        self.arena_dir.mkdir()
        self.sheet = make_sheet()
        self.torso = make_torso()
        self.sheet.save(self.input_dir / "parts_sheet.png")
        self.torso.save(self.input_dir / "torso.png")
        Image.new("RGB", aw.ARENA_SIZE, (200, 160, 110)).save(self.arena_dir / aw.ARENA_BASE_FILE)
        overlay = Image.new("RGBA", aw.ARENA_SIZE, (0, 0, 0, 0))
        ImageDraw.Draw(overlay).ellipse((560, 140, 1360, 940), outline=(220, 200, 150, 255), width=20)
        overlay.save(self.arena_dir / aw.ARENA_OVERLAY_FILE)
        self.recipe = make_recipe(self.sheet, self.torso)
        self.recipe_path = root / "recipe.json"
        self.recipe_path.write_text(json.dumps(self.recipe), encoding="utf-8")

    def build(self, recipe=None) -> aw.BuildResult:
        recipe = self.recipe if recipe is None else recipe
        aw.validate_recipe(recipe)
        return aw.build(recipe, self.input_dir, self.arena_dir)

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


class InputValidationTests(FixtureTestCase):
    def test_missing_source_fails(self) -> None:
        (self.fx.input_dir / "torso.png").unlink()
        self.assertFails("source missing")

    def test_wrong_parts_sheet_pixels_fail(self) -> None:
        sheet = self.fx.sheet.copy()
        sheet.putpixel((5, 5), (1, 2, 3, 255))
        sheet.save(self.fx.input_dir / "parts_sheet.png")
        self.assertFails("parts_sheet: decoded RGBA pixel SHA-256")

    def test_wrong_torso_pixels_fail(self) -> None:
        torso = self.fx.torso.copy()
        torso.putpixel((100, 90), (1, 2, 3, 255))
        torso.save(self.fx.input_dir / "torso.png")
        self.assertFails("torso: decoded RGBA pixel SHA-256")

    def test_wrong_expected_hash_fails(self) -> None:
        recipe = copy.deepcopy(self.fx.recipe)
        recipe["sources"]["parts_sheet"]["pixel_sha256"] = "f" * 64
        self.assertFails("parts_sheet: decoded RGBA pixel SHA-256", recipe)

    def test_reencoded_file_with_same_pixels_passes(self) -> None:
        # Different PNG bytes (compression level), identical decoded pixels: accepted, file hash recorded.
        self.fx.sheet.save(self.fx.input_dir / "parts_sheet.png", compress_level=1)
        info = self.fx.build().manifest["sources"]["parts_sheet"]
        self.assertEqual(info["pixel_sha256"], self.fx.recipe["sources"]["parts_sheet"]["pixel_sha256"])
        self.assertFalse(info["file_sha256_matches_reviewed"])
        self.assertEqual(len(info["file_sha256"]), 64)

    def test_wrong_dimensions_fail(self) -> None:
        self.fx.torso.resize((201, 180)).save(self.fx.input_dir / "torso.png")
        self.assertFails("size 201x180")

    def test_missing_alpha_fails(self) -> None:
        self.fx.sheet.convert("RGB").save(self.fx.input_dir / "parts_sheet.png")
        self.assertFails("no alpha channel")

    def test_opaque_alpha_fails(self) -> None:
        Image.new("RGBA", self.fx.torso.size, (10, 10, 10, 255)).save(self.fx.input_dir / "torso.png")
        self.assertFails("fully opaque")


class ExtractionTests(FixtureTestCase):
    def test_each_required_crop_is_non_empty(self) -> None:
        result = self.fx.build()
        for name in aw.PART_NAMES:
            image = result.images[aw.OUTPUT_PART_FILES[name]]
            self.assertIsNotNone(aw.alpha_bbox(image, 8), name)

    def test_empty_crop_fails(self) -> None:
        recipe = copy.deepcopy(self.fx.recipe)
        recipe["parts"]["head"]["box"] = [0, 120, 8, 140]
        recipe["parts"]["head"]["pivot"] = [4, 130]
        self.assertFails("'head': crop .* is empty", recipe)

    def test_torso_from_parts_sheet_is_rejected(self) -> None:
        recipe = copy.deepcopy(self.fx.recipe)
        recipe["parts"]["torso"]["source"] = "parts_sheet"
        self.assertFails("torso must come from the replacement torso source", recipe)

    def test_crop_touching_rejected_pixels_fails(self) -> None:
        recipe = copy.deepcopy(self.fx.recipe)
        recipe["parts"]["mawashi"]["box"] = [125, 5, 300, 105]
        self.assertFails("includes visible pixels of rejected region", recipe)

    def test_rejected_pixels_never_reach_outputs(self) -> None:
        # The rejected sheet torso is pure red; no part (or the assembly) may contain it.
        result = self.fx.build()
        for name in list(aw.OUTPUT_PART_FILES.values()) + [aw.OUTPUT_IDLE_MASTER]:
            colors = result.images[name].getcolors(maxcolors=1 << 22)
            self.assertNotIn((255, 0, 0, 255), [c for _, c in colors], name)

    def test_normalized_parts_have_alpha(self) -> None:
        result = self.fx.build()
        for name in aw.PART_NAMES:
            image = result.images[aw.OUTPUT_PART_FILES[name]]
            self.assertEqual(image.mode, "RGBA")
            low, high = image.getchannel("A").getextrema()
            self.assertEqual(low, 0, name)
            self.assertGreater(high, 200, name)
            # transparent padding on every edge
            self.assertEqual(image.getchannel("A").crop((0, 0, image.width, 1)).getextrema(), (0, 0), name)
            self.assertEqual(image.width % 4, 0)
            self.assertEqual(image.height % 4, 0)

    def test_pivots_and_joints_inside_padded_images(self) -> None:
        parts = self.fx.build().parts_json["parts"]
        for name, entry in parts.items():
            w, h = entry["size"]
            for label, (x, y) in [("pivot", entry["pivot"])] + list(entry["joints"].items()):
                self.assertTrue(0 < x < w and 0 < y < h, f"{name} {label} {(x, y)} not inside {w}x{h}")
            self.assertEqual(entry["pivot"][0] % 4, 0)
            self.assertEqual(entry["pivot"][1] % 4, 0)

    def test_axis_parts_point_plus_x(self) -> None:
        parts = self.fx.build().parts_json["parts"]
        for name, joint in (("upper_arm", "elbow"), ("forearm_hand", "hand"), ("foot", "toe")):
            pivot, end = parts[name]["pivot"], parts[name]["joints"][joint]
            self.assertGreater(end[0] - pivot[0], 0, name)
            self.assertAlmostEqual(end[1], pivot[1], places=4, msg=name)

    def test_upper_arm_length_positive(self) -> None:
        entry = self.fx.build().parts_json["parts"]["upper_arm"]
        self.assertGreater(entry["length_master_px"], 0)
        self.assertAlmostEqual(entry["length_r"], 0.85, places=4)

    def test_forearm_length_positive(self) -> None:
        entry = self.fx.build().parts_json["parts"]["forearm_hand"]
        self.assertGreater(entry["length_master_px"], 0)
        self.assertGreater(entry["length_r"], 0)


class MirrorTests(FixtureTestCase):
    def test_mirrored_left_part_is_deterministic(self) -> None:
        recipe = self.fx.recipe
        sheet = self.fx.sheet
        part, _ = aw.extract_part("upper_arm", recipe["parts"]["upper_arm"], sheet, 8)
        left_a = aw.mirror_part(part)
        left_b = aw.mirror_part(part)
        self.assertEqual(aw.pixel_sha256(left_a.image), aw.pixel_sha256(left_b.image))
        self.assertEqual(left_a.pivot, (part.pivot[0], part.image.height - part.pivot[1]))
        self.assertEqual(left_a.joints["elbow"], (part.joints["elbow"][0], part.image.height - part.joints["elbow"][1]))
        self.assertEqual(aw.pixel_sha256(aw.mirror_part(left_a).image), aw.pixel_sha256(part.image))
        self.assertEqual(aw.pixel_sha256(left_a.image),
                         aw.pixel_sha256(part.image.transpose(Image.FLIP_TOP_BOTTOM)))

    def test_left_side_geometry_is_mirrored(self) -> None:
        idle = self.fx.build().parts_json["idle_r"]
        for joint in ("shoulder", "elbow", "hand", "ankle", "toe"):
            right, left = idle[f"{joint}_r"], idle[f"{joint}_l"]
            self.assertAlmostEqual(left[0], right[0], places=6)
            self.assertAlmostEqual(left[1], -right[1], places=6)
            self.assertGreater(right[1], 0, joint)


class OutputTests(FixtureTestCase):
    def test_all_output_names_produced(self) -> None:
        result = self.fx.build()
        written = aw.write_outputs(result, self.fx.output_dir, [])
        self.assertEqual({p.name for p in written}, REQUIRED_OUTPUTS)
        self.assertEqual({p.name for p in self.fx.output_dir.iterdir()}, REQUIRED_OUTPUTS)

    def test_runtime_scale_matches_accepted_character_scale(self) -> None:
        self.assertAlmostEqual(aw.R_RUNTIME, 0.35 * 400 / 2.275, places=9)
        self.assertAlmostEqual(aw.R_RUNTIME * 2, 123.08, places=2)
        self.assertAlmostEqual(aw.R_MASTER, aw.R_RUNTIME * 4, places=9)
        result = self.fx.build()
        torso = result.images["torso_master.png"]
        bbox = aw.alpha_bbox(torso, 8)
        self.assertAlmostEqual((bbox[3] - bbox[1]) / aw.MASTER_FACTOR, 2 * aw.R_RUNTIME, delta=2.0)
        runtime = result.images["idle_runtime.png"]
        self.assertEqual(runtime.size[0] * aw.MASTER_FACTOR, result.images["idle_master.png"].size[0])
        # the torso (shoulder to shoulder) spans ~123 px across the runtime root column
        column = runtime.getchannel("A").crop((runtime.width // 2 - 2, 0, runtime.width // 2 + 2, runtime.height))
        _, top, _, bottom = column.point(lambda a: 255 if a > 128 else 0).getbbox()
        self.assertGreater(bottom - top, 2 * aw.R_RUNTIME - 6)

    def test_four_angle_preview_generated(self) -> None:
        result = self.fx.build()
        sheet = result.images["idle_runtime_4angles.png"]
        tile = result.images["idle_runtime.png"].width
        self.assertEqual(sheet.size, (tile * 4, tile + 30))
        empty = Image.new("RGBA", (tile, tile), aw.ANGLES_BACKGROUND)
        for i in range(4):
            crop = sheet.crop((i * tile, 30, (i + 1) * tile, 30 + tile))
            self.assertNotEqual(aw.pixel_sha256(crop), aw.pixel_sha256(empty), f"tile {i}")
        self.assertEqual(result.images["idle_runtime.png"].getchannel("A").getextrema()[0], 0)

    def test_arena_composite_size_and_wrestlers(self) -> None:
        result = self.fx.build()
        arena = result.images["idle_on_arena_1920.png"]
        self.assertEqual(arena.size, (1920, 1080))
        roots = [w["root_px"] for w in result.manifest["arena_preview"]["wrestlers"]]
        self.assertAlmostEqual(roots[0][0], 960 - 0.7 * 400 / 2.275, places=4)
        self.assertAlmostEqual(roots[1][0], 960 + 0.7 * 400 / 2.275, places=4)
        self.assertNotEqual(arena.getpixel((round(roots[0][0]), 540)), (200, 160, 110))

    def test_manifest_has_no_timestamp(self) -> None:
        manifest = self.fx.build().manifest

        def keys(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    yield key
                    yield from keys(item)
            elif isinstance(value, list):
                for item in value:
                    yield from keys(item)

        for key in keys(manifest):
            self.assertNotRegex(key.lower(), r"timestamp|^time|_time|date|created|generated", key)
        self.assertNotRegex(aw.json_text(manifest), r"\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}")

    def test_deterministic_rerun_identical(self) -> None:
        first = self.fx.build()
        second = self.fx.build()
        self.assertEqual(aw.json_text(first.manifest), aw.json_text(second.manifest))
        self.assertEqual(aw.json_text(first.parts_json), aw.json_text(second.parts_json))
        out_a, out_b = self.fx.output_dir / "a", self.fx.output_dir / "b"
        aw.write_outputs(first, out_a, [])
        aw.write_outputs(second, out_b, [])
        for name in REQUIRED_OUTPUTS:
            if name.endswith(".json"):
                self.assertEqual((out_a / name).read_bytes(), (out_b / name).read_bytes(), name)
            else:
                with Image.open(out_a / name) as a, Image.open(out_b / name) as b:
                    self.assertEqual(aw.pixel_sha256(a), aw.pixel_sha256(b), name)

    def test_cli_fail_closed_writes_nothing(self) -> None:
        (self.fx.input_dir / "torso.png").unlink()
        with redirect_stderr(io.StringIO()) as err:
            code = aw.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--arena-dir", str(self.fx.arena_dir), "--output-dir", str(self.fx.output_dir)])
        self.assertEqual(code, 2)
        self.assertIn("error:", err.getvalue())
        self.assertFalse(self.fx.output_dir.exists())

    def test_cli_success(self) -> None:
        with redirect_stdout(io.StringIO()):
            code = aw.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                        "--arena-dir", str(self.fx.arena_dir), "--output-dir", str(self.fx.output_dir)])
        self.assertEqual(code, 0)
        manifest = json.loads((self.fx.output_dir / "build_manifest.json").read_text(encoding="ascii"))
        self.assertEqual(set(manifest["outputs"]), REQUIRED_OUTPUTS - {"parts.json", "build_manifest.json"})


class RepositoryTests(unittest.TestCase):
    def test_local_inputs_and_outputs_are_git_ignored(self) -> None:
        repo = TOOL_DIR.parent.parent
        paths = [
            "tools/wrestler_art/input.local/parts_sheet.png",
            "tools/wrestler_art/input.local/torso.png",
            "tools/wrestler_art/output-assembly.local/idle_master.png",
            "tools/wrestler_art/output-assembly.local/build_manifest.json",
            "tools/wrestler_art/.venv/pyvenv.cfg",
        ]
        for path in paths:
            result = subprocess.run(["git", "check-ignore", "-q", path], cwd=repo)
            self.assertEqual(result.returncode, 0, f"{path} is not ignored")
        tracked = subprocess.run(["git", "ls-files", "tools/wrestler_art"], cwd=repo, capture_output=True, text=True)
        self.assertNotRegex(tracked.stdout, r"\.local/|\.png")

    def test_tool_imports_only_stdlib_and_pillow(self) -> None:
        tree = ast.parse((TOOL_DIR / "assemble_wrestler.py").read_text(encoding="utf-8"))
        modules = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                modules.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                modules.add((node.module or "").split(".")[0])
        stdlib = {"__future__", "argparse", "hashlib", "json", "math", "os", "shutil", "sys", "tempfile",
                  "dataclasses", "pathlib", "typing"}
        self.assertEqual(modules - stdlib, {"PIL"})


REAL_INPUTS = all((aw.DEFAULT_INPUT_DIR / name).is_file() for name in ("parts_sheet.png", "torso.png"))


@unittest.skipUnless(REAL_INPUTS, "reviewed source images are not present in input.local/")
class RealRecipeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.recipe = aw.load_recipe(aw.DEFAULT_RECIPE)
        cls.result = aw.build(cls.recipe, aw.DEFAULT_INPUT_DIR, aw.DEFAULT_ARENA_DIR)

    def test_recipe_uses_replacement_torso_and_avoids_rejected_sheet_torso(self) -> None:
        self.assertEqual(self.recipe["parts"]["torso"]["source"], "torso")
        self.assertEqual(self.result.parts_json["parts"]["torso"]["crop"]["source"], "torso")
        rejected = self.recipe["rejected_regions"][0]["box"]
        sheet = Image.open(aw.DEFAULT_INPUT_DIR / "parts_sheet.png").convert("RGBA")
        for name, spec in self.recipe["parts"].items():
            if spec["source"] != "parts_sheet":
                continue
            x0, y0 = max(spec["box"][0], rejected[0]), max(spec["box"][1], rejected[1])
            x1, y1 = min(spec["box"][2], rejected[2]), min(spec["box"][3], rejected[3])
            if x0 < x1 and y0 < y1:
                self.assertIsNone(aw.alpha_bbox(sheet.crop((x0, y0, x1, y1)), 8), name)

    def test_reviewed_source_pixels(self) -> None:
        sources = self.result.manifest["sources"]
        self.assertEqual(sources["parts_sheet"]["pixel_sha256"],
                         "fecca71805ba1aebb51fdb09b79ebca647ed85a4b6b3072eb1b384ee538b7cbc")
        self.assertEqual(sources["torso"]["pixel_sha256"],
                         "8fe2791c4c7e1f43bcd8816d0a898e31c6f61a1c7127fe109488891ee0183094")

    def test_runtime_torso_matches_accepted_scale(self) -> None:
        bbox = aw.alpha_bbox(self.result.images["torso_master.png"], 8)
        self.assertAlmostEqual((bbox[3] - bbox[1]) / aw.MASTER_FACTOR, 2 * aw.R_RUNTIME, delta=1.0)

    def test_real_rerun_is_deterministic(self) -> None:
        again = aw.build(self.recipe, aw.DEFAULT_INPUT_DIR, aw.DEFAULT_ARENA_DIR)
        self.assertEqual(aw.json_text(self.result.manifest), aw.json_text(again.manifest))


if __name__ == "__main__":
    unittest.main()
