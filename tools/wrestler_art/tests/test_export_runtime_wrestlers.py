"""Focused tests for export_runtime_wrestlers.py (ART-WRESTLER-04B: one red master, derived blue).

Synthetic fixtures (never Product art) check the export contract with only a red source present. The last
class checks the committed public/assets/action/wrestler/*.png against a fresh export of the real reviewed
red source (skipped when it is not present).
"""

from __future__ import annotations

import io
import json
import re
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

from PIL import Image, ImageOps

TOOL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOL_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import assemble_wrestler as aw  # noqa: E402
import export_runtime_wrestlers as ex  # noqa: E402
import preview_dual_rigid_wrestlers as pd  # noqa: E402
import preview_idle_mirror_workflow as im  # noqa: E402
from test_preview_dual_rigid_wrestlers import SOURCES, sprite_recipe  # noqa: E402

TS_METADATA = aw.REPO_ROOT / "src" / "game" / "presentation" / "productWrestlerArt.ts"
RUNTIME_RECIPE = ex.load_recipe(ex.DEFAULT_RECIPE)
# Accepted runtime pixels: red unchanged since ACTION-ART-03A; blue = the 04A red-master candidate.
ACCEPTED_RED_PIXELS = "d66895bf7301cd3dc9573cea07db7dceca07f2114ba85bcc0be763334313cdaa"
ACCEPTED_BLUE_PIXELS = "9d5feead362870543d2bc0d54517dc2b67318b817afd60ed9748c3d3b155a2a6"


