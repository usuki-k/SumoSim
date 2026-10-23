"""Focused tests for export_grip_success_gate.py (ACTION-11D temporary Grip success Visual Gate).

A synthetic red pose (never Product art) checks normalization, the ACTION-11H skin tone match, the red -> blue
derivation, determinism and fail-closed behaviour. The last class checks the committed gate textures, the TypeScript metadata and that the
accepted idle / Product Tsuppari / Product Counter / Grip attempt gate textures are untouched (skipped when the
local source is not present).
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
import export_grip_attempt_gate as ea  # noqa: E402
import export_grip_success_gate as eg  # noqa: E402
import export_runtime_wrestlers as ex  # noqa: E402
import export_tsuppari as et  # noqa: E402
import measure_tsuppari_pose as mt  # noqa: E402
import preview_idle_mirror_workflow as im  # noqa: E402
from test_export_counter import ACCEPTED_COUNTER_PIXELS  # noqa: E402
from test_export_runtime_wrestlers import ACCEPTED_BLUE_PIXELS, ACCEPTED_RED_PIXELS  # noqa: E402
from test_export_grip_attempt_gate import GATE_PIXELS as ATTEMPT_GATE_PIXELS  # noqa: E402
from test_export_tsuppari import ACCEPTED_SEPARATE_PIXELS  # noqa: E402
from test_preview_dual_rigid_wrestlers import front_point, sprite_recipe  # noqa: E402

TS_METADATA = aw.REPO_ROOT / "src" / "game" / "presentation" / "gripSuccessGateArt.ts"
RECIPE = eg.load_recipe(eg.DEFAULT_RECIPE)
ACCEPTED_SOURCE_PIXELS = "0cedde984646384514e3b1609b69f04450d04c5446888da966de206a183e566e"
GATE_PIXELS = {
    "red.png": "5852751b85dae79826848bd6daec751fa3addc572b5943ff95047f22c1187221",
    "blue.png": "624d2d51b9fba3a24aebcf6750335abc8054dd1fd5cfd239469daa679ee542e2",
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
    """Temp input dir with the synthetic red Grip success pose only, and a recipe for it."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.input_dir = root / "input.local"
        self.input_dir.mkdir()
        self.out_dir = root / "grip-success-gate"
        recipe = load_raw_recipe()
        image = make_pose()
        spec = sprite_recipe("red", image, FRONT_DEG)
        spec["file"] = "synthetic_red_grip_success.png"
        image.save(self.input_dir / spec["file"])
        recipe["master"] = {"key": "red", **spec}
        recipe["mask_limits"] = {"min_mask_px": 500, "max_missed_px": 60, "max_fringe_px": 200}
        self.recipe_path = root / "grip_success_gate_recipe.json"
        self.recipe_path.write_text(json.dumps(recipe), encoding="utf-8")
        self.recipe = eg.load_recipe(self.recipe_path)

    def cleanup(self) -> None:
        self._tmp.cleanup()


