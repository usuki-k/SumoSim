"""Deterministic normalization measurement for the Product Tsuppari poses (ACTION-07D).

Registers each authored red Tsuppari pose (tsuppari_recipe.json `masters`) to the accepted idle red master
(runtime_wrestler_recipe.json) with two torso landmarks measured on the source at 1/2 scale (BOX):
  H = hair blob centroid: max(R, G, B) < 80 and alpha > 200, 7 px opening (erosion then dilation, drops the
      outline), largest 4-connected component
  B = mawashi centroid: pixels in the accepted recolor hue band (with its saturation / value floors, alpha > 8),
      every 4-connected component >= 5% of the largest
Centroids are pixel centers ((x + 0.5) * 2 in source px); areas are counted at 1/2 scale and reported x 4.
  rotation delta = angle(H -> B) - idle angle(H -> B)
  scale s        = mean(sqrt(hair area ratio), sqrt(mawashi area ratio))
  the idle root / body-core points are carried by s * Rot(delta) about the H / B midpoint;
  source_front_deg = idle source_front_deg + delta.
The recorded recipe values must agree within recipe `measurement.tolerance` (they are what the exporter uses;
this helper never writes the recipe or any image).

    PY tools/wrestler_art/measure_tsuppari_pose.py            # print the measurement report (JSON)
    PY tools/wrestler_art/measure_tsuppari_pose.py --check    # compare with the recipe, exit 2 on mismatch
"""

from __future__ import annotations

import argparse
import colorsys
import math
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from PIL import Image, ImageFilter

import assemble_wrestler as aw
import export_runtime_wrestlers as ex
import export_tsuppari as et
import preview_idle_mirror_workflow as im
from assemble_wrestler import AssemblyError

DARK_MAX_RGB = 80
DARK_MIN_ALPHA = 200
HAIR_OPENING_PX = 7
MAWASHI_MIN_COMPONENT_SHARE = 0.05

Point = Tuple[int, int]


def _components(points: Set[Point]) -> List[Set[Point]]:
    """4-connected components in deterministic (sorted seed) order."""
    seen: Set[Point] = set()
    out = []
    for start in sorted(points):
        if start in seen:
            continue
        component, stack = {start}, [start]
        seen.add(start)
        while stack:
            x, y = stack.pop()
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in points and q not in seen:
                    seen.add(q)
                    component.add(q)
                    stack.append(q)
        out.append(component)
    return out


def _centroid_source_px(points: Set[Point]) -> Tuple[float, float]:
    n = len(points)
    return ((sum(p[0] for p in points) / n + 0.5) * 2, (sum(p[1] for p in points) / n + 0.5) * 2)


def measure_landmarks(source: Image.Image, rule: dict) -> dict:
    """Hair / mawashi centroids (source px) and areas (source px^2) of one full-size RGBA source."""
    half = source.convert("RGBA").resize((source.width // 2, source.height // 2), Image.BOX)
    width, height = half.size
    dark = Image.new("L", half.size, 0)
    dp = dark.load()
    px = half.load()
    band: Set[Point] = set()
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a > DARK_MIN_ALPHA and max(r, g, b) < DARK_MAX_RGB:
                dp[x, y] = 255
            if a <= 8:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if im._hue_in_band(h * 360, rule["source_hue_deg"]) and s >= rule["min_saturation"] and v >= rule["min_value"]:
                band.add((x, y))
    opened = dark.filter(ImageFilter.MinFilter(HAIR_OPENING_PX)).filter(ImageFilter.MaxFilter(HAIR_OPENING_PX)).load()
    hair_components = _components({(x, y) for y in range(height) for x in range(width) if opened[x, y]})
    if not hair_components or not band:
        raise AssemblyError("measurement: no hair blob or no mawashi band pixels")
    hair = max(hair_components, key=len)  # first largest in seed order
    belt = _components(band)
    largest = max(len(c) for c in belt)
    mawashi: Set[Point] = set().union(*[c for c in belt if len(c) >= MAWASHI_MIN_COMPONENT_SHARE * largest])
    return {
        "hair_centroid": _centroid_source_px(hair),
        "mawashi_centroid": _centroid_source_px(mawashi),
        "hair_px": len(hair) * 4,
        "mawashi_px": len(mawashi) * 4,
    }


def _angle(a, b) -> float:
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))


