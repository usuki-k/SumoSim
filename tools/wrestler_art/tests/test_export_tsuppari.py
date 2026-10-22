"""Focused tests for export_tsuppari.py / measure_tsuppari_pose.py / preview_tsuppari.py (ACTION-07D Product Tsuppari).

Synthetic one-handed poses (never Product art) check the hand / reflection mapping, recolor, determinism and
fail-closed behaviour. The last classes check the committed Product textures (against the accepted ACTION-07C2
SEPARATE pixels), the TypeScript metadata, the measurement reproducibility and the offline previews against the
real local sources (skipped when they are not present).
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
import export_runtime_wrestlers as ex  # noqa: E402
import export_tsuppari as et  # noqa: E402
import measure_tsuppari_pose as mt  # noqa: E402
import preview_idle_mirror_workflow as im  # noqa: E402
from test_export_runtime_wrestlers import ACCEPTED_BLUE_PIXELS, ACCEPTED_RED_PIXELS  # noqa: E402
from test_preview_dual_rigid_wrestlers import front_point, sprite_recipe  # noqa: E402

TS_METADATA = aw.REPO_ROOT / "src" / "game" / "presentation" / "productTsuppariArt.ts"
RECIPE = et.load_recipe(et.DEFAULT_RECIPE)
HAND_MARK = (0, 255, 0, 255)  # synthetic striking hand (outside every recolor band)
FRONT_DEG = 165.0
ACCEPTED_SOURCE_PIXELS = {
    "red_left": "219d66dcf13585e7149382f01c964fdd9074bf61e615b5d3f9bbb15b38cb84b3",
    "red_right": "d7d5632f8357bd1e4427d2bcdcee5a6e74307fcd9d0caca2d86d102ec8719011",
}
# The User-accepted ACTION-07C2 SEPARATE gate textures (decoded RGBA pixels): the Product four must equal them.
ACCEPTED_SEPARATE_PIXELS = {
    "red_left.png": "ab5043bf8aa8fe20a0b12c45095bba62214a73d4816762966a7e2730b7773f2f",
    "red_right.png": "0859a8c4d3c629f5ea00fc27a9ba97b5e0af8848daba5de77eb846d56aee0de8",
    "blue_left.png": "bed6fa024e51d9ca17a75fd243554b4fa7f052f204e4fa679ea00a34dd68bb53",
    "blue_right.png": "c9369b4b1b5edcdd46008735032fe8e95e0894797993ec2089d66b8a924bb1ef",
}


def make_pose(hand: str) -> Image.Image:
    """Synthetic red wrestler striking with one hand: body, red belt behind, one long arm to the front.
    In the source the wrestler's left is at screen angle front - 90 (local -Y after normalization)."""
    sprite = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(sprite)
    d.ellipse((90, 90, 210, 210), fill=(240, 190, 150, 255))
    kx, ky = front_point(FRONT_DEG + 180, 50)
    d.rectangle((kx - 22, ky - 30, kx + 22, ky + 30), fill=(210, 40, 40, 255))
    side = -30 if hand == "left" else 30
    hx, hy = front_point(FRONT_DEG + side, 100)
    d.ellipse((hx - 12, hy - 12, hx + 12, hy + 12), fill=HAND_MARK)
    return sprite


def load_raw_recipe() -> dict:
    """The real recipe as JSON, with an absolute runtime_recipe so a copy can live in a temp dir."""
    recipe = json.loads(et.DEFAULT_RECIPE.read_text(encoding="utf-8"))
    recipe["runtime_recipe"] = str(ex.DEFAULT_RECIPE)
    return recipe


class Fixture:
    """Temp input dir with the two synthetic red poses only, and a recipe for them."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.input_dir = root / "input.local"
        self.input_dir.mkdir()
        self.out_dir = root / "tsuppari"
        recipe = load_raw_recipe()
        for hand in et.HANDS:
            key = f"red_{hand}"
            image = make_pose(hand)
            spec = sprite_recipe(key, image, FRONT_DEG)
            spec["file"] = f"synthetic_{key}.png"
            image.save(self.input_dir / spec["file"])
            recipe["masters"][key] = {"hand": hand, **spec}
        for hand in et.HANDS:  # references are never read by the export
            recipe["references"][f"blue_{hand}"] = {"hand": hand, **sprite_recipe("absent", make_pose(hand), FRONT_DEG)}
        recipe["mask_limits"] = {"min_mask_px": 500, "max_missed_px": 60, "max_fringe_px": 200}
        self.recipe_path = root / "tsuppari_recipe.json"
        self.recipe_path.write_text(json.dumps(recipe), encoding="utf-8")
        self.recipe = et.load_recipe(self.recipe_path)

    def cleanup(self) -> None:
        self._tmp.cleanup()


def hand_side(part: aw.Part) -> float:
    """Local y (from the pivot) of the striking-hand mark: < 0 = wrestler's LEFT, > 0 = RIGHT."""
    px = part.image.load()
    ys = [y for y in range(part.image.height) for x in range(part.image.width) if px[x, y][:3] == HAND_MARK[:3]]
    return sum(ys) / len(ys) + 0.5 - part.pivot[1]


