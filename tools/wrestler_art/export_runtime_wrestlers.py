"""Deterministic export of the accepted rigid Product wrestler sprites (ACTION-ART-03A).

Uses exactly the ART-WRESTLER-03A normalization (dual_rigid_recipe.json): source
identity check, one whole-sprite rotation so FRONT = +X, explicit body-core
scaled to 2R, exact /4 downscale to the 1x Product runtime size. Never mirrors.
The committed runtime files are only ever written by this script.

    PY tools/wrestler_art/export_runtime_wrestlers.py            # write public/assets/action/wrestler/
    PY tools/wrestler_art/export_runtime_wrestlers.py --check    # verify the committed files, write nothing
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

from PIL import Image

import assemble_wrestler as aw
import preview_dual_rigid_wrestlers as pd
import preview_single_wrestler as ps
from assemble_wrestler import AssemblyError, Part

DEFAULT_RUNTIME_DIR = aw.REPO_ROOT / "public" / "assets" / "action" / "wrestler"
RUNTIME_FILES = {key: f"{key}.png" for key in pd.SPRITES}


def export_parts(recipe: dict, input_dir: Path) -> Dict[str, Part]:
    """Runtime (1x) part per sprite: validated source -> 03A normalization -> exact /4 downscale."""
    parts = {}
    for key in pd.SPRITES:
        spec = recipe["sprites"][key]
        source, _ = aw.load_source(input_dir / spec["file"], spec, key)
        master, _ = ps.normalize_sprite(source, pd._sprite_recipe(spec, recipe["alpha_threshold"]))
        runtime = aw.runtime_part(master)
        ps._check_unclipped(runtime.image, f"{key} runtime")
        parts[key] = runtime
    return parts


def png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def describe(key: str, part: Part, data: bytes) -> dict:
    core = (part.joints["core_a"], part.joints["core_b"])
    return {
        "file": RUNTIME_FILES[key],
        "size": list(part.image.size),
        "pivot": ps._r6(part.pivot),
        "body_core_px": round(ps._dist(*core), 6),
        "pixel_sha256": aw.pixel_sha256(part.image),
        "file_sha256": hashlib.sha256(data).hexdigest(),
    }


def export(recipe: dict, input_dir: Path, runtime_dir: Path) -> List[dict]:
    parts = export_parts(recipe, input_dir)
    encoded = {key: png_bytes(part.image) for key, part in parts.items()}
    runtime_dir.mkdir(parents=True, exist_ok=True)
    for key, data in encoded.items():  # write each file atomically
        handle, temp = tempfile.mkstemp(prefix=".staging-", dir=runtime_dir)
        with os.fdopen(handle, "wb") as out:
            out.write(data)
        os.replace(temp, runtime_dir / RUNTIME_FILES[key])
    return [describe(key, parts[key], encoded[key]) for key in pd.SPRITES]


def check(recipe: dict, input_dir: Path, runtime_dir: Path) -> List[dict]:
    """Fresh export compared with the committed files (decoded pixels and encoded bytes)."""
    parts = export_parts(recipe, input_dir)
    report = []
    for key in pd.SPRITES:
        path = runtime_dir / RUNTIME_FILES[key]
        if not path.is_file():
            raise AssemblyError(f"committed runtime sprite missing: {path}")
        with Image.open(path) as committed:
            committed.load()
            pixels = aw.pixel_sha256(committed.convert("RGBA"))
            size = committed.size
        fresh = describe(key, parts[key], png_bytes(parts[key].image))
        if size != parts[key].image.size or pixels != fresh["pixel_sha256"]:
            raise AssemblyError(f"{path.name}: committed pixels differ from a fresh deterministic export")
        if hashlib.sha256(path.read_bytes()).hexdigest() != fresh["file_sha256"]:
            raise AssemblyError(f"{path.name}: committed PNG bytes differ from a fresh deterministic export")
        report.append(fresh)
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export (or --check) the rigid Product wrestler runtime sprites.")
    parser.add_argument("--recipe", type=Path, default=pd.DEFAULT_RECIPE, help="accepted dual rigid recipe")
    parser.add_argument("--input-dir", type=Path, default=aw.DEFAULT_INPUT_DIR, help="directory with the reviewed sprites")
    parser.add_argument("--runtime-dir", type=Path, default=DEFAULT_RUNTIME_DIR, help="runtime asset directory")
    parser.add_argument("--check", action="store_true", help="verify committed files against a fresh export")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        recipe = pd.load_recipe(args.recipe)
        report = (check if args.check else export)(recipe, args.input_dir, args.runtime_dir)
    except AssemblyError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for entry in report:
        print(f"{'ok' if args.check else 'wrote'} {entry['file']}: size {entry['size'][0]}x{entry['size'][1]}, "
              f"pivot ({entry['pivot'][0]:g}, {entry['pivot'][1]:g}), body core {entry['body_core_px']:.4f} px, "
              f"pixel sha256 {entry['pixel_sha256']}, file sha256 {entry['file_sha256']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
