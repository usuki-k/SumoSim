"""Focused tests for export_grip_forearm_hand_gate.py (ACTION-11L temporary authored Grip hand marker Visual Gate).

A synthetic source (never Product art) checks the crop / downscale / mirror pipeline, determinism and fail-closed
behaviour. The last class checks the committed gate textures against the real User source, the TypeScript metadata and
that no other wrestler texture changed (skipped when the local source is not present).
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

from PIL import Image, ImageDraw

TOOL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOL_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import assemble_wrestler as aw  # noqa: E402
import export_grip_forearm_hand_gate as eh  # noqa: E402
import export_grip_success_gate as es  # noqa: E402
import export_runtime_wrestlers as ex  # noqa: E402
from test_export_grip_attempt_gate import GATE_PIXELS as ATTEMPT_GATE_PIXELS  # noqa: E402
from test_export_grip_success_gate import GATE_PIXELS as SUCCESS_GATE_PIXELS  # noqa: E402
from test_export_runtime_wrestlers import ACCEPTED_BLUE_PIXELS, ACCEPTED_RED_PIXELS  # noqa: E402

TS_METADATA = aw.REPO_ROOT / "src" / "game" / "presentation" / "gripSuccessSymbolVfx.ts"
RECIPE = eh.load_recipe(eh.DEFAULT_RECIPE)
ACCEPTED_SOURCE_PIXELS = "2f00cba4d6256028fdbd3c545eb5c7923d030d89881a5f3680efe00c67b0dba1"
GATE_PIXELS = {
    "forearm_hand.png": "c1c171a21aa9d9050d89456aac7d4910d088b9ae5a0c666c695d01340dbd5ebb",
    "forearm_hand_mirrored.png": "8fb61adf1e1a573c4bab91f442351d3a845c0cac419e32dfce60e5036cd961ea",
}


def make_source() -> Image.Image:
    """Synthetic 320x200 'arm': opaque body with an asymmetric blob, soft alpha edge pixels."""
    image = Image.new("RGBA", (320, 200), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.rectangle((40, 80, 250, 120), fill=(240, 170, 120, 254))
    d.ellipse((20, 70, 80, 140), fill=(230, 160, 110, 254))
    d.ellipse((230, 30, 280, 100), fill=(250, 180, 130, 120))
    return image


class Fixture:
    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.input_dir = root / "input.local"
        self.input_dir.mkdir()
        self.out_dir = root / "gate"
        image = make_source()
        name = "synthetic_forearm_hand.png"
        image.save(self.input_dir / name)
        recipe = json.loads(eh.DEFAULT_RECIPE.read_text(encoding="utf-8"))
        bbox = image.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        recipe["source"].update(file=name, size=[320, 200], pixel_sha256=aw.pixel_sha256(image),
                                reviewed_file_sha256=None, content_bbox_px=list(bbox))
        recipe["source"]["anchors"].update(hand_source_px=[50, 105], elbow_source_px=[245, 100])
        recipe["export"].update(padding_px=4, downscale=4)
        self.recipe_path = root / "recipe.json"
        self.recipe_path.write_text(json.dumps(recipe), encoding="utf-8")
        self.recipe = eh.load_recipe(self.recipe_path)

    def cleanup(self) -> None:
        self._tmp.cleanup()


class RecipeTests(unittest.TestCase):
    def test_user_source_identity(self) -> None:  # A1
        src = RECIPE["source"]
        self.assertEqual(src["pixel_sha256"], ACCEPTED_SOURCE_PIXELS)
        self.assertEqual(src["file"], "candidate_grip_forearm_hand_symbol.png")
        self.assertEqual(src["size"], [1536, 1024])
        self.assertEqual(src["anchors"]["hand_source_px"], [290, 752])
        self.assertEqual(src["anchors"]["elbow_source_px"], [1207, 567])

    def test_invalid_recipes_fail(self) -> None:
        cases = [
            (lambda r: r["source"].pop("anchors"), "missing 'anchors'"),
            (lambda r: r["source"]["anchors"].update(hand_source_px=[2000, 10]), "hand_source_px"),
            (lambda r: r["export"].update(downscale=0), "export.downscale"),
            (lambda r: r["export"]["outputs"].pop("forearm_hand_mirrored.png"), "export.outputs"),
        ]
        for mutate, pattern in cases:
            recipe = json.loads(eh.DEFAULT_RECIPE.read_text(encoding="utf-8"))
            mutate(recipe)
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "recipe.json"
                path.write_text(json.dumps(recipe), encoding="utf-8")
                with self.assertRaisesRegex(aw.AssemblyError, pattern):
                    eh.load_recipe(path)


class ExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = Fixture()

    def tearDown(self) -> None:
        self.fx.cleanup()

    def run_cli(self, *extra: str) -> int:
        with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            return eh.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--out-dir", str(self.fx.out_dir), *extra])

    def test_exactly_two_files(self) -> None:
        self.assertEqual(self.run_cli(), 0)
        self.assertEqual(sorted(p.name for p in self.fx.out_dir.iterdir()), sorted(eh.OUTPUT_FILES))

    def test_pipeline_is_crop_plus_premultiplied_box_downscale_only(self) -> None:  # A3 / A6
        authored, mirrored = eh.build_textures(self.fx.recipe, self.fx.input_dir)
        source = make_source()
        x0, y0, x1, y1 = eh.crop_box(self.fx.recipe, source)
        self.assertEqual(((x1 - x0) % 4, (y1 - y0) % 4), (0, 0))
        canvas = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        canvas.paste(source.crop((max(0, x0), max(0, y0), min(320, x1), min(200, y1))), (max(0, -x0), max(0, -y0)))
        reference = canvas.convert("RGBa").resize((canvas.width // 4, canvas.height // 4), Image.BOX).convert("RGBA")
        self.assertEqual(authored.image.tobytes(), reference.tobytes())
        # alpha is the BOX average of the source alpha (nothing else touches it)
        expected_alpha = canvas.getchannel("A").resize(reference.size, Image.BOX)
        diff = max(abs(a - b) for a, b in zip(authored.image.getchannel("A").getdata(), expected_alpha.getdata()))
        self.assertLessEqual(diff, 1)
        # an interior pixel keeps the source colour (no recolor / tone transform); the premultiplied round trip at
        # alpha 254 may move a channel by 1
        hx, hy = (int(round(v)) for v in authored.hand)
        got = authored.image.getpixel((hx, hy))[:3]
        self.assertLessEqual(max(abs(g - e) for g, e in zip(got, (230, 160, 110))), 1)
        self.assertEqual(mirrored.image.tobytes(), authored.image.transpose(Image.FLIP_TOP_BOTTOM).tobytes())

    def test_anchors_map_into_the_runtime_texture(self) -> None:  # A5
        authored, mirrored = eh.build_textures(self.fx.recipe, self.fx.input_dir)
        x0, y0, _, _ = eh.crop_box(self.fx.recipe, make_source())
        self.assertEqual(authored.hand, ((50 - x0) / 4, (105 - y0) / 4))
        self.assertEqual(authored.elbow, ((245 - x0) / 4, (100 - y0) / 4))
        h = authored.image.height
        self.assertEqual(mirrored.hand, (authored.hand[0], h - authored.hand[1]))
        for t in (authored, mirrored):
            for p in (t.hand, t.elbow):
                self.assertTrue(0 < p[0] < t.image.width and 0 < p[1] < t.image.height)

    def test_deterministic_export(self) -> None:  # A2
        first = eh.export(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        data = {name: (self.fx.out_dir / name).read_bytes() for name in eh.OUTPUT_FILES}
        again = self.fx.out_dir.parent / "again"
        self.assertEqual(eh.export(self.fx.recipe, self.fx.input_dir, again), first)
        for name, blob in data.items():
            self.assertEqual((again / name).read_bytes(), blob)

    def test_check_detects_stale_or_missing(self) -> None:  # A4
        eh.export(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        self.assertEqual(self.run_cli("--check"), 0)
        path = self.fx.out_dir / "forearm_hand.png"
        image = Image.open(path).convert("RGBA")
        image.putpixel((0, 0), (255, 0, 0, 255))
        image.save(path)
        with self.assertRaisesRegex(aw.AssemblyError, "committed pixels differ"):
            eh.check(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)
        path.unlink()
        with self.assertRaisesRegex(aw.AssemblyError, "files"):
            eh.check(self.fx.recipe, self.fx.input_dir, self.fx.out_dir)

    def test_missing_or_changed_source_fails_closed(self) -> None:  # A1
        source = self.fx.input_dir / "synthetic_forearm_hand.png"
        source.unlink()
        self.assertEqual(self.run_cli(), 2)
        self.assertFalse(self.fx.out_dir.exists())
        image = make_source()
        image.putpixel((0, 0), (1, 2, 3, 255))
        image.save(source)
        with self.assertRaisesRegex(aw.AssemblyError, "decoded RGBA pixel SHA-256"):
            eh.build_textures(self.fx.recipe, self.fx.input_dir)


def ts_metadata() -> dict:
    text = TS_METADATA.read_text(encoding="utf-8")
    rows = re.findall(r"assetPath: 'assets/action/wrestler/grip-symbol-authored-gate/(\w+)\.png',\s*width: (\d+),\s*"
                      r"height: (\d+),\s*hand: \{ x: ([0-9.]+), y: ([0-9.]+) \},[^\n]*\n\s*"
                      r"elbow: \{ x: ([0-9.]+), y: ([0-9.]+) \}", text)
    return {f"{name}.png": {"size": [int(w), int(h)], "hand_px": [float(hx), float(hy)], "elbow_px": [float(ex_), float(ey)]}
            for name, w, h, hx, hy, ex_, ey in rows}


REAL_INPUT = (aw.DEFAULT_INPUT_DIR / RECIPE["source"]["file"]).is_file()


@unittest.skipUnless(REAL_INPUT, "candidate_grip_forearm_hand_symbol.png is not present in input.local/")
class CommittedGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls.input_dir = Path(cls._tmp.name)
        shutil.copyfile(aw.DEFAULT_INPUT_DIR / RECIPE["source"]["file"], cls.input_dir / RECIPE["source"]["file"])
        cls.report = {e["file"]: e for e in eh.check(RECIPE, cls.input_dir, eh.DEFAULT_GATE_DIR)}

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def test_committed_textures_match_a_fresh_export(self) -> None:  # A4
        self.assertEqual({n: e["pixel_sha256"] for n, e in self.report.items()}, GATE_PIXELS)
        for entry in self.report.values():
            self.assertEqual(entry["size"], [94, 59])

    def test_typescript_metadata_matches_the_export(self) -> None:
        ts = ts_metadata()
        self.assertEqual(sorted(ts), sorted(eh.OUTPUT_FILES))
        for name, entry in self.report.items():
            self.assertEqual(ts[name]["size"], entry["size"], name)
            self.assertEqual(ts[name]["hand_px"], entry["hand_px"], name)
            self.assertEqual(ts[name]["elbow_px"], entry["elbow_px"], name)

    def test_real_crop_diagnostics(self) -> None:
        with Image.open(self.input_dir / RECIPE["source"]["file"]) as image:
            source = image.convert("RGBA")
        self.assertEqual(eh.crop_box(RECIPE, source), (36, 78, 1540, 1022))
        self.assertEqual(source.getchannel("A").getextrema(), (0, 254))

    def test_source_is_ignored_and_runtime_is_not(self) -> None:
        import subprocess
        self.assertEqual(subprocess.run(["git", "check-ignore", "-q", f"tools/wrestler_art/input.local/{RECIPE['source']['file']}"],
                                        cwd=aw.REPO_ROOT).returncode, 0)
        self.assertEqual(subprocess.run(["git", "check-ignore", "-q",
                                         "public/assets/action/wrestler/grip-symbol-authored-gate/forearm_hand.png"],
                                        cwd=aw.REPO_ROOT).returncode, 1)

    def test_other_wrestler_textures_unchanged(self) -> None:  # P2 / P6
        for key, expected in (("red", ACCEPTED_RED_PIXELS), ("blue", ACCEPTED_BLUE_PIXELS)):
            with Image.open(ex.DEFAULT_RUNTIME_DIR / f"{key}.png") as image:
                self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)
        for directory, table in ((es.DEFAULT_GATE_DIR, SUCCESS_GATE_PIXELS),
                                 (ex.DEFAULT_RUNTIME_DIR / "grip-attempt-gate", ATTEMPT_GATE_PIXELS)):
            for name, expected in table.items():
                with Image.open(directory / name) as image:
                    self.assertEqual(aw.pixel_sha256(image.convert("RGBA")), expected)


if __name__ == "__main__":
    unittest.main()