class RecipeTests(unittest.TestCase):
    def test_user_source_identity(self) -> None:
        self.assertEqual(RECIPE["master"]["pixel_sha256"], ACCEPTED_SOURCE_PIXELS)
        self.assertEqual(RECIPE["master"]["file"], "candidate_red_grip_success.png")
        self.assertEqual(RECIPE["master"]["size"], [1283, 1226])
        self.assertEqual(RECIPE["master"]["key"], "red")

    def test_standard_mask_limits_without_grip_success_allowance(self) -> None:
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
            (lambda r: r["skin_tone_match"].pop("curve_points"), "missing 'curve_points'"),
            (lambda r: r["skin_tone_match"]["curve_points"].insert(2, [0.5, 0.3]), "strictly increasing"),
            (lambda r: r["skin_tone_match"]["curve_points"].__setitem__(-1, [1.0, 0.9]), r"\(0, 0\) to \(1, 1\)"),
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

    def test_red_is_the_tone_matched_normalized_pose_and_blue_its_reflected_recolor(self) -> None:
        # T13 / T14: red = normalized + skin tone match; blue = reflection of that corrected red + mawashi recolor
        spec = self.fx.recipe["master"]
        normalized = et.normalize(spec, self.fx.input_dir / spec["file"], "ref", self.fx.recipe["alpha_threshold"])
        toned, _ = eg.tone_match(normalized.image, eg.skin_mask(normalized.image, self.fx.recipe),
                                 self.fx.recipe["skin_tone_match"]["curve_points"])
        red_ref = aw.Part(toned, normalized.pivot, dict(normalized.joints))
        red, blue = eg.build_textures(self.fx.recipe, self.fx.input_dir)
        self.assertNotEqual(toned.tobytes(), normalized.image.tobytes())  # the synthetic skin is corrected
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

    def test_tone_match_runs_once_on_red_only(self) -> None:
        # T15: the skin correction is computed once (on red), never again for blue
        calls = []
        original = eg.tone_match

        def spy(image, mask, points):
            calls.append(image.size)
            return original(image, mask, points)

        with mock.patch.object(eg, "tone_match", spy):
            eg.build_textures(self.fx.recipe, self.fx.input_dir)
        self.assertEqual(len(calls), 1)

    def test_tone_match_touches_only_skin_rgb(self) -> None:
        # T7 / T8 / T9 on the synthetic pose
        spec = self.fx.recipe["master"]
        image = et.normalize(spec, self.fx.input_dir / spec["file"], "ref", self.fx.recipe["alpha_threshold"]).image
        mask = eg.skin_mask(image, self.fx.recipe)
        self.assertEqual(mask, eg.skin_mask(image, self.fx.recipe))  # deterministic
        self.assertGreater(len(mask), 0)
        out, _ = eg.tone_match(image, mask, self.fx.recipe["skin_tone_match"]["curve_points"])
        self.assertEqual(out.getchannel("A").tobytes(), image.getchannel("A").tobytes())
        a, b = image.load(), out.load()
        for y in range(image.height):
            for x in range(image.width):
                if (x, y) not in mask:
                    self.assertEqual(a[x, y], b[x, y], (x, y))

    def test_tone_curve_is_monotonic(self) -> None:
        # T10
        points = self.fx.recipe["skin_tone_match"]["curve_points"]
        samples = [eg.tone_curve(points, i / 1000) for i in range(1001)]
        self.assertEqual(samples[0], 0.0)
        self.assertAlmostEqual(samples[-1], 1.0, places=12)
        for lo, hi in zip(samples, samples[1:]):
            self.assertLess(lo, hi)

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
        source = self.fx.input_dir / "synthetic_red_grip_success.png"
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
        result = subprocess.run(["git", "check-ignore", "tools/wrestler_art/input.local/candidate_red_grip_success.png"],
                                cwd=aw.REPO_ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        result = subprocess.run(["git", "check-ignore", "-q", "public/assets/action/wrestler/grip-success-gate/red.png"],
                                cwd=aw.REPO_ROOT)
        self.assertEqual(result.returncode, 1)


def ts_metadata() -> dict:
    text = TS_METADATA.read_text(encoding="utf-8")
    rows = re.findall(r"assetPath: 'assets/action/wrestler/grip-success-gate/(\w+)\.png',\s*width: (\d+),\s*"
                      r"height: (\d+),\s*pivot: \{ x: ([0-9.]+), y: ([0-9.]+) \}", text)
    core = float(re.search(r"GRIP_SUCCESS_GATE_BODY_CORE_DIAMETER_PX = ([0-9.]+)", text).group(1))
    return {f"{color}.png": {"size": [int(w), int(h)], "pivot": [float(x), float(y)], "body_core_px": core}
            for color, w, h, x, y in rows}


REAL_INPUT = (aw.DEFAULT_INPUT_DIR / RECIPE["master"]["file"]).is_file()


@unittest.skipUnless(REAL_INPUT, "candidate_red_grip_success.png is not present in input.local/")
class CommittedGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # only the red Grip success pose is visible to the exporter
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
                         {"red.png": ([160, 183], [83.0, 98.0]), "blue.png": ([160, 183], [83.0, 85.0])})

    def test_typescript_metadata_matches_the_export(self) -> None:
        ts = ts_metadata()
        self.assertEqual(sorted(ts), ["blue.png", "red.png"])
        for name, entry in self.report.items():
            self.assertEqual(ts[name]["size"], entry["size"], name)
            self.assertEqual(ts[name]["pivot"], entry["pivot"], name)
            self.assertAlmostEqual(ts[name]["body_core_px"], entry["body_core_px"], places=5)

    def _normalized_red(self):
        spec = RECIPE["master"]
        return et.normalize(spec, self.input_dir / spec["file"], "red", RECIPE["alpha_threshold"]).image

    def test_idle_reference_identity(self) -> None:
        # T2: the tone reference is the accepted idle red runtime (export_runtime_wrestlers.py --check owns it)
        tone = RECIPE["skin_tone_match"]
        self.assertEqual(tone["reference_pixel_sha256"], ACCEPTED_RED_PIXELS)
        with Image.open(aw.REPO_ROOT / tone["reference"]) as image:
            self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), ACCEPTED_RED_PIXELS)

    def test_real_skin_mask_excludes_mawashi_hair_and_outline(self) -> None:
        # T3-T6
        image = self._normalized_red()
        mask = eg.skin_mask(image, RECIPE)
        self.assertEqual(mask, eg.skin_mask(image, RECIPE))
        self.assertEqual(len(mask), RECIPE["skin_tone_match"]["measurement_evidence"]["uncorrected_skin_px"])
        self.assertGreater(len(mask), 5000)
        self.assertFalse(mask & im.mawashi_mask(image, RECIPE["recolor"]))
        px = image.load()
        for p in mask:
            r, g, b, a = px[p]
            self.assertGreaterEqual(max(r, g, b), 0.35 * 255 - 1)  # no hair / outline (dark)
            self.assertGreaterEqual(a, 250)

    def test_real_tone_match_improves_the_idle_match_without_clipping(self) -> None:
        # T7-T9 / T11 / T12 on the real pose, and the recorded evidence reproduces
        tone = RECIPE["skin_tone_match"]
        evidence = tone["measurement_evidence"]
        image = self._normalized_red()
        mask = eg.skin_mask(image, RECIPE)
        with Image.open(aw.REPO_ROOT / tone["reference"]) as idle_file:
            idle = idle_file.convert("RGBA")
        idle_mask = eg.skin_mask(idle, RECIPE)
        self.assertEqual(len(idle_mask), evidence["idle_skin_px"])
        idle_q = eg.skin_quantiles(idle, idle_mask)
        before = eg.skin_quantiles(image, mask)
        for fresh, recorded in ((idle_q, evidence["idle_quantiles"]), (before, evidence["uncorrected_quantiles"])):
            for f, r in zip(fresh, recorded):
                self.assertAlmostEqual(f, r, places=6)
        self.assertEqual([p[0] for p in tone["curve_points"][1:-1]], evidence["uncorrected_quantiles"])
        self.assertEqual([p[1] for p in tone["curve_points"][1:-1]], evidence["idle_quantiles"])
        out, clipped = eg.tone_match(image, mask, tone["curve_points"])
        self.assertEqual(clipped, 0)
        after = eg.skin_quantiles(out, mask)
        err = lambda q: max(abs(a - b) for a, b in zip(q, idle_q))  # noqa: E731
        self.assertLess(err(after), 0.005)
        self.assertLess(err(after), err(before) / 10)
        self.assertEqual(out.getchannel("A").tobytes(), image.getchannel("A").tobytes())
        a, b = image.load(), out.load()
        changed = 0
        for y in range(image.height):
            for x in range(image.width):
                if (x, y) not in mask:
                    self.assertEqual(a[x, y], b[x, y])
                elif a[x, y] != b[x, y]:
                    changed += 1
        self.assertGreater(changed, len(mask) // 2)
        saturated = sum(1 for p in mask if max(b[p][:3]) == 255 or min(b[p][:3]) == 0)
        self.assertEqual(saturated, 0)

    def test_real_mask_covers_the_mawashi(self) -> None:
        spec = RECIPE["master"]
        red = et.normalize(spec, self.input_dir / spec["file"], "red", RECIPE["alpha_threshold"])
        source = aw.mirror_part(red)
        rule = RECIPE["recolor"]
        self.assertEqual(et.mask_report(source.image, im.mawashi_mask(source.image, rule), rule),
                         {"mask_px": 2394, "missed_band_px": 17, "fringe_px": 47})

    def test_accepted_idle_tsuppari_counter_and_grip_attempt_textures_unchanged(self) -> None:
        for key, expected in (("red", ACCEPTED_RED_PIXELS), ("blue", ACCEPTED_BLUE_PIXELS)):
            with Image.open(ex.DEFAULT_RUNTIME_DIR / f"{key}.png") as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)
        for name, expected in ACCEPTED_SEPARATE_PIXELS.items():
            with Image.open(et.DEFAULT_TSUPPARI_DIR / name) as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)
        for name, expected in ACCEPTED_COUNTER_PIXELS.items():
            with Image.open(ec.DEFAULT_COUNTER_DIR / name) as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)
        for name, expected in ATTEMPT_GATE_PIXELS.items():
            with Image.open(ea.DEFAULT_GATE_DIR / name) as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)

    def test_recorded_measurement_is_reproducible(self) -> None:
        runtime = ex.load_recipe(ex.DEFAULT_RECIPE)
        idle_spec, rule = runtime["master"], runtime["derived"]["recolor"]
        idle_source, _ = aw.load_source(aw.DEFAULT_INPUT_DIR / idle_spec["file"], idle_spec, "idle red")
        idle_marks = mt.measure_landmarks(idle_source, rule)
        spec = RECIPE["master"]
        source, _ = aw.load_source(self.input_dir / spec["file"], spec, "grip success red")
        marks = mt.measure_landmarks(source, rule)
        norm = mt.normalization(idle_marks, marks, idle_spec)
        self.assertEqual(mt._rounded_marks(idle_marks), RECIPE["measurement"]["idle_reference"])
        evidence = spec["measurement_evidence"]
        self.assertEqual(mt._rounded_marks(marks), {k: evidence[k] for k in ("hair_centroid", "mawashi_centroid",
                                                                             "hair_px", "mawashi_px")})
        self.assertEqual(round(norm["rotation_delta_deg"], 3), evidence["rotation_delta_deg"])
        self.assertEqual(round(norm["scale"], 4), evidence["scale"])
        # recorded values are the measurement rounded to 0.1 deg / 1 px (the Tsuppari recipe tolerance)
        self.assertLessEqual(abs(spec["source_front_deg"] - norm["source_front_deg"]), 0.1)
        measured = [norm["root_source_px"], *norm["body_core_source_px"]]
        recorded = [spec["root_source_px"], *spec["body_core_source_px"]]
        for m, r in zip(measured, recorded):
            self.assertLessEqual(max(abs(m[i] - r[i]) for i in (0, 1)), 1.0, (m, r))


if __name__ == "__main__":
    unittest.main()
