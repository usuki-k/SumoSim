"""Focused tests for export_grip_attempt_gate.py (ACTION-11A temporary Grip attempt Visual Gate).

A synthetic red pose (never Product art) checks normalization, the red -> blue derivation, determinism and
fail-closed behaviour. The last class checks the committed gate textures, the TypeScript metadata and that the
accepted idle / Product Tsuppari / Product Counter textures are untouched (skipped when the local source is not present).
"""

from __future__ import annotations

import io
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

from PIL import Image, ImageDraw, ImageOps

TOOL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOL_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import assemble_wrestler as aw  # noqa: E402
import export_counter as ec  # noqa: E402
import export_grip_attempt_gate as eg  # noqa: E402
import export_runtime_wrestlers as ex  # noqa: E402
import export_tsuppari as et  # noqa: E402
import preview_idle_mirror_workflow as im  # noqa: E402
from test_export_counter import ACCEPTED_COUNTER_PIXELS  # noqa: E402
from test_export_runtime_wrestlers import ACCEPTED_BLUE_PIXELS, ACCEPTED_RED_PIXELS  # noqa: E402
from test_export_tsuppari import ACCEPTED_SEPARATE_PIXELS  # noqa: E402
from test_preview_dual_rigid_wrestlers import front_point, sprite_recipe  # noqa: E402

TS_METADATA = aw.REPO_ROOT / "src" / "game" / "presentation" / "gripAttemptGateArt.ts"
RECIPE = eg.load_recipe(eg.DEFAULT_RECIPE)
ACCEPTED_SOURCE_PIXELS = "323a7e79829c371345e8561ef3dd8ff6f49541eceb74450ec418b16c328478e0"
GATE_PIXELS = {
    "red.png": "9501d5301bbb982072bf419636c2ffb19f0ab9a3c72477172158a64f9dee57da",
    "blue.png": "828bbf803a41bbc19f16a1d691c0c3dc8dbb26d87c83a7ce673bc5f682c59098",
}
FRONT_DEG = 165.0


def make_pose() -> Image.Image:
    """Synthetic red wrestler: body, red belt behind, one asymmetric arm (so the reflection is visible)."""
    sprite = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(sprite)
    d.ellipse((90, 90, 210, 210), fill=(240, 190, 150, 255))
    kx, ky = front_point(FRONT_DEG + 180, 50)
    d.rectangle((kx - 22, ky - 30, kx + 22, ky + 30), fill=(210, 40, 40, 255))
    hx, hy = front_point(FRONT_DEG - 40, 100)
    d.ellipse((hx - 12, hy - 12, hx + 12, hy + 12), fill=(0, 255, 0, 255))
    return sprite


def load_raw_recipe() -> dict:
    recipe = json.loads(eg.DEFAULT_RECIPE.read_text(encoding="utf-8"))
    recipe["runtime_recipe"] = str(ex.DEFAULT_RECIPE)
    return recipe