class Fixture:
    """A temp input dir holding only a synthetic red source, plus a runtime recipe for it."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.input_dir = root / "input.local"
        self.input_dir.mkdir()
        self.runtime_dir = root / "runtime"
        image, front = SOURCES["red"]
        image.save(self.input_dir / "wrestler_red.png")
        self.recipe = {
            "recipe_schema": 1,
            "name": "synthetic-runtime",
            "alpha_threshold": 8,
            "master": {"key": "red", **sprite_recipe("red", image, front)},
            "derived": json.loads(json.dumps(RUNTIME_RECIPE["derived"])),
        }
        self.recipe_path = root / "runtime_recipe.json"
        self.recipe_path.write_text(json.dumps(self.recipe), encoding="utf-8")

    def cleanup(self) -> None:
        self._tmp.cleanup()


class ExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = Fixture()

    def tearDown(self) -> None:
        self.fx.cleanup()

    def run_cli(self, *extra: str) -> int:
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            return ex.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--runtime-dir", str(self.fx.runtime_dir), *extra])

    def test_red_is_the_single_source_and_no_blue_source_is_needed(self) -> None:
        self.assertEqual(sorted(p.name for p in self.fx.input_dir.iterdir()), ["wrestler_red.png"])
        self.assertEqual(RUNTIME_RECIPE["master"]["key"], "red")
        self.assertEqual(RUNTIME_RECIPE["master"]["file"], "wrestler_red.png")
        self.assertEqual(self.run_cli(), 0)
        self.assertEqual(sorted(p.name for p in self.fx.runtime_dir.iterdir()), ["blue.png", "red.png"])

    def test_missing_red_source_fails(self) -> None:
        (self.fx.input_dir / "wrestler_red.png").unlink()
        with self.assertRaisesRegex(aw.AssemblyError, "red: source missing"):
            ex.export(self.fx.recipe, self.fx.input_dir, self.fx.runtime_dir)
        self.assertEqual(self.run_cli(), 2)
        self.assertFalse(self.fx.runtime_dir.exists())

    def test_invalid_red_source_fails(self) -> None:
        image = SOURCES["red"][0].copy()
        image.putpixel((150, 150), (1, 2, 3, 255))
        image.save(self.fx.input_dir / "wrestler_red.png")
        with self.assertRaisesRegex(aw.AssemblyError, "red: decoded RGBA pixel SHA-256"):
            ex.export(self.fx.recipe, self.fx.input_dir, self.fx.runtime_dir)

    def test_recipe_must_use_red_master_and_local_y(self) -> None:
        for mutate, pattern in ((lambda r: r["master"].update(key="blue"), "red as master"),
                                (lambda r: r["derived"].update(reflection="screen_x"), "local-Y reflection")):
            recipe = json.loads(json.dumps(self.fx.recipe))
            mutate(recipe)
            self.fx.recipe_path.write_text(json.dumps(recipe), encoding="utf-8")
            with self.assertRaisesRegex(aw.AssemblyError, pattern):
                ex.load_recipe(self.fx.recipe_path)

    def test_deterministic_export(self) -> None:
        first = ex.export(self.fx.recipe, self.fx.input_dir, self.fx.runtime_dir)
        data = {name: (self.fx.runtime_dir / name).read_bytes() for name in ex.RUNTIME_FILES.values()}
        again_dir = self.fx.runtime_dir.parent / "again"
        self.assertEqual(ex.export(self.fx.recipe, self.fx.input_dir, again_dir), first)
        for name, blob in data.items():
            self.assertEqual((again_dir / name).read_bytes(), blob)

    def test_check_writes_nothing_and_detects_changes(self) -> None:
        ex.export(self.fx.recipe, self.fx.input_dir, self.fx.runtime_dir)
        before = {p.name: p.read_bytes() for p in self.fx.runtime_dir.iterdir()}
        self.assertEqual(self.run_cli("--check"), 0)
        self.assertEqual({p.name: p.read_bytes() for p in self.fx.runtime_dir.iterdir()}, before)
        for name in ("blue.png", "red.png"):
            path = self.fx.runtime_dir / name
            image = Image.open(path).convert("RGBA")
            image.putpixel((0, 0), (255, 0, 0, 255))
            image.save(path)
            with self.assertRaisesRegex(aw.AssemblyError, f"{name}: committed pixels differ"):
                ex.check(self.fx.recipe, self.fx.input_dir, self.fx.runtime_dir)
            path.write_bytes(before[name])

    def test_blue_is_the_reflected_red_with_mawashi_recolor_only(self) -> None:
        parts = ex.export_parts(self.fx.recipe, self.fx.input_dir)
        red, blue = parts["red"], parts["blue"]
        flipped = red.image.transpose(Image.FLIP_TOP_BOTTOM)
        w, h = red.image.size
        # geometry: same size, pivot / body core reflected (x, H - y); FRONT (+x extent) unchanged
        self.assertEqual(blue.image.size, (w, h))
        self.assertEqual(blue.pivot, (red.pivot[0], h - red.pivot[1]))
        for k in ("core_a", "core_b"):
            self.assertEqual(blue.joints[k], (red.joints[k][0], h - red.joints[k][1]))
        self.assertAlmostEqual(im.body_core_length(im.Sprite(blue, "b")), 2 * aw.R_RUNTIME, places=5)
        self.assertEqual(aw.alpha_bbox(blue.image, 8)[0::2], aw.alpha_bbox(red.image, 8)[0::2])
        # alpha kept everywhere; colour changes only inside the recolor mask
        self.assertEqual(blue.image.getchannel("A").tobytes(), flipped.getchannel("A").tobytes())
        mask = im.mawashi_mask(flipped, self.fx.recipe["derived"]["recolor"])
        self.assertGreater(len(mask), 50)
        bp, fp = blue.image.load(), flipped.load()
        for y in range(h):
            for x in range(w):
                if (x, y) not in mask:
                    self.assertEqual(bp[x, y], fp[x, y], (x, y))

    def test_no_screen_space_flip(self) -> None:
        # the only transpose is the local-Y reflection (top-bottom); a left-right flip would break FRONT = +x
        original = Image.Image.transpose
        calls = []

        def spy(image, method):
            calls.append(method)
            return original(image, method)

        with mock.patch.object(Image.Image, "transpose", spy), mock.patch.object(ImageOps, "mirror", None):
            ex.export(self.fx.recipe, self.fx.input_dir, self.fx.runtime_dir)
        self.assertEqual(calls, [Image.FLIP_TOP_BOTTOM])


def ts_metadata() -> dict:
    """Width / height / pivot / body core per art id from productWrestlerArt.ts."""
    text = TS_METADATA.read_text(encoding="utf-8")
    out = {}
    for key in ex.RUNTIME_FILES:
        block = re.search(rf"\n  {key}: \{{(.*?)\n  \}}", text, re.S).group(1)
        number = lambda field: float(re.search(rf"{field}: ([0-9.]+)", block).group(1))  # noqa: E731
        pivot = re.search(r"pivot: \{ x: ([0-9.]+), y: ([0-9.]+) \}", block)
        out[key] = {
            "size": [int(number("width")), int(number("height"))],
            "pivot": [float(pivot.group(1)), float(pivot.group(2))],
            "body_core_px": number("bodyCoreDiameterPx"),
            "asset": re.search(r"assetPath: '([^']+)'", block).group(1),
        }
    return out


class RecipeOwnershipTests(unittest.TestCase):
    def test_historical_dual_recipe_cannot_drift_from_the_runtime_master(self) -> None:
        dual = pd.load_recipe(pd.DEFAULT_RECIPE)
        master = {k: v for k, v in RUNTIME_RECIPE["master"].items() if k != "key"}
        self.assertEqual(master, dual["sprites"]["red"])
        self.assertEqual(RUNTIME_RECIPE["alpha_threshold"], dual["alpha_threshold"])


REAL_RED = (aw.DEFAULT_INPUT_DIR / "wrestler_red.png").is_file()


@unittest.skipUnless(REAL_RED, "reviewed wrestler_red.png is not present in input.local/")
class CommittedRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # only the red source is visible to the exporter
        cls._tmp = tempfile.TemporaryDirectory()
        cls.input_dir = Path(cls._tmp.name)
        shutil.copyfile(aw.DEFAULT_INPUT_DIR / "wrestler_red.png", cls.input_dir / "wrestler_red.png")
        cls.report = {e["file"]: e for e in ex.check(RUNTIME_RECIPE, cls.input_dir, ex.DEFAULT_RUNTIME_DIR)}

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def test_committed_red_and_blue_match_a_red_only_fresh_export(self) -> None:
        self.assertEqual(sorted(self.report), ["blue.png", "red.png"])

    def test_red_pixels_unchanged_and_blue_is_the_accepted_candidate(self) -> None:
        self.assertEqual(self.report["red.png"]["pixel_sha256"], ACCEPTED_RED_PIXELS)
        self.assertEqual(self.report["blue.png"]["pixel_sha256"], ACCEPTED_BLUE_PIXELS)

    def test_accepted_mask_and_fringe_unchanged(self) -> None:
        red = Image.open(ex.DEFAULT_RUNTIME_DIR / "red.png").convert("RGBA").transpose(Image.FLIP_TOP_BOTTOM)
        rule = RUNTIME_RECIPE["derived"]["recolor"]
        mask = im.mawashi_mask(red, rule)
        self.assertEqual(len(mask), 2196)
        self.assertEqual(im.mask_fringe(red, mask, rule), 67)

    def test_runtime_metadata_matches_typescript_contract(self) -> None:
        ts = ts_metadata()
        for key, name in ex.RUNTIME_FILES.items():
            entry = self.report[name]
            self.assertEqual(ts[key]["asset"], f"assets/action/wrestler/{name}")
            self.assertEqual(ts[key]["size"], entry["size"], key)
            self.assertEqual(ts[key]["pivot"], entry["pivot"], key)
            self.assertAlmostEqual(ts[key]["body_core_px"], entry["body_core_px"], places=5)

    def test_accepted_runtime_geometry(self) -> None:
        self.assertEqual((self.report["red.png"]["size"], self.report["red.png"]["pivot"]), ([158, 178], [82.0, 95.0]))
        self.assertEqual((self.report["blue.png"]["size"], self.report["blue.png"]["pivot"]), ([158, 178], [82.0, 83.0]))
        for entry in self.report.values():
            self.assertAlmostEqual(entry["body_core_px"], 123.0769, delta=0.001)


if __name__ == "__main__":
    unittest.main()
