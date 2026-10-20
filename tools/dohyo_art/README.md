# dohyo_art — Deterministic Dohyo Art Compositor

Offline asset-production tool for SumoSim Product art.

```
AI/Artist Sources  ->  Deterministic Geometry/Composition  ->  Review/Runtime Assets
(arena_base.png,       (compose_dohyo.py: exact annulus,       (overlay, composite,
 tawara_source.png)     shikiri, normalization, manifest)        preview, guide)
```

AI / artist creates visual source material; Python owns exact geometry and
deterministic composition. Same inputs + same parameters + same toolchain
produce the same decoded pixels and the same `build_manifest.json`.

## Relationship to gameplay

None. This tool is not imported by the game, Phaser, or any TypeScript code,
and does not change gameplay geometry or rules. It only *draws* the accepted
geometry (below) so Product art matches it. Integrating outputs into the
runtime is a separate Task.

Product source images are **not** bundled with the tool. They are passed by
file path. The canonical local location is `tools/dohyo_art/input.local/`,
which is git-ignored by the repository `*.local` rule (never commit them).

## Install

Verified toolchain: **Python 3.9.7** (Windows x64), **Pillow 11.3.0**,
**NumPy 2.0.2** (pinned in `requirements.txt`). Python 3.9+ is required.

```bash
# from the repository root
python -m venv tools/dohyo_art/.venv          # Windows with py launcher: py -3.9 -m venv tools/dohyo_art/.venv
tools/dohyo_art/.venv/Scripts/python -m pip install -r tools/dohyo_art/requirements.txt   # macOS/Linux: .venv/bin/python
```

The venv is git-ignored (`tools/dohyo_art/.gitignore`). Below, `PY` means
`tools/dohyo_art/.venv/Scripts/python` (or `.venv/bin/python`).

## Run

```bash
PY tools/dohyo_art/compose_dohyo.py \
  --arena-base tools/dohyo_art/input.local/arena_base.png \
  --tawara-source tools/dohyo_art/input.local/tawara_source.png \
  --output-dir tools/dohyo_art/output.local
```

`output.local/` is git-ignored too. The command prints written files and the
resolved texture repeat count. Full option list: `PY tools/dohyo_art/compose_dohyo.py --help`.

## Defaults (master space 3840×2160 = runtime 1920×1080 × 2)

| Option | Default | Runtime equivalent |
|---|---|---|
| center (fixed: canvas center) | (1920, 1080) | (960, 540) |
| `--outer-radius` (gameplay radius / tawara outer edge) | 800 | 400 |
| `--tawara-width` | 42 → inner radius 758 | 21 → 379 |
| `--shikiri-offset-x` | 124 → centers x 1796 / 2044 | 62 → 898 / 1022 |
| `--shikiri-length` (along Y) | 280 | 140 |
| `--shikiri-width` (along X) | 24 | 12 |
| `--protected-radius` (guide only) | 1064 | 532 |
| `--participant-offset-x` (guide only) | 246 | 123 |
| `--repeat` | `auto` | |
| `--trim-start` / `--trim-end` | 0.06 / 0.06 | |
| `--seam-crossfade` | 0.05 | |
| `--alpha-threshold` | 8 | |

## Outputs

| File | Content |
|---|---|
| `arena_base_master.png` | arena input normalized to exactly 3840×2160 RGB (tiny center crop + Lanczos resize only) |
| `dohyo_ring_overlay_master.png` | RGBA 3840×2160, transparent except the tawara annulus and shikiri lines (no arena/clay) |
| `geometry_guide_master.png` | developer guide (not a runtime asset): dimmed composite + red outer radius, orange inner radius, cyan protected radius, green shikiri outlines, white center cross, magenta participant centers |
| `composite_master.png` | exact alpha composite `arena_base_master + dohyo_ring_overlay_master` |
| `dohyo_ring_overlay_1920.png` | overlay downscaled to 1920×1080 (BOX = exact 2×2 average, lossless PNG) |
| `composite_preview_1920.png` | composite at 1920×1080 for User review |
| `build_manifest.json` | deterministic metadata (no timestamps): input basenames + SHA-256, normalization, geometry, texture parameters, decoded-pixel SHA-256 of each output |

