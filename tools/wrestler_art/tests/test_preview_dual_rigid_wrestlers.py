"""Focused tests for preview_dual_rigid_wrestlers.py (ART-WRESTLER-03A).

Synthetic fixtures are built in temporary directories (never Product art). The
last test class also checks the real reviewed blue / red sprites when they are
present in tools/wrestler_art/input.local/ and is skipped otherwise.
"""

from __future__ import annotations

import ast
import io
import json
import math
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

import assemble_wrestler as aw  # noqa: E402
import preview_dual_rigid_wrestlers as pd  # noqa: E402

GIF_NAMES = {
    "dual_advance.gif", "dual_push_contact.gif",
    "blue_stagger_translation_only.gif", "red_stagger_translation_only.gif",
    "blue_stagger_translation_plus_rotation.gif", "red_stagger_translation_plus_rotation.gif",
}
PNG_NAMES = {
    "blue_runtime_16angles.png", "red_runtime_16angles.png", "blue_pivot_guide.png", "red_pivot_guide.png",
    "dual_faceoff_arena_1920.png", "dual_faceoff_variants.png", "rigid_motion_contact_sheet.png",
}
REQUIRED_OUTPUTS = GIF_NAMES | PNG_NAMES | {"dual_rigid.json", "build_dual_rigid_manifest.json"}
ROOT = (150.0, 150.0)


def front_point(front_deg: float, distance: float) -> list:
    a = math.radians(front_deg)
    return [round(ROOT[0] + math.cos(a) * distance, 3), round(ROOT[1] + math.sin(a) * distance, 3)]


def make_sprite(front_deg: float, belt: tuple) -> Image.Image:
    """Separately drawn synthetic wrestler: body, knot behind, two hands in front (never mirrored)."""
    sprite = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    d = ImageDraw.Draw(sprite)
    d.ellipse((90, 90, 210, 210), fill=(240, 190, 150, 255))
    kx, ky = front_point(front_deg + 180, 62)
    d.rectangle((kx - 14, ky - 14, kx + 14, ky + 14), fill=belt)
    for side in (-35, 35):
        hx, hy = front_point(front_deg + side, 72)
        d.ellipse((hx - 13, hy - 13, hx + 13, hy + 13), fill=(230, 175, 135, 255))
    hx, hy = front_point(front_deg - 25, 25)
    d.ellipse((hx - 22, hy - 22, hx + 22, hy + 22), fill=(25, 22, 22, 255))
    return sprite


def sprite_recipe(name: str, image: Image.Image, front_deg: float) -> dict:
    a = math.radians(front_deg + 90)
    core = [[round(ROOT[0] - math.cos(a) * 58, 3), round(ROOT[1] - math.sin(a) * 58, 3)],
            [round(ROOT[0] + math.cos(a) * 58, 3), round(ROOT[1] + math.sin(a) * 58, 3)]]
    return {
        "file": f"wrestler_{name}.png", "size": list(image.size), "pixel_sha256": aw.rgba_pixel_sha256(image),
        "reviewed_file_sha256": "0" * 64, "source_front_deg": front_deg,
        "front_evidence": {"back_source_px": front_point(front_deg + 180, 62),
                           "front_source_px": front_point(front_deg, 72)},
        "root_source_px": list(ROOT), "body_core_source_px": core, "body_core_target_r": 2.0,
    }


SOURCES = {"blue": (make_sprite(12.0, (30, 50, 200, 255)), 12.0), "red": (make_sprite(165.0, (210, 40, 40, 255)), 165.0)}