def normalization(idle_marks: dict, pose_marks: dict, idle_spec: dict) -> dict:
    """Carries the idle root / body core onto the pose (similarity about the H / B midpoint)."""
    ih, ib = idle_marks["hair_centroid"], idle_marks["mawashi_centroid"]
    ph, pb = pose_marks["hair_centroid"], pose_marks["mawashi_centroid"]
    delta = _angle(ph, pb) - _angle(ih, ib)
    scale = (math.sqrt(pose_marks["hair_px"] / idle_marks["hair_px"])
             + math.sqrt(pose_marks["mawashi_px"] / idle_marks["mawashi_px"])) / 2
    idle_mid = ((ih[0] + ib[0]) / 2, (ih[1] + ib[1]) / 2)
    pose_mid = ((ph[0] + pb[0]) / 2, (ph[1] + pb[1]) / 2)
    c, s = math.cos(math.radians(delta)), math.sin(math.radians(delta))

    def carry(p) -> List[float]:
        dx, dy = p[0] - idle_mid[0], p[1] - idle_mid[1]
        return [pose_mid[0] + scale * (c * dx - s * dy), pose_mid[1] + scale * (s * dx + c * dy)]

    return {
        "rotation_delta_deg": delta,
        "scale": scale,
        "source_front_deg": idle_spec["source_front_deg"] + delta,
        "root_source_px": carry(idle_spec["root_source_px"]),
        "body_core_source_px": [carry(p) for p in idle_spec["body_core_source_px"]],
    }


def _rounded_marks(marks: dict) -> dict:
    return {
        "hair_centroid": [round(v, 1) for v in marks["hair_centroid"]],
        "mawashi_centroid": [round(v, 1) for v in marks["mawashi_centroid"]],
        "hair_px": marks["hair_px"],
        "mawashi_px": marks["mawashi_px"],
    }


def measure(recipe: dict, input_dir: Path) -> dict:
    """Report for the idle reference and both red masters (sources validated by pixel SHA-256 first)."""
    runtime = ex.load_recipe(ex.DEFAULT_RECIPE)
    idle_spec = runtime["master"]
    rule = runtime["derived"]["recolor"]
    idle_source, _ = aw.load_source(input_dir / idle_spec["file"], idle_spec, "idle red")
    idle_marks = measure_landmarks(idle_source, rule)
    report: Dict[str, dict] = {"idle_reference": _rounded_marks(idle_marks)}
    for key, spec in sorted(recipe["masters"].items()):
        source, _ = aw.load_source(input_dir / spec["file"], spec, key)
        marks = measure_landmarks(source, rule)
        norm = normalization(idle_marks, marks, idle_spec)
        report[key] = {
            **_rounded_marks(marks),
            "rotation_delta_deg": round(norm["rotation_delta_deg"], 3),
            "scale": round(norm["scale"], 4),
            "source_front_deg": round(norm["source_front_deg"], 3),
            "root_source_px": [round(v, 2) for v in norm["root_source_px"]],
            "body_core_source_px": [[round(v, 2) for v in p] for p in norm["body_core_source_px"]],
        }
    return report


EVIDENCE_FIELDS = ("hair_centroid", "mawashi_centroid", "hair_px", "mawashi_px", "rotation_delta_deg", "scale")


def compare(recipe: dict, report: dict) -> List[str]:
    """Mismatches between the recipe and a fresh report (empty = reproducible)."""
    problems = []
    tolerance = recipe["measurement"]["tolerance"]  # front angle (deg), each point coordinate (source px)
    idle_ref = recipe["measurement"]["idle_reference"]
    for field in ("hair_centroid", "mawashi_centroid", "hair_px", "mawashi_px"):
        if idle_ref[field] != report["idle_reference"][field]:
            problems.append(f"idle_reference.{field}: recipe {idle_ref[field]} != measured {report['idle_reference'][field]}")
    for key, spec in sorted(recipe["masters"].items()):
        fresh = report[key]
        evidence = spec["measurement_evidence"]
        for field in EVIDENCE_FIELDS:
            if evidence[field] != fresh[field]:
                problems.append(f"{key}.measurement_evidence.{field}: recipe {evidence[field]} != measured {fresh[field]}")
        if abs(spec["source_front_deg"] - fresh["source_front_deg"]) > tolerance["front_deg"]:
            problems.append(f"{key}.source_front_deg: recipe {spec['source_front_deg']} vs measured {fresh['source_front_deg']}")
        pairs = [("root_source_px", spec["root_source_px"], fresh["root_source_px"])]
        pairs += [(f"body_core_source_px[{i}]", spec["body_core_source_px"][i], fresh["body_core_source_px"][i]) for i in (0, 1)]
        for name, recorded, measured in pairs:
            if max(abs(recorded[i] - measured[i]) for i in (0, 1)) > tolerance["point_px"]:
                problems.append(f"{key}.{name}: recipe {recorded} vs measured {measured}")
    return problems


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Measure (or --check) the Product Tsuppari pose normalization.")
    parser.add_argument("--recipe", type=Path, default=et.DEFAULT_RECIPE, help="Product Tsuppari recipe")
    parser.add_argument("--input-dir", type=Path, default=aw.DEFAULT_INPUT_DIR, help="red poses + idle red source")
    parser.add_argument("--check", action="store_true", help="compare with the recipe (within its tolerance)")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        recipe = et.load_recipe(args.recipe)
        report = measure(recipe, args.input_dir)
    except AssemblyError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(aw.json_text(report), end="")
    if args.check:
        problems = compare(recipe, report)
        for problem in problems:
            print(f"mismatch: {problem}", file=sys.stderr)
        if problems:
            return 2
        print("ok: recipe measurements are reproducible within tolerance", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
