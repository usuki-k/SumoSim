"""Focused tests for export_tsuppari_gate.py / preview_tsuppari_gate.py (ACTION-07C Tsuppari Visual Gate).

Synthetic one-handed poses (never Product art) check the hand / reflection mapping, recolor, determinism and
fail-closed behaviour. The last classes check the committed Visual-Gate textures, the TypeScript metadata and
the offline previews against the real local candidates (skipped when they are not present).
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
import export_tsuppari_gate as eg  # noqa: E402
import preview_idle_mirror_workflow as im  # noqa: E402
from test_export_runtime_wrestlers import ACCEPTED_BLUE_PIXELS, ACCEPTED_RED_PIXELS  # noqa: E402
from test_preview_dual_rigid_wrestlers import front_point, sprite_recipe  # noqa: E402

TS_METADATA = aw.REPO_ROOT / "src" / "game" / "presentation" / "tsuppariGateArt.ts"
RECIPE = eg.load_recipe(eg.DEFAULT_RECIPE)
HAND_MARK = (0, 255, 0, 255)  # synthetic striking hand (outside every recolor band)
FRONT_DEG = 165.0


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
    recipe = json.loads(eg.DEFAULT_RECIPE.read_text(encoding="utf-8"))
    recipe["runtime_recipe"] = str(ex.DEFAULT_RECIPE)
    return recipe


class Fixture:
    """Temp input dir with the two synthetic red poses only, and a recipe for them."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.input_dir = root / "input.local"
        self.input_dir.mkdir()
        self.gate_dir = root / "gate"
        recipe = load_raw_recipe()
        for hand in eg.HANDS:
            key = f"red_{hand}"
            image = make_pose(hand)
            spec = sprite_recipe(key, image, FRONT_DEG)
            spec["file"] = f"synthetic_{key}.png"
            image.save(self.input_dir / spec["file"])
            recipe["masters"][key] = {"hand": hand, **spec}
        for hand in eg.HANDS:  # references are never read by the export
            recipe["references"][f"blue_{hand}"] = {"hand": hand, **sprite_recipe("absent", make_pose(hand), FRONT_DEG)}
        recipe["mask_limits"] = {"min_mask_px": 500, "max_missed_px": 60, "max_fringe_px": 200}
        self.recipe_path = root / "tsuppari_gate_recipe.json"
        self.recipe_path.write_text(json.dumps(recipe), encoding="utf-8")
        self.recipe = eg.load_recipe(self.recipe_path)

    def cleanup(self) -> None:
        self._tmp.cleanup()


def hand_side(part: aw.Part) -> float:
    """Local y (from the pivot) of the striking-hand mark: < 0 = wrestler's LEFT, > 0 = RIGHT."""
    px = part.image.load()
    ys = [y for y in range(part.image.height) for x in range(part.image.width) if px[x, y][:3] == HAND_MARK[:3]]
    return sum(ys) / len(ys) + 0.5 - part.pivot[1]