def make_recipe() -> dict:
    return {
        "recipe_schema": 1,
        "name": "synthetic-dual",
        "alpha_threshold": 8,
        "sprites": {name: sprite_recipe(name, image, front) for name, (image, front) in SOURCES.items()},
        "faceoff": {"start_distance_r": 4.0, "variants": [
            {"label": "1", "distance_r": 4.0, "line_deg": 0}, {"label": "2", "distance_r": 2.8, "line_deg": 0},
            {"label": "3", "distance_r": 2.05, "line_deg": 0}, {"label": "4", "distance_r": 2.8, "line_deg": 30},
            {"label": "5", "distance_r": 2.8, "line_deg": -30}, {"label": "6", "distance_r": 2.8, "line_deg": 64}]},
        "motion": {
            "frame_ms": 50, "gif_view_px": [760, 420],
            "advance": {"start_distance_r": 4.0, "distance_r_each": 0.95, "hold_start_frames": 2, "move_frames": 5,
                        "hold_end_frames": 1},
            "stagger": {"contact_distance_r": 2.1, "back_r": 0.8, "lateral_r": 0.25, "recover_back_r": 0.3,
                        "recover_lateral_r": 0.08, "hold_start_frames": 2, "out_frames": 3, "hold_peak_frames": 1,
                        "recover_frames": 3, "hold_end_frames": 1, "rotation_max_deg": 5.0},
            "push": {"start_distance_r": 4.0, "contact_distance_r": 2.0, "approach_frames": 3, "hold_contact_frames": 1,
                     "shift_keys_r": [0.0, 0.3, -0.25, 0.0], "segment_frames": 2, "hold_end_frames": 1},
        },
    }


class Fixture:
    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.input_dir = root / "input.local"
        self.arena_dir = root / "arena"
        self.output_dir = root / "output-dual-rigid.local"
        self.input_dir.mkdir()
        self.arena_dir.mkdir()
        for name, (image, _) in SOURCES.items():
            image.save(self.input_dir / f"wrestler_{name}.png")
        Image.new("RGB", aw.ARENA_SIZE, (200, 160, 110)).save(self.arena_dir / aw.ARENA_BASE_FILE)
        overlay = Image.new("RGBA", aw.ARENA_SIZE, (0, 0, 0, 0))
        ImageDraw.Draw(overlay).rectangle((893, 470, 905, 610), fill=(238, 230, 211, 255))
        overlay.save(self.arena_dir / aw.ARENA_OVERLAY_FILE)
        self.recipe = make_recipe()
        self.recipe_path = root / "dual_rigid_recipe.json"
        self.recipe_path.write_text(json.dumps(self.recipe), encoding="utf-8")

    def build(self, recipe=None) -> pd.DualBuild:
        recipe = self.recipe if recipe is None else recipe
        pd.validate_recipe(recipe)
        return pd.build(recipe, self.input_dir, self.arena_dir)

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
    def test_missing_blue_fails(self) -> None:
        (self.fx.input_dir / "wrestler_blue.png").unlink()
        self.assertFails("blue: source missing")

    def test_missing_red_fails(self) -> None:
        (self.fx.input_dir / "wrestler_red.png").unlink()
        self.assertFails("red: source missing")

    def test_wrong_dimensions_fail(self) -> None:
        SOURCES["red"][0].resize((301, 300)).save(self.fx.input_dir / "wrestler_red.png")
        self.assertFails("red: size 301x300")

    def test_wrong_pixel_sha_fails(self) -> None:
        sprite = SOURCES["blue"][0].copy()
        sprite.putpixel((150, 150), (1, 2, 3, 255))
        sprite.save(self.fx.input_dir / "wrestler_blue.png")
        self.assertFails("blue: decoded RGBA pixel SHA-256")

    def test_alpha_validation(self) -> None:
        SOURCES["blue"][0].convert("RGB").save(self.fx.input_dir / "wrestler_blue.png")
        self.assertFails("blue: no alpha channel")
        Image.new("RGBA", (300, 300), (9, 9, 9, 255)).save(self.fx.input_dir / "wrestler_blue.png")
        self.assertFails("blue: alpha channel is fully opaque")

    def test_same_pixel_reencode_accepted(self) -> None:
        SOURCES["red"][0].save(self.fx.input_dir / "wrestler_red.png", compress_level=1)
        sources = self.fx.build().manifest["sources"]
        self.assertEqual(sources["red"]["pixel_sha256"], self.fx.recipe["sprites"]["red"]["pixel_sha256"])
        self.assertFalse(sources["red"]["file_sha256_matches_reviewed"])


class RecipeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.recipe = make_recipe()

    def assertInvalid(self, pattern: str) -> None:
        with self.assertRaisesRegex(aw.AssemblyError, pattern):
            pd.validate_recipe(self.recipe)

    def test_root_must_be_on_source(self) -> None:
        self.recipe["sprites"]["blue"]["root_source_px"] = [999, 10]
        self.assertInvalid("blue.root_source_px")

    def test_zero_body_core_fails(self) -> None:
        self.recipe["sprites"]["red"]["body_core_source_px"] = [[100, 100], [100, 100]]
        self.assertInvalid("'red': body-core reference length is 0")

    def test_non_perpendicular_body_core_fails(self) -> None:
        self.recipe["sprites"]["blue"]["body_core_source_px"] = [[100, 150], [200, 150]]
        self.assertInvalid("off perpendicular")

    def test_same_source_file_fails(self) -> None:
        self.recipe["sprites"]["red"]["file"] = "wrestler_blue.png"
        self.assertInvalid("separate source files")

    def test_stagger_rotation_limit(self) -> None:
        self.recipe["motion"]["stagger"]["rotation_max_deg"] = 12
        self.assertInvalid("rotation_max_deg")


class BuildTests(unittest.TestCase):
    """One synthetic build shared by the output checks (rendering is the slow part)."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.fx = Fixture()
        cls.result = cls.fx.build()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.fx.cleanup()

    def test_roots_inside_normalized_images(self) -> None:
        for key, info in self.result.dual_json["sprites"].items():
            w, h = info["runtime"]["size"]
            x, y = info["runtime"]["pivot"]
            self.assertTrue(0 < x < w and 0 < y < h, key)
            self.assertEqual(info["master"]["pivot"], [v * 4 for v in info["runtime"]["pivot"]])

    def test_body_core_scale(self) -> None:
        for key, info in self.result.dual_json["sprites"].items():
            self.assertGreater(info["body_core_source_distance_px"], 0, key)
            self.assertAlmostEqual(info["runtime"]["body_core_length_px"], 0.35 * 400 / 2.275 * 2, delta=0.01)
            (ax, _), (bx, _) = info["runtime"]["body_core_px"]
            self.assertAlmostEqual(ax, bx, delta=0.05, msg=key)  # perpendicular to +X after the rotation

    def test_no_sprite_or_tile_clipping(self) -> None:
        for key, info in self.result.dual_json["rotation_preview"].items():
            tile = info["tile_px"]
            for angle in info["angles"]:
                x0, y0, x1, y1 = angle["alpha_bbox_in_tile"]
                self.assertTrue(x0 > 0 and y0 > 0 and x1 < tile and y1 < tile, (key, angle["facing_deg"]))
            bbox = self.result.dual_json["sprites"][key]["runtime"]["alpha_bbox"]
            w, h = self.result.dual_json["sprites"][key]["runtime"]["size"]
            self.assertTrue(bbox[0] > 0 and bbox[1] > 0 and bbox[2] < w and bbox[3] < h, key)

    def test_sixteen_angles_for_both(self) -> None:
        for key in ("blue", "red"):
            angles = self.result.dual_json["rotation_preview"][key]["angles"]
            self.assertEqual([a["facing_deg"] for a in angles], [i * 22.5 for i in range(16)])
            self.assertIn(f"{key}_runtime_16angles.png", self.result.images)

    def test_pivot_stable_through_rotation(self) -> None:
        for key in ("blue", "red"):
            angles = self.result.dual_json["rotation_preview"][key]["angles"]
            self.assertEqual(len({tuple(a["root_in_tile_px"]) for a in angles}), 1)
            distances = [a["alpha_centroid_distance_from_root_px"] for a in angles]
            self.assertLess(max(distances) - min(distances), 0.1, key)

    def test_faceoff_points_toward_opponent(self) -> None:
        self.assertEqual(self.result.dual_json["faceoff_arena"]["facing_to_opponent_dot"], {"blue": 1.0, "red": 1.0})
        frame = self.result.dual_json["faceoff_arena"]["frame"]
        px_per_m = 400 / 2.275
        self.assertAlmostEqual(frame["blue"]["root_px"][0], 960 - 0.7 * px_per_m, places=3)
        self.assertAlmostEqual(frame["red"]["root_px"][0], 960 + 0.7 * px_per_m, places=3)
        for variant in self.result.dual_json["faceoff_variants"]:
            for key, dot in variant["facing_to_opponent_dot"].items():
                self.assertAlmostEqual(dot, 1.0, places=9, msg=(variant["label"], key))

    def test_faceoff_arena_size(self) -> None:
        self.assertEqual(self.result.images["dual_faceoff_arena_1920.png"].size, (1920, 1080))

    def test_required_faceoff_variants(self) -> None:
        variants = self.result.dual_json["faceoff_variants"]
        self.assertEqual(len(variants), 6)
        distances = sorted({v["distance_r"] for v in variants if v["line_deg"] == 0})
        self.assertEqual(distances, [2.05, 2.8, 4.0])
        lines = {v["line_deg"] for v in variants}
        self.assertTrue({30, -30}.issubset(lines))
        self.assertTrue(any(v["line_deg"] not in (0, 30, -30) for v in variants))
        self.assertEqual(self.result.images["dual_faceoff_variants.png"].size, (560 * 3, 560 * 2))

    def test_gif_frames_are_rigid_renders_of_the_runtime_sprites(self) -> None:
        # every frame equals a re-render from only (root, facing) per sprite: rotation + translation, no other edit
        arena, _ = pd.ps.load_arena(self.fx.arena_dir)
        shadow = aw.shadow_part(aw.R_RUNTIME)
        parts = {}
        for key in pd.SPRITES:
            spec = self.fx.recipe["sprites"][key]
            source = Image.open(self.fx.input_dir / spec["file"]).convert("RGBA")
            parts[key] = aw.runtime_part(pd.ps.normalize_sprite(source, pd._sprite_recipe(spec, 8))[0])
        motion = self.fx.recipe["motion"]
        scenes = {"dual_advance.gif": pd.advance_frames(motion["advance"]),
                  "dual_push_contact.gif": pd.push_frames(motion["push"])}
        for key in pd.SPRITES:
            scenes[f"{key}_stagger_translation_only.gif"] = pd.stagger_frames(motion["stagger"], key, False)
            scenes[f"{key}_stagger_translation_plus_rotation.gif"] = pd.stagger_frames(motion["stagger"], key, True)
        self.assertEqual(set(scenes), set(self.result.gifs))
        for name, frames in scenes.items():
            info = self.result.dual_json["animations"][name]
            self.assertEqual(info["frames"], pd.frames_json(frames))
            for index in (0, len(frames) // 2, len(frames) - 1):
                self.assertEqual(set(frames[index]), {"blue", "red"})
                expected = pd.render_view(arena, parts, shadow, frames[index], tuple(info["view_box"])).convert("RGB")
                self.assertEqual(aw.pixel_sha256(expected), aw.pixel_sha256(self.result.gifs[name][index]),
                                 (name, index))

    def test_translation_only_stagger_has_no_rotation(self) -> None:
        for key in pd.SPRITES:
            frames = self.result.dual_json["animations"][f"{key}_stagger_translation_only.gif"]["frames"]
            self.assertEqual(len({f[key]["facing_deg"] for f in frames}), 1, key)
            self.assertGreater(len({tuple(f[key]["root_px"]) for f in frames}), 2, key)

    def test_rotation_stagger_respects_max_angle(self) -> None:
        limit = self.fx.recipe["motion"]["stagger"]["rotation_max_deg"]
        for key in pd.SPRITES:
            frames = self.result.dual_json["animations"][f"{key}_stagger_translation_plus_rotation.gif"]["frames"]
            base = frames[0][key]["facing_deg"]
            offsets = [abs(f[key]["facing_deg"] - base) for f in frames]
            self.assertLessEqual(max(offsets), limit + 1e-6, key)
            self.assertAlmostEqual(max(offsets), limit, places=3)
            other = "red" if key == "blue" else "blue"
            self.assertEqual(len({tuple(f[other]["root_px"]) for f in frames}), 1)  # opponent stays still

    def test_contact_sheet_generated(self) -> None:
        self.assertEqual(len(self.result.dual_json["contact_sheet"]), 9)
        labels = " ".join(self.result.dual_json["contact_sheet"])
        for required in ("idle faceoff", "advance start", "advance mid", "near contact", "push displacement",
                         "stagger start", "stagger peak", "recovery"):
            self.assertIn(required, labels)
        self.assertIn("rigid_motion_contact_sheet.png", self.result.images)

    def test_metadata_has_no_timestamp(self) -> None:
        def keys(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    yield key
                    yield from keys(item)
            elif isinstance(value, list):
                for item in value:
                    yield from keys(item)

        for data in (self.result.manifest, self.result.dual_json):
            for key in keys(data):
                self.assertNotRegex(key.lower(), r"timestamp|^time|_time|date|created|generated", key)
            self.assertNotRegex(aw.json_text(data), r"\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}")

    def test_outputs_written_and_gifs_readable(self) -> None:
        out = self.fx.output_dir / "write"
        written = pd.write_outputs(self.result, out, [])
        self.assertEqual({p.name for p in written}, REQUIRED_OUTPUTS)
        manifest = json.loads((out / "build_dual_rigid_manifest.json").read_text(encoding="ascii"))
        for name in GIF_NAMES:
            info = self.result.dual_json["animations"][name]
            with Image.open(out / name) as gif:
                self.assertEqual(gif.format, "GIF")
                # Pillow merges identical consecutive (hold) frames and adds their durations
                self.assertLessEqual(gif.n_frames, info["frame_count"])
                self.assertGreater(gif.n_frames, 1, name)
                total = 0
                for i in range(gif.n_frames):
                    gif.seek(i)
                    total += gif.info["duration"]
            self.assertEqual(total, info["frame_count"] * info["frame_ms"], name)
            self.assertEqual(len(manifest["animated_outputs"][name]["file_sha256"]), 64)


class NoMirrorTests(FixtureTestCase):
    def test_build_never_flips_or_mirrors(self) -> None:
        def forbidden(*args, **kwargs):
            raise AssertionError("mirroring / flipping is not allowed in the dual-rigid path")

        with mock.patch.object(Image.Image, "transpose", forbidden), \
                mock.patch.object(ImageOps, "mirror", forbidden), mock.patch.object(ImageOps, "flip", forbidden):
            self.fx.build()

    def test_dual_module_has_no_mirror_operation(self) -> None:
        tree = ast.parse((TOOL_DIR / "preview_dual_rigid_wrestlers.py").read_text(encoding="utf-8"))
        names = {node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)}
        names |= {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}
        for forbidden in ("transpose", "FLIP_LEFT_RIGHT", "FLIP_TOP_BOTTOM", "mirror", "flip", "mirror_part",
                          "ImageOps"):
            self.assertNotIn(forbidden, names)


class DeterminismTests(FixtureTestCase):
    def test_deterministic_rerun_identical(self) -> None:
        first, second = self.fx.build(), self.fx.build()
        self.assertEqual(aw.json_text(first.manifest), aw.json_text(second.manifest))
        self.assertEqual(aw.json_text(first.dual_json), aw.json_text(second.dual_json))
        out_a, out_b = self.fx.output_dir / "a", self.fx.output_dir / "b"
        pd.write_outputs(first, out_a, [])
        pd.write_outputs(second, out_b, [])
        for name in REQUIRED_OUTPUTS:
            self.assertEqual((out_a / name).read_bytes(), (out_b / name).read_bytes(), name)

    def test_cli_fail_closed_writes_nothing(self) -> None:
        (self.fx.input_dir / "wrestler_red.png").unlink()
        with redirect_stderr(io.StringIO()) as err:
            code = pd.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--arena-dir", str(self.fx.arena_dir), "--output-dir", str(self.fx.output_dir)])
        self.assertEqual(code, 2)
        self.assertIn("error:", err.getvalue())
        self.assertFalse(self.fx.output_dir.exists())

    def test_cli_success(self) -> None:
        with redirect_stdout(io.StringIO()):
            code = pd.main(["--recipe", str(self.fx.recipe_path), "--input-dir", str(self.fx.input_dir),
                            "--arena-dir", str(self.fx.arena_dir), "--output-dir", str(self.fx.output_dir)])
        self.assertEqual(code, 0)
        self.assertEqual({p.name for p in self.fx.output_dir.iterdir()}, REQUIRED_OUTPUTS)


class RepositoryTests(unittest.TestCase):
    def test_local_inputs_and_outputs_are_git_ignored(self) -> None:
        repo = TOOL_DIR.parent.parent
        for path in ("tools/wrestler_art/input.local/wrestler_blue.png",
                     "tools/wrestler_art/input.local/wrestler_red.png",
                     "tools/wrestler_art/output-dual-rigid.local/dual_advance.gif",
                     "tools/wrestler_art/output-dual-rigid.local/build_dual_rigid_manifest.json"):
            result = subprocess.run(["git", "check-ignore", "-q", path], cwd=repo)
            self.assertEqual(result.returncode, 0, f"{path} is not ignored")
        tracked = subprocess.run(["git", "ls-files", "tools/wrestler_art"], cwd=repo, capture_output=True, text=True)
        self.assertNotRegex(tracked.stdout, r"\.local/|\.png|\.gif")


REAL_INPUTS = all((aw.DEFAULT_INPUT_DIR / f"wrestler_{key}.png").is_file() for key in ("blue", "red"))


@unittest.skipUnless(REAL_INPUTS, "reviewed wrestler_blue.png / wrestler_red.png are not present in input.local/")
class RealSpriteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.recipe = pd.load_recipe(pd.DEFAULT_RECIPE)
        cls.result = pd.build(cls.recipe, aw.DEFAULT_INPUT_DIR, aw.DEFAULT_ARENA_DIR)

    def test_reviewed_pixels(self) -> None:
        sources = self.result.manifest["sources"]
        self.assertEqual(sources["blue"]["pixel_sha256"],
                         "0de729df419e8be1c63c812c55c2e6a7a5b07319614194a4b649a3dc9adf65dd")
        self.assertEqual(sources["red"]["pixel_sha256"],
                         "a212dbfeab3da3ad4e42c352f1f7baea7f7b99fc901053bd05c4609df25dafe7")

    def test_runtime_body_core_scale(self) -> None:
        for key, info in self.result.dual_json["sprites"].items():
            self.assertAlmostEqual(info["runtime"]["body_core_length_px"], 123.0769, delta=0.01, msg=key)

    def test_real_faceoff_points_toward_opponent(self) -> None:
        for variant in self.result.dual_json["faceoff_variants"]:
            for dot in variant["facing_to_opponent_dot"].values():
                self.assertAlmostEqual(dot, 1.0, places=9)


if __name__ == "__main__":
    unittest.main()
