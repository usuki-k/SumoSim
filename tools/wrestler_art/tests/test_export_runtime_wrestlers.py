"""Focused tests for export_runtime_wrestlers.py (ACTION-ART-03A runtime export).

Synthetic fixtures come from the dual-rigid tests (never Product art). The last
class checks the committed public/assets/action/wrestler/*.png against a fresh
export of the real reviewed sources (skipped when they are not present).
"""

from __future__ import annotations

import io
import re
import sys
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
from test_preview_dual_rigid_wrestlers import SOURCES, Fixture  # noqa: E402

TS_METADATA = aw.REPO_ROOT / "src" / "game" / "presentation" / "productWrestlerArt.ts"


class ExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = Fixture()
        self.runtime_dir = self.fx.output_dir / "runtime"

    def tearDown(self) -> None:
        self.fx.cleanup()

    def run_cli(self, *extra: str) -> int:
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            return ex.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--runtime-dir", str(self.runtime_dir), *extra])

    def test_missing_blue_fails(self) -> None:
        (self.fx.input_dir / "wrestler_blue.png").unlink()
        with self.assertRaisesRegex(aw.AssemblyError, "blue: source missing"):
            ex.export(self.fx.recipe, self.fx.input_dir, self.runtime_dir)
        self.assertEqual(self.run_cli(), 2)
        self.assertFalse(self.runtime_dir.exists())

    def test_missing_red_fails(self) -> None:
        (self.fx.input_dir / "wrestler_red.png").unlink()
        with self.assertRaisesRegex(aw.AssemblyError, "red: source missing"):
            ex.export(self.fx.recipe, self.fx.input_dir, self.runtime_dir)

    def test_wrong_pixel_identity_fails(self) -> None:
        sprite = SOURCES["red"][0].copy()
        sprite.putpixel((150, 150), (1, 2, 3, 255))
        sprite.save(self.fx.input_dir / "wrestler_red.png")
        with self.assertRaisesRegex(aw.AssemblyError, "red: decoded RGBA pixel SHA-256"):
            ex.export(self.fx.recipe, self.fx.input_dir, self.runtime_dir)

    def test_deterministic_export(self) -> None:
        first = ex.export(self.fx.recipe, self.fx.input_dir, self.runtime_dir)
        data = {key: (self.runtime_dir / name).read_bytes() for key, name in ex.RUNTIME_FILES.items()}
        second = ex.export(self.fx.recipe, self.fx.input_dir, self.fx.output_dir / "again")
        self.assertEqual(first, second)
        for key, name in ex.RUNTIME_FILES.items():
            self.assertEqual((self.fx.output_dir / "again" / name).read_bytes(), data[key])
        self.assertEqual(sorted(p.name for p in self.runtime_dir.iterdir()), ["blue.png", "red.png"])

    def test_check_accepts_fresh_export_and_rejects_edits(self) -> None:
        ex.export(self.fx.recipe, self.fx.input_dir, self.runtime_dir)
        self.assertEqual(self.run_cli("--check"), 0)
        path = self.runtime_dir / "blue.png"
        image = Image.open(path).convert("RGBA")
        image.putpixel((0, 0), (255, 0, 0, 255))
        image.save(path)
        with self.assertRaisesRegex(aw.AssemblyError, "blue.png: committed pixels differ"):
            ex.check(self.fx.recipe, self.fx.input_dir, self.runtime_dir)

    def test_export_matches_dual_rigid_runtime_normalization(self) -> None:
        report = {entry["file"]: entry for entry in ex.export(self.fx.recipe, self.fx.input_dir, self.runtime_dir)}
        dual = self.fx.build().dual_json["sprites"]
        for key, name in ex.RUNTIME_FILES.items():
            self.assertEqual(report[name]["size"], dual[key]["runtime"]["size"])
            self.assertEqual(report[name]["pivot"], dual[key]["runtime"]["pivot"])
            self.assertAlmostEqual(report[name]["body_core_px"], 2 * aw.R_RUNTIME, delta=0.001)

    def test_no_mirror_or_flip(self) -> None:
        def forbidden(*args, **kwargs):
            raise AssertionError("mirroring / flipping is not allowed in the runtime export")

        with mock.patch.object(Image.Image, "transpose", forbidden), \
                mock.patch.object(ImageOps, "mirror", forbidden), mock.patch.object(ImageOps, "flip", forbidden):
            ex.export(self.fx.recipe, self.fx.input_dir, self.runtime_dir)

    def test_transparent_padding_and_pivot_valid(self) -> None:
        for entry in ex.export(self.fx.recipe, self.fx.input_dir, self.runtime_dir):
            image = Image.open(self.runtime_dir / entry["file"])
            self.assertEqual(image.mode, "RGBA")
            bbox = aw.alpha_bbox(image, 0)
            self.assertTrue(bbox[0] > 0 and bbox[1] > 0 and bbox[2] < image.width and bbox[3] < image.height)
            x, y = entry["pivot"]
            self.assertTrue(0 < x < image.width and 0 < y < image.height)
            self.assertEqual((x, y), (int(x), int(y)))  # integer pixel-edge pivot


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


REAL_INPUTS = all((aw.DEFAULT_INPUT_DIR / f"wrestler_{key}.png").is_file() for key in ("blue", "red"))


@unittest.skipUnless(REAL_INPUTS, "reviewed wrestler_blue.png / wrestler_red.png are not present in input.local/")
class CommittedRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.recipe = ex.pd.load_recipe(ex.pd.DEFAULT_RECIPE)
        cls.report = {entry["file"]: entry for entry in ex.check(cls.recipe, aw.DEFAULT_INPUT_DIR, ex.DEFAULT_RUNTIME_DIR)}

    def test_committed_blue_and_red_match_fresh_export(self) -> None:
        # check() raised otherwise; both files present and byte / pixel identical
        self.assertEqual(sorted(self.report), ["blue.png", "red.png"])

    def test_runtime_metadata_matches_typescript_contract(self) -> None:
        ts = ts_metadata()
        for key, name in ex.RUNTIME_FILES.items():
            entry = self.report[name]
            self.assertEqual(ts[key]["asset"], f"assets/action/wrestler/{name}")
            self.assertEqual(ts[key]["size"], entry["size"], key)
            self.assertEqual(ts[key]["pivot"], entry["pivot"], key)
            self.assertAlmostEqual(ts[key]["body_core_px"], entry["body_core_px"], places=5)

    def test_accepted_runtime_geometry(self) -> None:
        self.assertEqual((self.report["blue.png"]["size"], self.report["blue.png"]["pivot"]), ([167, 181], [84.0, 87.0]))
        self.assertEqual((self.report["red.png"]["size"], self.report["red.png"]["pivot"]), ([158, 178], [82.0, 95.0]))
        for entry in self.report.values():
            self.assertAlmostEqual(entry["body_core_px"], 123.0769, delta=0.001)


if __name__ == "__main__":
    unittest.main()