class RecipeTests(unittest.TestCase):
    def test_real_recipe_mapping_preserves_semantic_hand(self) -> None:
        for mode in eg.MODES:
            for variant, entry in RECIPE["modes"][mode].items():
                self.assertEqual(eg.expected_hand(RECIPE, entry), variant.split("_")[1], (mode, variant))
        self.assertEqual(RECIPE["modes"]["separate"]["blue_left"], {"master": "red_right", "reflect": True})
        self.assertEqual(RECIPE["modes"]["separate"]["blue_right"], {"master": "red_left", "reflect": True})
        self.assertEqual({e["master"] for e in RECIPE["modes"]["mirror_l"].values()}, {"red_left"})
        self.assertEqual({e["master"] for e in RECIPE["modes"]["mirror_r"].values()}, {"red_right"})

    def test_recolor_rule_is_owned_by_the_idle_runtime_recipe(self) -> None:
        self.assertEqual(RECIPE["recolor"], ex.load_recipe(ex.DEFAULT_RECIPE)["derived"]["recolor"])
        self.assertNotIn("recolor", json.loads(eg.DEFAULT_RECIPE.read_text(encoding="utf-8")))

    def test_invalid_recipes_fail(self) -> None:
        cases = [
            (lambda r: r["modes"]["separate"]["blue_left"].update(reflect=False), "gives the right hand"),
            (lambda r: r["modes"]["mirror_l"]["red_right"].update(master="blue_left"), "needs a red master"),
            (lambda r: r["masters"]["red_left"].update(hand="right"), "does not match its key"),
            (lambda r: r["references"].pop("blue_left"), "references must be exactly"),
            (lambda r: r["modes"].pop("mirror_r"), "modes must be exactly"),
            (lambda r: r["masters"]["red_right"].update(source_front_deg=100.0), "off perpendicular"),
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
                            "--gate-dir", str(self.fx.gate_dir), *extra])

    def test_twelve_files_from_the_two_red_poses_only(self) -> None:
        self.assertEqual(self.run_cli(), 0)
        self.assertEqual(sorted(p.name for p in self.fx.gate_dir.iterdir()), sorted(eg.GATE_FILES))
        self.assertEqual(len(eg.GATE_FILES), 12)

    def test_every_texture_shows_its_semantic_hand(self) -> None:
        for t in eg.build_textures(self.fx.recipe, self.fx.input_dir):
            side = hand_side(t.part)
            self.assertLess(side, 0) if t.variant.endswith("_left") else self.assertGreater(side, 0)

    def test_geometry_and_recolor_per_variant(self) -> None:
        masters = eg.build_masters(self.fx.recipe, self.fx.input_dir)
        rule = self.fx.recipe["recolor"]
        for t in eg.build_textures(self.fx.recipe, self.fx.input_dir):
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
            textures = eg.build_textures(self.fx.recipe, self.fx.input_dir)
        self.assertEqual(set(calls), {Image.FLIP_TOP_BOTTOM})
        self.assertEqual(len(calls), sum(t.reflect for t in textures))

    def test_deterministic_export(self) -> None:
        first = eg.export(self.fx.recipe, self.fx.input_dir, self.fx.gate_dir)
        data = {name: (self.fx.gate_dir / name).read_bytes() for name in eg.GATE_FILES}
        again = self.fx.gate_dir.parent / "again"
        self.assertEqual(eg.export(self.fx.recipe, self.fx.input_dir, again), first)
        for name, blob in data.items():
            self.assertEqual((again / name).read_bytes(), blob)

    def test_check_writes_nothing_and_detects_changes(self) -> None:
        eg.export(self.fx.recipe, self.fx.input_dir, self.fx.gate_dir)
        before = {p.name: p.read_bytes() for p in self.fx.gate_dir.iterdir()}
        self.assertEqual(self.run_cli("--check"), 0)
        self.assertEqual({p.name: p.read_bytes() for p in self.fx.gate_dir.iterdir()}, before)
        path = self.fx.gate_dir / "mirror_r_blue_left.png"
        image = Image.open(path).convert("RGBA")
        image.putpixel((0, 0), (255, 0, 0, 255))
        image.save(path)
        with self.assertRaisesRegex(aw.AssemblyError, "committed pixels differ"):
            eg.check(self.fx.recipe, self.fx.input_dir, self.fx.gate_dir)
        path.write_bytes(before[path.name])
        (self.fx.gate_dir / "extra.png").write_bytes(b"")
        with self.assertRaisesRegex(aw.AssemblyError, "files"):
            eg.check(self.fx.recipe, self.fx.input_dir, self.fx.gate_dir)

    def test_missing_or_changed_source_fails_closed(self) -> None:
        (self.fx.input_dir / "synthetic_red_right.png").unlink()
        self.assertEqual(self.run_cli(), 2)
        self.assertFalse(self.fx.gate_dir.exists())
        make_pose("left").save(self.fx.input_dir / "synthetic_red_right.png")
        with self.assertRaisesRegex(aw.AssemblyError, "red_right: decoded RGBA pixel SHA-256"):
            eg.build_textures(self.fx.recipe, self.fx.input_dir)

    def test_mask_limits_fail_closed(self) -> None:
        for field, value, pattern in (("min_mask_px", 10 ** 6, "has only"), ("max_missed_px", -1, "misses"),
                                      ("max_fringe_px", -1, "fringe")):
            recipe = json.loads(json.dumps(self.fx.recipe))
            recipe["mask_limits"][field] = value
            with self.assertRaisesRegex(aw.AssemblyError, pattern):
                eg.build_textures(recipe, self.fx.input_dir)


class RepositoryTests(unittest.TestCase):
    def test_local_inputs_and_previews_are_git_ignored(self) -> None:
        paths = ["tools/wrestler_art/input.local/candidate_red_tsuppari_left.png",
                 "tools/wrestler_art/output-tsuppari-gate.local/mode_separate.png"]
        result = subprocess.run(["git", "check-ignore", *paths], cwd=aw.REPO_ROOT, capture_output=True, text=True)
        self.assertEqual(result.stdout.split(), paths)

    def test_runtime_gate_textures_are_not_ignored(self) -> None:
        result = subprocess.run(["git", "check-ignore", "-q", "public/assets/action/wrestler/tsuppari-gate/separate_red_left.png"],
                                cwd=aw.REPO_ROOT)
        self.assertEqual(result.returncode, 1)