## How it works

1. **Arena normalization** — the input must be opaque and within **0.2 %** of
   16:9 (the accepted 1672×941 source is off by 0.05 %, i.e. ~1 px). The tiny
   excess is center-cropped with a fractional box and resized with Lanczos to
   3840×2160. No non-uniform stretch, no other edit. A larger mismatch fails
   instead of hiding a material crop.
2. **Tawara texture** — crop the source to its alpha bounding box (alpha >
   `--alpha-threshold`, so faint stray pixels are ignored), trim
   `--trim-start` / `--trim-end` (fractions of the cropped width) from the
   frayed ends, then re-crop vertically. Source alpha is kept.
3. **Seam** — the last `--seam-crossfade` fraction of the strip is linearly
   crossfaded into its start (premultiplied alpha), so the strip tiles without
   a hard seam. With the defaults the trim lands on the outer edges of the
   first/last ties, so the seam blends tie into tie.
4. **Polar mapping** — for every pixel in the annulus, angle selects texture u
   (repeated `--repeat` times around 2π, integer so it closes exactly) and
   radius selects texture v (outer edge = top row of the strip). The tile is
   first Lanczos-resized (wrap-padded) to about 1:1 ring resolution, then
   sampled bilinearly. Ring edges use analytic 1 px coverage around the exact
   center/radii, multiplied by texture alpha.
5. **Shikiri** — exact rectangles with analytic pixel coverage, warm ivory
   `(238, 230, 211)`. Not inferred from any AI image.

`--repeat auto` picks the integer count that keeps the source strip's aspect
ratio on the ring's mid circumference (18 for the current accepted source).

The broad central circular wear pattern in the arena base is intentionally
**not** edited by this tool.

## Iterating on the look

Re-run with different options and compare `composite_preview_1920.png`
(and `composite_master.png` zoomed in for tie detail and the seam, which sits
at angle 0 = right side of the ring, plus every tile boundary):

```bash
# more / fewer ties around the ring
PY tools/dohyo_art/compose_dohyo.py ... --repeat 14
# cut more of the frayed / tied ends
PY tools/dohyo_art/compose_dohyo.py ... --trim-start 0.08 --trim-end 0.08
# wider tawara (geometry change: keep in sync with gameplay before shipping)
PY tools/dohyo_art/compose_dohyo.py ... --tawara-width 48
```

Use a different `--output-dir` per variant to compare side by side. The
manifest records every parameter, so a chosen preview can be reproduced.

## Fail-closed behavior

The command exits with status 2 and an `error:` message, writing nothing, when:

- an input is missing or not a readable image
- the arena is not opaque or differs from 16:9 by more than 0.2 %
- the tawara source has no alpha channel, empty alpha, is not horizontal,
  or becomes too small after trimming
- geometry is invalid: radius/width ≤ 0, inner radius ≤ 0, ring outside the
  canvas, protected radius < outer radius, shikiri overlapping each other or
  not strictly inside the inner radius
- texture options are out of range
- an output file would overwrite an input file

Outputs are rendered fully in memory, written to a staging directory inside
`--output-dir`, then moved into place (manifest last). A failed run leaves the
output directory as it was. No placeholder art is ever generated.

## Tests

```bash
PY -m unittest discover -s tools/dohyo_art/tests -v
```

Tests build synthetic fixtures in temporary directories (never Product art)
and check sizes, exact ring center/radii, transparency outside the annulus,
shikiri positions, alpha preservation, alpha-bbox crop/trim, fail-closed cases,
manifest contents, deterministic pixel hashes, and that the tool imports only
the stdlib, NumPy and Pillow. One test runs the CLI at the full 3840×2160 size.

Automated tests verify geometry and determinism only. Whether the tawara looks
right is a User visual check on `composite_preview_1920.png`.
