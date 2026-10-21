"""Focused tests for preview_idle_mirror_workflow.py (ART-WRESTLER-04A, Candidate / Pending User Visual Gate).

Synthetic images check the transform / mask / recolor rules; the committed runtime idle sprites (always
in the repository) check the real derivation, read-only inputs and determinism.
"""

from __future__ import annotations

import colorsys
import copy
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path

from PIL import Image, ImageDraw

TOOL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOL_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import assemble_wrestler as aw  # noqa: E402
import preview_idle_mirror_workflow as im  # noqa: E402
from assemble_wrestler import Part  # noqa: E402
from test_export_runtime_wrestlers import ts_metadata  # noqa: E402

RECIPE = im.load_recipe(im.DEFAULT_RECIPE)
RUNTIME = {key: aw.REPO_ROOT / RECIPE["sprites"][key]["file"] for key in im.SPRITES}


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TransformTests(unittest.TestCase):
    def test_reflection_keeps_front_and_maps_pivot(self) -> None:
        image = Image.new("RGBA", (40, 30), (0, 0, 0, 0))
        image.putpixel((35, 2), (255, 0, 0, 255))  # front (+x), wrestler's left (-y)
        sprite = im.Sprite(Part(image, (20.0, 12.0), {"core_a": (20.0, 2.0), "core_b": (20.0, 22.0)}), "t")
        out = im.mirror_local_y(sprite, "m")
        self.assertEqual(out.part.image.size, (40, 30))
        self.assertEqual(out.part.image.getpixel((35, 27)), (255, 0, 0, 255))  # same x (FRONT kept), y -> H-1-y
        self.assertEqual(out.part.pivot, (20.0, 18.0))  # (x, H - y)
        self.assertEqual(out.part.joints, {"core_a": (20.0, 28.0), "core_b": (20.0, 8.0)})
        self.assertEqual(im.body_core_length(out), im.body_core_length(sprite))

    def test_mask_selects_only_the_band_component(self) -> None:
        image = Image.new("RGBA", (60, 40), (0, 0, 0, 0))
        d = ImageDraw.Draw(image)
        d.rectangle((0, 0, 59, 39), fill=(240, 180, 140, 255))  # skin
        d.rectangle((5, 5, 30, 20), fill=(30, 60, 160, 255))  # mawashi (blue)
        d.rectangle((40, 30, 42, 32), fill=(20, 30, 90, 255))  # small blue-tinted speck elsewhere
        d.rectangle((45, 5, 55, 15), fill=(20, 20, 22, 255))  # hair (dark, unsaturated)
        mask = im.mawashi_mask(image, RECIPE["recolor"]["blue_to_red"])
        self.assertEqual(mask, {(x, y) for x in range(5, 31) for y in range(5, 21)})

    def test_recolor_changes_only_mask_and_keeps_alpha(self) -> None:
        image = Image.new("RGBA", (20, 20), (240, 180, 140, 255))
        ImageDraw.Draw(image).rectangle((2, 2, 9, 9), fill=(30, 60, 160, 128))
        mask = im.mawashi_mask(image, RECIPE["recolor"]["blue_to_red"])
        out = im.recolor(image, mask, RECIPE["recolor"]["blue_to_red"])
        for y in range(20):
            for x in range(20):
                if (x, y) in mask:
                    r, g, b, a = out.getpixel((x, y))
                    self.assertEqual(a, 128)
                    h = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0] * 360
                    self.assertTrue(h > 350 or h < 5, h)
                else:
                    self.assertEqual(out.getpixel((x, y)), image.getpixel((x, y)))
        self.assertEqual(aw.pixel_sha256(out), aw.pixel_sha256(im.recolor(image, mask, RECIPE["recolor"]["blue_to_red"])))


class RuntimeAssetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.before = {key: file_sha(path) for key, path in RUNTIME.items()}
        cls.authored = {key: im.load_runtime_sprite(aw.REPO_ROOT, key, RECIPE["sprites"][key]) for key in im.SPRITES}
        cls.result = im.build(RECIPE, aw.REPO_ROOT, aw.DEFAULT_ARENA_DIR)

    def test_recipe_matches_runtime_metadata(self) -> None:
        ts = ts_metadata()
        for key in im.SPRITES:
            spec = RECIPE["sprites"][key]
            self.assertEqual(ts[key]["size"], spec["size"])
            self.assertEqual(ts[key]["pivot"], [float(v) for v in spec["pivot"]])
            self.assertAlmostEqual(im.body_core_length(self.authored[key]), ts[key]["body_core_px"], places=5)

    def test_derived_pixels_outside_mask_equal_the_mirrored_source_and_alpha_is_kept(self) -> None:
        for master in im.SPRITES:
            mirrored, derived, mask = im.derive(self.authored[master], master, RECIPE)
            self.assertGreater(len(mask), 1500)
            src = mirrored.part.image.load()
            out = derived.part.image.load()
            width, height = mirrored.part.image.size
            changed = 0
            for y in range(height):
                for x in range(width):
                    if (x, y) in mask:
                        self.assertEqual(out[x, y][3], src[x, y][3])
                        changed += out[x, y] != src[x, y]
                    else:
                        self.assertEqual(out[x, y], src[x, y], (master, x, y))
            self.assertGreater(changed, 1000)

    def test_mask_pixels_all_carry_the_source_mawashi_hue(self) -> None:
        for master in im.SPRITES:
            rule = RECIPE["recolor"][im.DERIVATIONS[master][1]]
            mirrored, _, mask = im.derive(self.authored[master], master, RECIPE)
            px = mirrored.part.image.load()
            for p in mask:
                r, g, b, _ = px[p]
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                self.assertTrue(im._hue_in_band(h * 360, rule["source_hue_deg"]))
                self.assertGreaterEqual(s, rule["min_saturation"])

    def test_pivot_front_and_body_core_scale_preserved(self) -> None:
        for master in im.SPRITES:
            source = self.authored[master].part
            _, derived, _ = im.derive(self.authored[master], master, RECIPE)
            w, h = source.image.size
            self.assertEqual(derived.part.image.size, (w, h))
            self.assertEqual(derived.part.pivot, (source.pivot[0], h - source.pivot[1]))
            self.assertAlmostEqual(im.body_core_length(derived), 2 * aw.R_RUNTIME, places=5)
            # FRONT stays +x: the opaque extent along x is unchanged (no left-right flip)
            self.assertEqual(aw.alpha_bbox(derived.part.image, 8)[0::2], aw.alpha_bbox(source.image, 8)[0::2])

    def test_recolored_mawashi_matches_the_authored_counterpart_tone(self) -> None:
        for name, entry in self.result.info["derived"].items():
            target = name.split("_from_")[0]
            authored = self.result.info["authored"][target]["mawashi"]
            after = entry["mawashi_after"]
            hue_gap = abs((after["mean_hue_deg"] - authored["mean_hue_deg"] + 180) % 360 - 180)
            self.assertLess(hue_gap, 1.0, name)
            for got, want in zip(after["value_p10_p50_p90"][0::2], authored["value_p10_p50_p90"][0::2]):
                self.assertAlmostEqual(got, want, delta=0.02)

    def test_runtime_assets_are_read_only(self) -> None:
        self.assertEqual({key: file_sha(path) for key, path in RUNTIME.items()}, self.before)

    def test_build_is_deterministic(self) -> None:
        again = im.build(RECIPE, aw.REPO_ROOT, aw.DEFAULT_ARENA_DIR)
        self.assertEqual(aw.json_text(again.manifest), aw.json_text(self.result.manifest))
        self.assertEqual(aw.json_text(again.info), aw.json_text(self.result.info))

    def test_outputs_written(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            written = im.write_outputs(self.result, Path(tmp))
            names = {p.name for p in written}
            for required in (im.OUTPUT_COMPARISON, im.OUTPUT_FACEOFF, im.OUTPUT_JSON, im.OUTPUT_MANIFEST,
                             *im.OUTPUT_ROTATIONS.values(), *im.OUTPUT_DIAGNOSTICS.values(), *im.OUTPUT_DERIVED.values()):
                self.assertIn(required, names)
            manifest = json.loads((Path(tmp) / im.OUTPUT_MANIFEST).read_text(encoding="ascii"))
            self.assertNotRegex(json.dumps(manifest), r"\d{4}-\d{2}-\d{2}")


class FailClosedTests(unittest.TestCase):
    def test_changed_runtime_sprite_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for key, path in RUNTIME.items():
                dest = root / RECIPE["sprites"][key]["file"]
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, dest)
            blue = root / RECIPE["sprites"]["blue"]["file"]
            image = Image.open(blue).convert("RGBA")
            image.putpixel((0, 0), (1, 2, 3, 255))
            image.save(blue)
            with self.assertRaisesRegex(aw.AssemblyError, "blue: runtime sprite pixels differ"):
                im.load_runtime_sprite(root, "blue", RECIPE["sprites"]["blue"])
            with redirect_stderr(io.StringIO()):
                self.assertEqual(im.main(["--repo-root", str(root), "--output-dir", str(root / "out.local")]), 2)

    def test_bad_recipe_fails(self) -> None:
        recipe = copy.deepcopy(RECIPE)
        del recipe["recolor"]["red_to_blue"]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "r.json"
            path.write_text(json.dumps(recipe), encoding="utf-8")
            with self.assertRaisesRegex(aw.AssemblyError, "red_to_blue"):
                im.load_recipe(path)

    def test_outputs_are_git_ignored(self) -> None:
        result = subprocess.run(["git", "check-ignore", "-q", "tools/wrestler_art/output-idle-mirror.local/x.png"],
                                cwd=aw.REPO_ROOT)
        self.assertEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