def ts_metadata() -> dict:
    text = TS_METADATA.read_text(encoding="utf-8")
    rows = re.findall(r"\n  (\w+): \{ width: (\d+), height: (\d+), pivot: \{ x: ([0-9.]+), y: ([0-9.]+) \} \},", text)
    core = float(re.search(r"TSUPPARI_GATE_BODY_CORE_DIAMETER_PX = ([0-9.]+)", text).group(1))
    return {f"{stem}.png": {"size": [int(w), int(h)], "pivot": [float(x), float(y)], "body_core_px": core}
            for stem, w, h, x, y in rows}


REAL_INPUTS = all((aw.DEFAULT_INPUT_DIR / spec["file"]).is_file() for spec in RECIPE["masters"].values())


@unittest.skipUnless(REAL_INPUTS, "Tsuppari candidates are not present in input.local/")
class CommittedGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # only the two red poses are visible to the exporter (no authored blue, no idle source)
        cls._tmp = tempfile.TemporaryDirectory()
        cls.input_dir = Path(cls._tmp.name)
        for spec in RECIPE["masters"].values():
            shutil.copyfile(aw.DEFAULT_INPUT_DIR / spec["file"], cls.input_dir / spec["file"])
        cls.report = {e["file"]: e for e in eg.check(RECIPE, cls.input_dir, eg.DEFAULT_GATE_DIR)}

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def test_committed_textures_match_a_red_only_fresh_export(self) -> None:
        self.assertEqual(sorted(self.report), sorted(eg.GATE_FILES))

    def test_typescript_metadata_matches_the_export(self) -> None:
        ts = ts_metadata()
        self.assertEqual(sorted(ts), sorted(eg.GATE_FILES))
        for name, entry in self.report.items():
            self.assertEqual(ts[name]["size"], entry["size"], name)
            self.assertEqual(ts[name]["pivot"], entry["pivot"], name)
            self.assertAlmostEqual(ts[name]["body_core_px"], entry["body_core_px"], places=5)

    def test_shared_derivations_are_identical_files(self) -> None:
        same = [("separate_red_left", "mirror_l_red_left"), ("separate_red_right", "mirror_r_red_right"),
                ("separate_blue_right", "mirror_l_blue_right"), ("separate_blue_left", "mirror_r_blue_left")]
        for a, b in same:
            self.assertEqual(self.report[f"{a}.png"]["pixel_sha256"], self.report[f"{b}.png"]["pixel_sha256"])

    def test_real_masks_cover_the_mawashi(self) -> None:
        masters = eg.build_masters(RECIPE, self.input_dir)
        rule = RECIPE["recolor"]
        for key, part in masters.items():
            for source in (part, aw.mirror_part(part)):
                report = eg.mask_report(source.image, im.mawashi_mask(source.image, rule), rule)
                self.assertEqual(report, {"red_left": {"mask_px": 2239, "missed_band_px": 17, "fringe_px": 48},
                                          "red_right": {"mask_px": 2265, "missed_band_px": 10, "fringe_px": 61}}[key])

    def test_accepted_idle_sprites_unchanged(self) -> None:
        for key, expected in (("red", ACCEPTED_RED_PIXELS), ("blue", ACCEPTED_BLUE_PIXELS)):
            with Image.open(ex.DEFAULT_RUNTIME_DIR / f"{key}.png") as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)


REAL_PREVIEW = REAL_INPUTS and all((aw.DEFAULT_INPUT_DIR / spec["file"]).is_file()
                                   for spec in RECIPE["references"].values()) \
    and (aw.DEFAULT_INPUT_DIR / "wrestler_red.png").is_file()


@unittest.skipUnless(REAL_PREVIEW, "Tsuppari candidates / idle red are not present in input.local/")
class PreviewTests(unittest.TestCase):
    def test_preview_outputs_and_determinism(self) -> None:
        import preview_tsuppari_gate as pg

        first = pg.build(RECIPE, aw.DEFAULT_INPUT_DIR, aw.DEFAULT_ARENA_DIR)
        expected = (set(pg.OUTPUT_GUIDES.values()) | set(pg.OUTPUT_MODE_SHEETS.values())
                    | set(pg.OUTPUT_ROTATIONS.values()) | set(pg.OUTPUT_FACEOFF.values())
                    | {pg.OUTPUT_ALIGNMENT, pg.OUTPUT_MASKS, pg.OUTPUT_BLUE_REFERENCE})
        self.assertEqual(set(first.images), expected)
        self.assertEqual([t["file"] for t in first.info["textures"]], eg.GATE_FILES)
        second = pg.build(RECIPE, aw.DEFAULT_INPUT_DIR, aw.DEFAULT_ARENA_DIR)
        self.assertEqual(aw.json_text(first.manifest), aw.json_text(second.manifest))
        with tempfile.TemporaryDirectory() as tmp:
            written = pg.write_outputs(first, Path(tmp))
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), sorted(p.name for p in written))


if __name__ == "__main__":
    unittest.main()