class RecipeTests(unittest.TestCase):
    def test_fixed_separate_mapping_preserves_semantic_hand(self) -> None:
        self.assertEqual(et.OUTPUTS, {"red_left": ("red_left", False), "red_right": ("red_right", False),
                                      "blue_left": ("red_right", True), "blue_right": ("red_left", True)})
        for variant, (master, reflect) in et.OUTPUTS.items():
            self.assertEqual(et.expected_hand(RECIPE, master, reflect), variant.split("_")[1])
        self.assertEqual(et.OUTPUT_FILES, ["red_left.png", "red_right.png", "blue_left.png", "blue_right.png"])

    def test_accepted_red_source_identities(self) -> None:
        self.assertEqual({k: s["pixel_sha256"] for k, s in RECIPE["masters"].items()}, ACCEPTED_SOURCE_PIXELS)
        self.assertNotIn("modes", RECIPE)

    def test_recolor_rule_is_owned_by_the_idle_runtime_recipe(self) -> None:
        self.assertEqual(RECIPE["recolor"], ex.load_recipe(ex.DEFAULT_RECIPE)["derived"]["recolor"])
        self.assertNotIn("recolor", json.loads(et.DEFAULT_RECIPE.read_text(encoding="utf-8")))

    def test_measurement_prose_names_the_implemented_method(self) -> None:
        method = RECIPE["measurement"]["method"]
        for phrase in ("measure_tsuppari_pose.py", "1/2 scale (BOX)", "max(R, G, B) < 80", "alpha > 200",
                       "7 px opening"):
            self.assertIn(phrase, method)
        self.assertEqual(RECIPE["measurement"]["tolerance"], {"front_deg": 0.1, "point_px": 1.0})

    def test_invalid_recipes_fail(self) -> None:
        cases = [
            (lambda r: r["masters"]["red_left"].update(hand="right"), "does not match its key"),
            (lambda r: r["masters"].pop("red_right"), "masters must be exactly"),
            (lambda r: r["references"].pop("blue_left"), "references must be exactly"),
            (lambda r: r["masters"]["red_right"].update(source_front_deg=100.0), "off perpendicular"),
            (lambda r: r["mask_limits"].pop("max_fringe_px"), "mask_limits.max_fringe_px"),
        ]
        for mutate, pattern in cases:
            recipe = load_raw_recipe()
            mutate(recipe)
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "recipe.json"
                path.write_text(json.dumps(recipe), encoding="utf-8")
                with self.assertRaisesRegex(aw.AssemblyError, pattern):
                    et.load_recipe(path)


class ExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = Fixture()

    def tearDown(self) -> None:
        self.fx.cleanup()

    def run_cli(self, *extra: str) -> int:
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            return et.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--out-dir", str(self.fx.out_dir), *extra])

    def test_four_files_from_the_two_red_poses_only(self) -> None:
        self.assertEqual(self.run_cli(), 0)
        self.assertEqual(sorted(p.name for p in self.fx.out_dir.iterdir()), sorted(et.OUTPUT_FILES))
        self.assertEqual(len(et.OUTPUT_FILES), 4)

    def test_every_texture_shows_its_semantic_hand(self) -> None:
        for t in et.build_textures(self.fx.recipe, self.fx.input_dir):
            side = hand_side(t.part)
            self.assertLess(side, 0) if t.variant.endswith("_left") else self.assertGreater(side, 0)

    def test_geometry_and_recolor_per_variant(self) -> None:
        masters = et.build_masters(self.fx.recipe, self.fx.input_dir)
        rule = self.fx.recipe["recolor"]
        for t in et.build_textures(self.fx.recipe, self.fx.input_dir):
            self.assertEqual((t.master, t.reflect), et.OUTPUTS[t.variant])
            source = aw.mirror_part(masters[t.master]) if t.reflect else masters[t.master]
            self.assertEqual(t.part.image.size, source.image.size)
            self.assertEqual(t.part.pivot, source.pivot)
            self.assertAlmostEqual(im.body_core_length(im.Sprite(t.part, "t")), 2 * aw.R_RUNTIME, places=5)
            self.assertEqual(t.part.image.getchannel("A").tobytes(), source.image.getchannel("A").tobytes())
            if t.variant.startswith("red_"):
                self.assertEqual(t.part.image.tobytes(), source.image.tobytes())
                continue
            self.assertEqual(t.mask, im.mawashi_mask(source.image, rule))
            self.assertGreater(len(t.mask), 500)
            tp, sp = t.part.image.load(), source.image.load()
            for y in range(source.image.height):
                for x in range(source.image.width):
                    if (x, y) not in t.mask:
                        self.assertEqual(tp[x, y], sp[x, y], (t.file, x, y))

    def test_only_local_y_reflection(self) -> None:
        original = Image.Image.transpose
        calls = []

        def spy(image, method):
            calls.append(method)
            return original(image, method)

        with mock.patch.object(Image.Image, "transpose", spy), mock.patch.object(ImageOps, "mirror", None):
            textures = et.build_textures(self.fx.recipe, self.fx.input_dir)
        self.assertEqual(set(calls), {Image.FLIP_TOP_BOTTOM})
        self.assertEqual(len(calls), sum(t.reflect for t in textures))

    def test_deterministic_export(self) -> None:
        first = et.export(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        data = {name: (self.fx.out_dir / name).read_bytes() for name in et.OUTPUT_FILES}
        again = self.fx.out_dir.parent / "again"
        self.assertEqual(et.export(self.fx.recipe, self.fx.input_dir, again), first)
        for name, blob in data.items():
            self.assertEqual((again / name).read_bytes(), blob)

    def test_check_writes_nothing_and_detects_changes(self) -> None:
        et.export(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        before = {p.name: p.read_bytes() for p in self.fx.out_dir.iterdir()}
        self.assertEqual(self.run_cli("--check"), 0)
        self.assertEqual({p.name: p.read_bytes() for p in self.fx.out_dir.iterdir()}, before)
        path = self.fx.out_dir / "blue_left.png"
        image = Image.open(path).convert("RGBA")
        image.putpixel((0, 0), (255, 0, 0, 255))
        image.save(path)
        with self.assertRaisesRegex(aw.AssemblyError, "committed pixels differ"):
            et.check(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        self.assertEqual(self.run_cli("--check"), 2)
        path.write_bytes(before[path.name])
        (self.fx.out_dir / "extra.png").write_bytes(b"")
        with self.assertRaisesRegex(aw.AssemblyError, "files"):
            et.check(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)

    def test_missing_or_changed_source_fails_closed(self) -> None:
        (self.fx.input_dir / "synthetic_red_right.png").unlink()
        self.assertEqual(self.run_cli(), 2)
        self.assertFalse(self.fx.out_dir.exists())
        make_pose("left").save(self.fx.input_dir / "synthetic_red_right.png")
        with self.assertRaisesRegex(aw.AssemblyError, "red_right: decoded RGBA pixel SHA-256"):
            et.build_textures(self.fx.recipe, self.fx.input_dir)

    def test_mask_limits_fail_closed(self) -> None:
        for field, value, pattern in (("min_mask_px", 10 ** 6, "has only"), ("max_missed_px", -1, "misses"),
                                      ("max_fringe_px", -1, "fringe")):
            recipe = json.loads(json.dumps(self.fx.recipe))
            recipe["mask_limits"][field] = value
            with self.assertRaisesRegex(aw.AssemblyError, pattern):
                et.build_textures(recipe, self.fx.input_dir)


def landmark_image(offset=(0, 0), hair=40, belt=(60, 30)) -> Image.Image:
    """Synthetic source: skin disc, black hair blob (with a thin dark outline elsewhere) and a red belt."""
    ox, oy = offset
    image = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.ellipse((100 + ox, 100 + oy, 300 + ox, 300 + oy), fill=(240, 190, 150, 255), outline=(0, 0, 0, 255), width=3)
    d.ellipse((120 + ox, 180 + oy, 120 + hair + ox, 180 + hair + oy), fill=(10, 10, 10, 255))
    d.rectangle((230 + ox, 200 - belt[0] // 2 + oy, 230 + belt[1] + ox, 200 + belt[0] // 2 + oy), fill=(210, 30, 40, 255))
    return image


class MeasurementTests(unittest.TestCase):
    RULE = ex.load_recipe(ex.DEFAULT_RECIPE)["derived"]["recolor"]
    IDLE = {"source_front_deg": 160.7, "root_source_px": [200, 200], "body_core_source_px": [[200, 100], [200, 300]]}

    def test_landmarks_are_deterministic_and_drop_the_outline(self) -> None:
        a = mt.measure_landmarks(landmark_image(), self.RULE)
        self.assertEqual(a, mt.measure_landmarks(landmark_image(), self.RULE))
        # the 7 px opening keeps the hair blob, not the 3 px body outline
        self.assertAlmostEqual(a["hair_centroid"][0], 140, delta=1.0)
        self.assertAlmostEqual(a["hair_centroid"][1], 200, delta=1.0)
        self.assertGreater(a["mawashi_px"], 0)

    def test_translation_carries_the_idle_points_rigidly(self) -> None:
        idle = mt.measure_landmarks(landmark_image(), self.RULE)
        pose = mt.measure_landmarks(landmark_image((20, -10)), self.RULE)
        norm = mt.normalization(idle, pose, self.IDLE)
        self.assertAlmostEqual(norm["rotation_delta_deg"], 0.0, places=6)
        self.assertAlmostEqual(norm["scale"], 1.0, places=6)
        self.assertAlmostEqual(norm["source_front_deg"], 160.7, places=6)
        self.assertAlmostEqual(norm["root_source_px"][0], 220.0, places=6)
        self.assertAlmostEqual(norm["root_source_px"][1], 190.0, places=6)

    def test_compare_flags_values_outside_the_tolerance(self) -> None:
        recipe = json.loads(json.dumps(RECIPE))
        report = {"idle_reference": dict(recipe["measurement"]["idle_reference"])}
        for key, spec in recipe["masters"].items():
            report[key] = {**spec["measurement_evidence"], "source_front_deg": spec["source_front_deg"],
                           "root_source_px": list(spec["root_source_px"]),
                           "body_core_source_px": [list(p) for p in spec["body_core_source_px"]]}
        self.assertEqual(mt.compare(recipe, report), [])
        report["red_left"]["root_source_px"][0] += 0.99
        self.assertEqual(mt.compare(recipe, report), [])
        report["red_left"]["root_source_px"][0] += 0.02
        report["red_right"]["source_front_deg"] += 0.11
        self.assertEqual(len(mt.compare(recipe, report)), 2)


class RepositoryTests(unittest.TestCase):
    def test_local_inputs_and_previews_are_git_ignored(self) -> None:
        paths = ["tools/wrestler_art/input.local/candidate_red_tsuppari_left.png",
                 "tools/wrestler_art/output-tsuppari.local/product_tsuppari.png"]
        result = subprocess.run(["git", "check-ignore", *paths], cwd=aw.REPO_ROOT, capture_output=True, text=True)
        self.assertEqual(result.stdout.split(), paths)

    def test_product_textures_are_not_ignored_and_the_gate_is_gone(self) -> None:
        result = subprocess.run(["git", "check-ignore", "-q", "public/assets/action/wrestler/tsuppari/red_left.png"],
                                cwd=aw.REPO_ROOT)
        self.assertEqual(result.returncode, 1)
        self.assertFalse((ex.DEFAULT_RUNTIME_DIR / "tsuppari-gate").exists())


def ts_metadata() -> dict:
    text = TS_METADATA.read_text(encoding="utf-8")
    rows = re.findall(r"tsuppariArt\('(\w+)', '(\w+)', (\d+), (\d+), \{ x: ([0-9.]+), y: ([0-9.]+) \}\)", text)
    core = float(re.search(r"PRODUCT_TSUPPARI_BODY_CORE_DIAMETER_PX = ([0-9.]+)", text).group(1))
    return {f"{color}_{hand}.png": {"size": [int(w), int(h)], "pivot": [float(x), float(y)], "body_core_px": core}
            for color, hand, w, h, x, y in rows}


REAL_INPUTS = all((aw.DEFAULT_INPUT_DIR / spec["file"]).is_file() for spec in RECIPE["masters"].values())


@unittest.skipUnless(REAL_INPUTS, "red Tsuppari poses are not present in input.local/")
class CommittedProductTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # only the two red poses are visible to the exporter (no authored blue, no idle source)
        cls._tmp = tempfile.TemporaryDirectory()
        cls.input_dir = Path(cls._tmp.name)
        for spec in RECIPE["masters"].values():
            shutil.copyfile(aw.DEFAULT_INPUT_DIR / spec["file"], cls.input_dir / spec["file"])
        cls.report = {e["file"]: e for e in et.check(RECIPE, cls.input_dir, et.DEFAULT_TSUPPARI_DIR)}

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def test_committed_textures_match_a_red_only_fresh_export(self) -> None:
        self.assertEqual(sorted(self.report), sorted(et.OUTPUT_FILES))

    def test_product_pixels_equal_the_accepted_separate_gate(self) -> None:
        self.assertEqual({name: e["pixel_sha256"] for name, e in self.report.items()}, ACCEPTED_SEPARATE_PIXELS)
        for name, entry in self.report.items():
            self.assertAlmostEqual(entry["body_core_px"], 123.076923, places=5)

    def test_typescript_metadata_matches_the_export(self) -> None:
        ts = ts_metadata()
        self.assertEqual(sorted(ts), sorted(et.OUTPUT_FILES))
        for name, entry in self.report.items():
            self.assertEqual(ts[name]["size"], entry["size"], name)
            self.assertEqual(ts[name]["pivot"], entry["pivot"], name)
            self.assertAlmostEqual(ts[name]["body_core_px"], entry["body_core_px"], places=5)

    def test_real_masks_cover_the_mawashi(self) -> None:
        masters = et.build_masters(RECIPE, self.input_dir)
        rule = RECIPE["recolor"]
        for key, part in masters.items():
            for source in (part, aw.mirror_part(part)):
                report = et.mask_report(source.image, im.mawashi_mask(source.image, rule), rule)
                self.assertEqual(report, {"red_left": {"mask_px": 2239, "missed_band_px": 17, "fringe_px": 48},
                                          "red_right": {"mask_px": 2264, "missed_band_px": 20, "fringe_px": 83}}[key])

    def test_accepted_idle_sprites_unchanged(self) -> None:
        for key, expected in (("red", ACCEPTED_RED_PIXELS), ("blue", ACCEPTED_BLUE_PIXELS)):
            with Image.open(ex.DEFAULT_RUNTIME_DIR / f"{key}.png") as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)


REAL_IDLE = REAL_INPUTS and (aw.DEFAULT_INPUT_DIR / "wrestler_red.png").is_file()


@unittest.skipUnless(REAL_IDLE, "red Tsuppari poses / idle red are not present in input.local/")
class RealMeasurementTests(unittest.TestCase):
    def test_recipe_measurements_are_reproducible(self) -> None:
        report = mt.measure(RECIPE, aw.DEFAULT_INPUT_DIR)
        self.assertEqual(mt.compare(RECIPE, report), [])
        # recorded values = what the exporter uses; the fresh measurement agrees within the tolerance
        self.assertEqual(round(report["red_left"]["source_front_deg"], 1), RECIPE["masters"]["red_left"]["source_front_deg"])
        self.assertEqual(round(report["red_right"]["source_front_deg"], 1), RECIPE["masters"]["red_right"]["source_front_deg"])
        self.assertEqual(report, mt.measure(RECIPE, aw.DEFAULT_INPUT_DIR))

    def test_check_cli(self) -> None:
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            self.assertEqual(mt.main(["--check"]), 0)


REAL_PREVIEW = REAL_IDLE and all((aw.DEFAULT_INPUT_DIR / spec["file"]).is_file()
                                 for spec in RECIPE["references"].values())


@unittest.skipUnless(REAL_PREVIEW, "Tsuppari poses / references / idle red are not present in input.local/")
class PreviewTests(unittest.TestCase):
    def test_preview_outputs_and_determinism(self) -> None:
        import preview_tsuppari as pt

        first = pt.build(RECIPE, aw.DEFAULT_INPUT_DIR, aw.DEFAULT_ARENA_DIR)
        expected = (set(pt.OUTPUT_GUIDES.values())
                    | {pt.OUTPUT_SHEET, pt.OUTPUT_ROTATIONS, pt.OUTPUT_FACEOFF, pt.OUTPUT_ALIGNMENT, pt.OUTPUT_MASKS,
                       pt.OUTPUT_BLUE_REFERENCE})
        self.assertEqual(set(first.images), expected)
        self.assertEqual([t["file"] for t in first.info["textures"]], et.OUTPUT_FILES)
        second = pt.build(RECIPE, aw.DEFAULT_INPUT_DIR, aw.DEFAULT_ARENA_DIR)
        self.assertEqual(aw.json_text(first.manifest), aw.json_text(second.manifest))
        with tempfile.TemporaryDirectory() as tmp:
            written = pt.write_outputs(first, Path(tmp))
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), sorted(p.name for p in written))


if __name__ == "__main__":
    unittest.main()