class Fixture:
    """Temp input dir with the synthetic red Grip attempt pose only, and a recipe for it."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.input_dir = root / "input.local"
        self.input_dir.mkdir()
        self.out_dir = root / "grip-attempt-gate"
        recipe = load_raw_recipe()
        image = make_pose()
        spec = sprite_recipe("red", image, FRONT_DEG)
        spec["file"] = "synthetic_red_grip_attempt.png"
        image.save(self.input_dir / spec["file"])
        recipe["master"] = {"key": "red", **spec}
        recipe["mask_limits"] = {"min_mask_px": 500, "max_missed_px": 60, "max_fringe_px": 200}
        self.recipe_path = root / "grip_attempt_gate_recipe.json"
        self.recipe_path.write_text(json.dumps(recipe), encoding="utf-8")
        self.recipe = eg.load_recipe(self.recipe_path)

    def cleanup(self) -> None:
        self._tmp.cleanup()


class RecipeTests(unittest.TestCase):
    def test_user_source_identity(self) -> None:
        self.assertEqual(RECIPE["master"]["pixel_sha256"], ACCEPTED_SOURCE_PIXELS)
        self.assertEqual(RECIPE["master"]["file"], "candidate_red_grip_attempt.png")
        self.assertEqual(RECIPE["master"]["size"], [1254, 1254])
        self.assertEqual(RECIPE["master"]["key"], "red")

    def test_standard_mask_limits_without_grip_allowance(self) -> None:
        standard = et.load_recipe(et.DEFAULT_RECIPE)["mask_limits"]
        for field in ("min_mask_px", "max_missed_px", "max_fringe_px"):
            self.assertEqual(RECIPE["mask_limits"][field], standard[field], field)

    def test_recolor_rule_is_owned_by_the_idle_runtime_recipe(self) -> None:
        self.assertEqual(RECIPE["recolor"], ex.load_recipe(ex.DEFAULT_RECIPE)["derived"]["recolor"])
        self.assertNotIn("recolor", json.loads(eg.DEFAULT_RECIPE.read_text(encoding="utf-8")))

    def test_invalid_recipes_fail(self) -> None:
        cases = [
            (lambda r: r["master"].update(key="blue"), "must be the red pose"),
            (lambda r: r["master"].pop("root_source_px"), "missing 'root_source_px'"),
            (lambda r: r["master"].update(source_front_deg=100.0), "off perpendicular"),
            (lambda r: r["mask_limits"].pop("min_mask_px"), "mask_limits.min_mask_px"),
        ]
        for mutate, pattern in cases:
            recipe = load_raw_recipe()
            mutate(recipe)
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "recipe.json"
                path.write_text(json.dumps(recipe), encoding="utf-8")
                with self.assertRaisesRegex(aw.AssemblyError, pattern):
                    eg.load_recipe(path)


class ExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = Fixture()

    def tearDown(self) -> None:
        self.fx.cleanup()

    def run_cli(self, *extra: str) -> int:
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            return eg.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--out-dir", str(self.fx.out_dir), *extra])

    def test_exactly_two_files_from_the_one_red_pose(self) -> None:
        self.assertEqual(self.run_cli(), 0)
        self.assertEqual(sorted(p.name for p in self.fx.out_dir.iterdir()), ["blue.png", "red.png"])

    def test_red_is_the_normalized_pose_and_blue_its_reflected_recolor(self) -> None:
        spec = self.fx.recipe["master"]
        red_ref = et.normalize(spec, self.fx.input_dir / spec["file"], "ref", self.fx.recipe["alpha_threshold"])
        red, blue = eg.build_textures(self.fx.recipe, self.fx.input_dir)
        self.assertEqual(red.part.image.tobytes(), red_ref.image.tobytes())
        self.assertEqual(red.part.pivot, red_ref.pivot)
        reflected = aw.mirror_part(red_ref)
        self.assertEqual(blue.part.image.size, reflected.image.size)
        self.assertEqual(blue.part.pivot, reflected.pivot)
        for t in (red, blue):
            self.assertAlmostEqual(im.body_core_length(im.Sprite(t.part, "t")), 2 * aw.R_RUNTIME, places=5)
        self.assertEqual(blue.part.image.getchannel("A").tobytes(), reflected.image.getchannel("A").tobytes())
        rule = self.fx.recipe["recolor"]
        self.assertEqual(blue.mask, im.mawashi_mask(reflected.image, rule))
        self.assertGreater(len(blue.mask), 500)
        bp, rp = blue.part.image.load(), reflected.image.load()
        changed = 0
        for y in range(reflected.image.height):
            for x in range(reflected.image.width):
                if (x, y) not in blue.mask:
                    self.assertEqual(bp[x, y], rp[x, y], (x, y))
                elif bp[x, y] != rp[x, y]:
                    changed += 1
        self.assertGreater(changed, 0)

    def test_only_one_local_y_reflection(self) -> None:
        original = Image.Image.transpose
        calls = []

        def spy(image, method):
            calls.append(method)
            return original(image, method)

        with mock.patch.object(Image.Image, "transpose", spy), mock.patch.object(ImageOps, "mirror", None):
            eg.build_textures(self.fx.recipe, self.fx.input_dir)
        self.assertEqual(calls, [Image.FLIP_TOP_BOTTOM])

    def test_deterministic_export(self) -> None:
        first = eg.export(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        data = {name: (self.fx.out_dir / name).read_bytes() for name in eg.OUTPUT_FILES}
        again = self.fx.out_dir.parent / "again"
        self.assertEqual(eg.export(self.fx.recipe, self.fx.input_dir, again), first)
        for name, blob in data.items():
            self.assertEqual((again / name).read_bytes(), blob)

    def test_check_writes_nothing_and_detects_stale_or_missing(self) -> None:
        eg.export(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        before = {p.name: p.read_bytes() for p in self.fx.out_dir.iterdir()}
        self.assertEqual(self.run_cli("--check"), 0)
        self.assertEqual({p.name: p.read_bytes() for p in self.fx.out_dir.iterdir()}, before)
        path = self.fx.out_dir / "blue.png"
        image = Image.open(path).convert("RGBA")
        image.putpixel((0, 0), (255, 0, 0, 255))
        image.save(path)
        with self.assertRaisesRegex(aw.AssemblyError, "committed pixels differ"):
            eg.check(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        self.assertEqual(self.run_cli("--check"), 2)
        path.unlink()
        with self.assertRaisesRegex(aw.AssemblyError, "files"):
            eg.check(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        self.assertFalse(path.exists())

    def test_missing_or_changed_source_fails_closed(self) -> None:
        source = self.fx.input_dir / "synthetic_red_grip_attempt.png"
        source.unlink()
        self.assertEqual(self.run_cli(), 2)
        self.assertFalse(self.fx.out_dir.exists())
        image = make_pose()
        image.putpixel((0, 0), (1, 2, 3, 255))
        image.save(source)
        with self.assertRaisesRegex(aw.AssemblyError, "decoded RGBA pixel SHA-256"):
            eg.build_textures(self.fx.recipe, self.fx.input_dir)

    def test_mask_limits_fail_closed(self) -> None:
        recipe = json.loads(json.dumps(self.fx.recipe))
        recipe["mask_limits"]["min_mask_px"] = 10 ** 6
        with self.assertRaisesRegex(aw.AssemblyError, "has only"):
            eg.build_textures(recipe, self.fx.input_dir)


class RepositoryTests(unittest.TestCase):
    def test_source_is_ignored_and_gate_textures_are_not(self) -> None:
        result = subprocess.run(["git", "check-ignore", "tools/wrestler_art/input.local/candidate_red_grip_attempt.png"],
                                cwd=aw.REPO_ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        result = subprocess.run(["git", "check-ignore", "-q", "public/assets/action/wrestler/grip-attempt-gate/red.png"],
                                cwd=aw.REPO_ROOT)
        self.assertEqual(result.returncode, 1)


def ts_metadata() -> dict:
    text = TS_METADATA.read_text(encoding="utf-8")
    rows = re.findall(r"assetPath: 'assets/action/wrestler/grip-attempt-gate/(\w+)\.png',\s*width: (\d+),\s*"
                      r"height: (\d+),\s*pivot: \{ x: ([0-9.]+), y: ([0-9.]+) \}", text)
    core = float(re.search(r"GRIP_ATTEMPT_GATE_BODY_CORE_DIAMETER_PX = ([0-9.]+)", text).group(1))
    return {f"{color}.png": {"size": [int(w), int(h)], "pivot": [float(x), float(y)], "body_core_px": core}
            for color, w, h, x, y in rows}


REAL_INPUT = (aw.DEFAULT_INPUT_DIR / RECIPE["master"]["file"]).is_file()


@unittest.skipUnless(REAL_INPUT, "candidate_red_grip_attempt.png is not present in input.local/")
class CommittedGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # only the red Grip attempt pose is visible to the exporter
        cls._tmp = tempfile.TemporaryDirectory()
        cls.input_dir = Path(cls._tmp.name)
        shutil.copyfile(aw.DEFAULT_INPUT_DIR / RECIPE["master"]["file"], cls.input_dir / RECIPE["master"]["file"])
        cls.report = {e["file"]: e for e in eg.check(RECIPE, cls.input_dir, eg.DEFAULT_GATE_DIR)}

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def test_committed_textures_match_a_red_only_fresh_export(self) -> None:
        self.assertEqual(sorted(self.report), ["blue.png", "red.png"])
        for entry in self.report.values():
            self.assertAlmostEqual(entry["body_core_px"], 123.076923, places=5)

    def test_gate_pixels_sizes_and_pivots(self) -> None:
        self.assertEqual({name: e["pixel_sha256"] for name, e in self.report.items()}, GATE_PIXELS)
        self.assertEqual({name: (e["size"], e["pivot"]) for name, e in self.report.items()},
                         {"red.png": ([195, 190], [81.0, 105.0]), "blue.png": ([195, 190], [81.0, 85.0])})

    def test_typescript_metadata_matches_the_export(self) -> None:
        ts = ts_metadata()
        self.assertEqual(sorted(ts), ["blue.png", "red.png"])
        for name, entry in self.report.items():
            self.assertEqual(ts[name]["size"], entry["size"], name)
            self.assertEqual(ts[name]["pivot"], entry["pivot"], name)
            self.assertAlmostEqual(ts[name]["body_core_px"], entry["body_core_px"], places=5)

    def test_real_mask_covers_the_mawashi(self) -> None:
        spec = RECIPE["master"]
        red = et.normalize(spec, self.input_dir / spec["file"], "red", RECIPE["alpha_threshold"])
        source = aw.mirror_part(red)
        rule = RECIPE["recolor"]
        self.assertEqual(et.mask_report(source.image, im.mawashi_mask(source.image, rule), rule),
                         {"mask_px": 2220, "missed_band_px": 15, "fringe_px": 72})

    def test_accepted_idle_tsuppari_and_counter_textures_unchanged(self) -> None:
        for key, expected in (("red", ACCEPTED_RED_PIXELS), ("blue", ACCEPTED_BLUE_PIXELS)):
            with Image.open(ex.DEFAULT_RUNTIME_DIR / f"{key}.png") as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)
        for name, expected in ACCEPTED_SEPARATE_PIXELS.items():
            with Image.open(et.DEFAULT_TSUPPARI_DIR / name) as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)
        for name, expected in ACCEPTED_COUNTER_PIXELS.items():
            with Image.open(ec.DEFAULT_COUNTER_DIR / name) as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)


if __name__ == "__main__":
    unittest.main()
