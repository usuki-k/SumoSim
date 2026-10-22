# wrestler_art — Deterministic Wrestler Art Previews

Offline review and export tools for SumoSim Product wrestler art:

| Tool | Task | Status |
|---|---|---|
| `export_tsuppari.py` / `measure_tsuppari_pose.py` / `preview_tsuppari.py` | ACTION-07D | **current runtime export** of the four Product Tsuppari poses (accepted SEPARATE) + measurement helper + review preview ([below](#product-tsuppari-poses-action-07d)) |
| `export_counter.py` | ACTION-08C | **current runtime export** of the Product Counter pose (red + derived blue; accepted) ([below](#product-counter-pose-action-08c)) |
| `export_runtime_wrestlers.py` | ART-WRESTLER-04B | **current runtime export**: red master + derived blue ([below](#runtime-export-art-wrestler-04b-red-master)) |
| `preview_idle_mirror_workflow.py` | ART-WRESTLER-04A | mirror / recolor comparison (history; red-master branch promoted) |
| `preview_dual_rigid_wrestlers.py` | ART-WRESTLER-03A | two separately authored sprites as rigid objects (history / comparison; runtime no longer uses the blue source) ([below](#dual-rigid-sprites-art-wrestler-03a)) |
| `preview_single_wrestler.py` | ART-WRESTLER-02B | one authored full-body sprite, rotation / arena evaluation (source REVISE IMAGE; helpers reused by 03A) ([below](#one-piece-sprite-evaluation-art-wrestler-02b)) |
| `assemble_wrestler.py` | ART-WRESTLER-02A | experiment / reference only: technical PASS, User Visual Gate **REJECTED**; its output is not the Product baseline |

## Parts assembly (ART-WRESTLER-02A, experiment)

```
isolated Product parts  ->  explicit regions / pivots / joints  ->  idle assembly previews
(parts_sheet.png,           (base_parts_recipe.json +               (User Visual Approval;
 torso.png)                  assemble_wrestler.py)                   no runtime assets yet)
```

AI draws isolated parts; this tool owns the human assembly. Full-body AI
generation repeatedly inverted the body axis (upper vs lower body ~180°), so the
whole-body anatomy is never asked of image generation. Same reviewed sources +
same recipe + same toolchain produce the same decoded pixels and the same
`build_manifest.json` (no timestamps, no randomness).

## Relationship to gameplay

None. The tool is not imported by the game, Phaser or TypeScript, and changes no
gameplay value (`bodyRadius`, contact, Grip, Push / Counter / Drive, Ring-out /
Tokudawara). It only *reads* the accepted presentation scale:
`R = 0.35 m × 400 px / 2.275 m ≈ 61.54 px` (body diameter ≈ 123 px).

Outputs are previews for the User Visual Gate. Nothing is copied into
`public/` and Phaser integration is a later Task.

## Install

Verified toolchain: **Python 3.9.7** (Windows x64), **Pillow 11.3.0** (pinned in
`requirements.txt`; no NumPy). Python 3.9+ is required.

```bash
# from the repository root
py -3.9 -m venv tools/wrestler_art/.venv          # or: python -m venv tools/wrestler_art/.venv
tools/wrestler_art/.venv/Scripts/python -m pip install -r tools/wrestler_art/requirements.txt   # macOS/Linux: .venv/bin/python
```

The venv is git-ignored. Below, `PY` means `tools/wrestler_art/.venv/Scripts/python`.

## Inputs (local only, never committed)

```
tools/wrestler_art/input.local/
  parts_sheet.png   1254x1254 RGBA  head / mawashi / upper arm / forearm+hand / foot (+ REJECTED torso)
  torso.png         1374x1145 RGBA  replacement torso candidate
```

`*.local` is ignored by the repository `.gitignore`. Source identity is the
**decoded RGBA pixel SHA-256** recorded in the recipe; the encoded PNG file
SHA-256 is recorded in the manifest for provenance only (a lossless re-save is
accepted, any pixel change is rejected).

## Run

```bash
PY tools/wrestler_art/assemble_wrestler.py
```

Defaults: `--recipe tools/wrestler_art/base_parts_recipe.json`,
`--input-dir tools/wrestler_art/input.local`,
`--output-dir tools/wrestler_art/output-assembly.local`,
`--arena-dir public/assets/action/background` (committed Product arena, read only).

## Outputs (`output-assembly.local/`, git-ignored)

| File | Content |
|---|---|
| `torso_master.png` … `foot_master.png` | extracted parts normalized to master scale, transparent padding ≥ 24 px, sizes and pivots on multiples of 4 |
| `parts.json` | crop source, normalized size, pivot, joints, lengths, `r_master_px`, mirror rule, torso anchors, idle geometry |
| `build_manifest.json` | source names + file / pixel SHA-256, recipe, scale, arena asset hashes, decoded-pixel SHA-256 of every image output (no timestamp) |
| `idle_master.png` | transparent, right-facing assembled idle wrestler, master scale (1184² canvas, root at center) |
| `idle_runtime.png` | same assembly from the /4 runtime parts (296² canvas) |
| `idle_runtime_4angles.png` | runtime assembly rotated 0° / 45° / 90° / 180° |
| `idle_on_arena_1920.png` | accepted arena base + ring overlay, preview shadow, two wrestlers at the prototype start positions (x = ∓0.7 m) at runtime scale |
| `pivot_guide.png` | developer guide: root, body circle R, body axis, shoulders, elbows, hands, head, mawashi, ankle → toe |

## Scale

- `R_runtime = 0.35 × 400 / 2.275 = 61.538 px`; master = runtime × 4, `R_master = 246.154 px`.
- Every part is uniformly scaled to master R by an explicit recipe measure
  (`alpha_height`, `distance` between two source points, or `pivot_to_joint`).
  Source pixel sizes are not trusted as anatomy.
- The torso is the reference: its shoulder-to-shoulder alpha height = 2.0 R.
- Runtime = exact /4 Lanczos downscale of each master part (pivots / 4); the
  runtime previews assemble those parts with bilinear sampling, like Phaser.

## Coordinates and assembly

- Source points are continuous image px: pixel edges on integers, +x right, +y down.
- Local character frame: root = participant center, **+x = FRONT**, −x = BACK,
  **+y = wrestler's RIGHT**, −y = LEFT (screen +y when facing right).
- Every part is normalized with its axis on +x (the tool rotates the upper arm /
  forearm / foot at source resolution so pivot → axis joint is exactly +x).
- Right-side arm / forearm / foot = source orientation. **Left = the same image
  flipped top-bottom** (local y → −y), pivot/joints `(x, H − y)`, local
  positions `(x, −y)`, local angles negated. No independent left art.
- Torso anchors (shoulder, head, mawashi) are measured on the torso art; the
  left shoulder is the mirror of the right one.
- Layers (spec §8): feet → torso → mawashi → upper arms → forearms/hands → head.
- The rotation center may lie outside the cropped pixels (the shoulder pivot
  sits inside the torso deltoid cap while the upper arm's painted joint cap is
  cropped off); the normalized canvas always contains the pivot.

The arm idle pose is explicit forward kinematics (`idle.upper_arm_angle_deg`,
`idle.forearm_angle_deg`); there is no reach IK yet.

## Recipe (`base_parts_recipe.json`)

Only the accepted source layout: source sizes and pixel hashes, the rejected
original sheet-torso region, one explicit crop box / pivot / joints / scale per
part, the idle pose and the layer order. All values are **Provisional** for
User tuning; edit the recipe and re-run.

## Fail-closed behavior

Exit status 2 with `error:` and nothing written when: a source is missing or
unreadable, its size differs, it has no alpha / no transparency, its decoded
RGBA pixel hash differs, the recipe is invalid (missing part, point off the
source, unknown measure, torso not from `torso.png`), a crop is empty or
contains visible pixels of a rejected region, the arena asset is missing or not
1920×1080, the assembly touches the preview canvas edge, or an output would
overwrite an input. Outputs are staged and moved into place (manifest last).

## Tests

```bash
PY -m unittest discover -s tools/wrestler_art/tests -v
```

Synthetic fixtures in temporary directories cover input validation (missing,
pixel hash, re-encode accepted, size, alpha), crops, rejected-region handling,
alpha / padding, pivots, axis, lengths, mirroring, output names, runtime scale,
4-angle and arena previews, no timestamp, deterministic rerun, CLI fail-closed,
git-ignore and imports. When the reviewed sources are present the real recipe
is also checked (replacement torso only, no rejected pixels, reviewed pixel
hashes, 123 px torso, determinism).

Automated tests verify geometry and determinism only. Whether the wrestler looks
right is the User visual check.

## One-piece sprite evaluation (ART-WRESTLER-02B)

```
wrestler_single.png  ->  single_sprite_recipe.json  ->  rotation + arena previews
(reviewed candidate)     (root, one whole-sprite        (User Visual Gate; no runtime
                          rotation, body-core scale)     asset, no Phaser integration)
```

The tool only crops transparent margin, adds transparent padding, rotates the
whole sprite once, scales it uniformly and resamples it (premultiplied alpha,
Lanczos). It never warps, perspective-corrects, repaints or moves body parts:
if the painted camera bias looks wrong when rotated, that is a visual result
for the User, not something to hide.

```bash
PY tools/wrestler_art/preview_single_wrestler.py
```

Defaults: `--recipe tools/wrestler_art/single_sprite_recipe.json`,
`--input-dir tools/wrestler_art/input.local` (needs `wrestler_single.png`,
1254×1254 RGBA, identity = decoded RGBA pixel SHA-256),
`--output-dir tools/wrestler_art/output-single.local`,
`--arena-dir public/assets/action/background` (read only).

### Recipe (`single_sprite_recipe.json`, Provisional)

- `orientation_correction_deg`: the one whole-sprite rotation (deg, + = clockwise
  on screen) that puts the painted back → front axis on +X.
  `orientation_evidence` documents the landmarks it was read from (informational).
- `root_source_px`: participant center = rotation pivot (source px).
- `body_core_source_px`: two points across the central torso, perpendicular to
  the corrected +X axis (checked within 3°), excluding arms / hands / feet /
  head / knot. Their distance is scaled to `body_core_target_r` (2R ≈ 123.08
  runtime px). The full alpha bbox is never the scale reference.

### Outputs (`output-single.local/`, git-ignored)

| File | Content |
|---|---|
| `single_master.png` | normalized sprite, master scale (runtime × 4), root on a multiple of 4 |
| `single_runtime.png` | exact /4 downscale (logical 1×) |
| `single_pivot_guide.png` | root, body circle R, ±X / ±Y axes, body-core scale line |
| `single_runtime_16angles.png` | runtime sprite at 0°–337.5° (22.5° steps), same root in every tile |
| `single_on_arena_1920.png` | Product arena + two wrestlers at the prototype start roots (x = 960 ∓ 0.7 m × 175.82 px/m, y = 540), facing 0° / 180° |
| `single_on_arena_8facings.png` | one wrestler at the ring center on the same arena crop, 0°–315° (45° steps) |
| `single_sprite.json` | source identity, correction, root, body-core points / distance, scales, master / runtime pivot, runtime alpha bbox, per-angle tile bbox and centroid distance |
| `build_single_manifest.json` | recipe, source file / pixel SHA-256, arena asset hashes, decoded-pixel SHA-256 of every image (no timestamp) |

Transparent sprite previews have no shadow. The arena previews add the same
near-circular procedural shadow as the 02A preview (2.25R × 2.0R, α 0.28, world
offset (+0.07R, +0.12R)).

The run fails closed (exit 2, nothing written) on a missing / resized /
pixel-different / alpha-less source, an invalid recipe (point off the source,
zero or non-perpendicular body core, correction beyond ±30°), a sprite touching
an output or preview tile edge, or a missing arena asset.

Tests: `PY -m unittest discover -s tools/wrestler_art/tests -v` runs both tools'
tests (`test_preview_single_wrestler.py` for this one).

## Dual rigid sprites (ART-WRESTLER-03A)

Tests the minimal animation model: each wrestler is **one rigid authored
image**; facing = whole-sprite rotation, movement / stagger = whole-sprite
translation (optionally a tiny rigid rotation). Blue and red are separate
sources and are **never mirrored or flipped**; there are no per-limb
transforms, warps, repaints or in-between frames.

```bash
PY tools/wrestler_art/preview_dual_rigid_wrestlers.py
```

Inputs: `input.local/wrestler_blue.png`, `input.local/wrestler_red.png`
(1254×1254 RGBA, identity = decoded RGBA pixel SHA-256). Outputs go to
`output-dual-rigid.local/` (git-ignored). Takes ~30 s.

### Recipe (`dual_rigid_recipe.json`, Provisional)

Per sprite: `source_front_deg` (painted back → front axis in the source; the
sprite is rotated once by `−source_front_deg` so FRONT = local +X;
`front_evidence` = knot center → midpoint of both hands, informational),
`root_source_px`, `body_core_source_px` (perpendicular to the front axis within
3°, normalized to 2R ≈ 123.08 runtime px). `faceoff.variants` and `motion` are
explicit **preview-only** paths in R (frame counts, distances, lateral drift,
`stagger.rotation_max_deg` ≤ 6°); they are not gameplay animation values.

### Outputs

| File | Content |
|---|---|
| `blue_runtime_16angles.png`, `red_runtime_16angles.png` | 0°–337.5° whole-sprite rotation, same root per tile |
| `blue_pivot_guide.png`, `red_pivot_guide.png` | root, ±X / ±Y, body circle R, body-core line (master scale) |
| `dual_faceoff_arena_1920.png` | Product arena, blue left / red right at the prototype start roots, each facing the other root |
| `dual_faceoff_variants.png` | start 4R, pre-contact 2.8R, near contact 2.05R, line ±30°, side position (line 64°) |
| `dual_advance.gif` | both translate toward each other along their facing (4R → 2.1R) |
| `{blue,red}_stagger_translation_only.gif` | the staggering wrestler moves back 0.8R + 0.25R lateral (its local +Y) and recovers; facing constant |
| `{blue,red}_stagger_translation_plus_rotation.gif` | same path + rigid rotation up to `rotation_max_deg` (5°) and back |
| `dual_push_contact.gif` | approach to 2.0R, then the touching pair shifts +0.3R / −0.25R / +0.15R / 0 |
| `rigid_motion_contact_sheet.png` | labeled static frames: idle faceoff, advance start / mid, near contact, push displacement, stagger start / peak / recovery, peak with rotation |
| `dual_rigid.json` | per-sprite axis / root / body core / scales / runtime pivot / alpha bbox, 16-angle data, faceoff facing·direction dots, motion parameters, every GIF frame's (root, facing) |
| `build_dual_rigid_manifest.json` | recipe, source file / pixel SHA-256, arena hashes, decoded-pixel SHA-256 of every PNG, GIF file + decoded-frame SHA-256 (no timestamp) |

GIFs are written with Pillow only (adaptive palette, 50 ms frames, loop); Pillow
merges identical consecutive hold frames and adds their durations. Draw order
is blue then red, with the near-circular preview shadow under both.

Tests: `test_preview_dual_rigid_wrestlers.py` (includes a build with
`Image.transpose` / `ImageOps.mirror` / `ImageOps.flip` patched to fail, and a
check that every GIF frame equals a re-render from only (root, facing)).

## Runtime export (ART-WRESTLER-04B, red master)

The accepted rigid Product wrestlers are committed as
`public/assets/action/wrestler/red.png` and `blue.png`. They are only ever
written by this script (no manual resize / rotate / edit):

```bash
PY tools/wrestler_art/export_runtime_wrestlers.py           # write public/assets/action/wrestler/
PY tools/wrestler_art/export_runtime_wrestlers.py --check   # verify committed files, write nothing
```

One authored master, one recipe (`runtime_wrestler_recipe.json`, the single current
source of truth):

- `red.png`: `input.local/wrestler_red.png` (size, alpha, decoded RGBA pixel
  SHA-256 checked), the 03A normalization (one whole-sprite rotation to FRONT =
  +X, explicit root, body core = 2R) and an exact /4 downscale.
- `blue.png`: that normalized red runtime image reflected across the local X
  axis, `(x, y) -> (x, H - y)` (FRONT kept; pivot / body core mapped the same
  way), plus the 04A mawashi-only recolor (`derived.recolor`). No separately
  authored blue source is read.

It prints size, pivot, body core and pixel / file SHA-256 per file. The runtime
metadata in `src/game/presentation/productWrestlerArt.ts` must match this output;
`tests/test_export_runtime_wrestlers.py` checks the committed PNGs (with only the
red source visible) and that TypeScript contract against a fresh export.

## Product Tsuppari poses (ACTION-07D)

The held left / right Tsuppari pose of the Product wrestlers (User-accepted **SEPARATE** strategy, promoted
from the ACTION-07C / 07C1 / 07C2 Visual Gate). The idle `red.png` / `blue.png` and their recipe are not
touched.

```bash
PY tools/wrestler_art/export_tsuppari.py               # write public/assets/action/wrestler/tsuppari/ (4 files)
PY tools/wrestler_art/export_tsuppari.py --check       # verify the committed 4 files, write nothing
PY tools/wrestler_art/measure_tsuppari_pose.py         # print the normalization measurement (JSON)
PY tools/wrestler_art/measure_tsuppari_pose.py --check # compare it with the recipe (tolerance), write nothing
PY tools/wrestler_art/preview_tsuppari.py              # -> output-tsuppari.local/ (git-ignored)
```

Inputs (`input.local/`, never committed; identity = decoded RGBA pixel SHA-256 in the recipe):
`candidate_red_tsuppari_left.png` / `candidate_red_tsuppari_right.png` (the only runtime sources) and
`candidate_blue_tsuppari_left.png` / `candidate_blue_tsuppari_right.png` (preview reference sheets only). The
measurement helper and the preview also read the idle `wrestler_red.png`.

Recipe (`tsuppari_recipe.json`, Product contract):

- Per red pose: `hand`, `source_front_deg`, `root_source_px`, `body_core_source_px` (same 03A
  normalization as the idle red: one whole-sprite rotation, body core = 2R, exact /4 downscale). These
  recorded values are what the exporter uses.
- `measurement`: the method, implemented by `measure_tsuppari_pose.py`. Each pose body is registered to the
  idle red master with two torso landmarks on the source at 1/2 BOX scale: the hair blob (max(R, G, B) < 80,
  alpha > 200, 7 px opening, largest component) and the mawashi (accepted hue band, components >= 5% of the
  largest). `measurement_evidence` is the exact helper output; the recorded front / points must agree with a
  fresh measurement within `measurement.tolerance` (0.1 deg / 1 source px).
- Fixed mapping (`export_tsuppari.OUTPUTS`; the local-Y reflection swaps the wrestler's hand):

  | texture | source |
  |---|---|
  | `red_left.png` | red L |
  | `red_right.png` | red R |
  | `blue_left.png` | red R reflected + recolor |
  | `blue_right.png` | red L reflected + recolor |

- Blue recolor = the accepted red -> blue rule of `runtime_wrestler_recipe.json` (single owner), validated
  per pose at runtime scale against `mask_limits` (mask size, band pixels outside the largest component,
  fringe); the run fails closed otherwise.

Runtime: `src/game/presentation/productTsuppariArt.ts` mirrors the 4 sizes / pivots (checked by
`tests/test_export_tsuppari.py`, which also pins the four pixels to the accepted ACTION-07C2 SEPARATE
textures). The pose is selected only by wrestler (red / blue) and hand, and held for the whole Tsuppari action.

Preview outputs: `pivot_guide_<pose>.png` (2 red poses + 2 blue references, master scale),
`product_tsuppari.png` (idle + four poses), `idle_tsuppari_alignment.png` (each pose with the same-colour
idle outline), `rotations.png` (0 / 45 / 90 / 180 / 270), `faceoff.png` (0.70 m contact and 0.90 m
Tsuppari reach; one or both striking), `mawashi_mask_diagnostics.png`, `blue_reference_vs_derived.png`,
`tsuppari.json` and `build_tsuppari_manifest.json`.

History: the ACTION-07C Visual Gate exported 12 textures (SEPARATE / MIRROR-L / MIRROR-R) behind a key-4
runtime toggle. MIRROR-L / MIRROR-R were rejected (they flip the head / body asymmetry between idle and
pose); the gate exporter, recipe and textures were replaced by the Product files above (git history only).

## Product Counter pose (ACTION-08C)

The Counter / hiki-sabaki (ArrowDown) pose of the Product wrestlers, accepted by User Play Test together with its
presentation-only body rotation (ACTION-08B) and promoted from the ACTION-08A / 08A1 / 08B Visual Gate. The idle
and Product Tsuppari textures and recipes are not touched.

```bash
PY tools/wrestler_art/export_counter.py            # write public/assets/action/wrestler/counter/ (red.png / blue.png)
PY tools/wrestler_art/export_counter.py --check    # verify the committed red.png / blue.png, write nothing
```

- Input: `input.local/candidate_red_counter.png` only (never committed; identity = decoded RGBA pixel SHA-256
  in `counter_recipe.json`).
- red = the pose normalized like the idle red (1265x1244 source: front 178.8, root (863, 553), body core
  (853, 111)-(868, 846), measured once with the Product Tsuppari landmark registration; `measurement_evidence`
  records it).
- blue = red reflected across the local X axis + the accepted mawashi recolor of `runtime_wrestler_recipe.json`
  (single owner), validated against `mask_limits` (fail closed). `max_missed_px` is 80 as a narrow, accepted
  property of this Counter source only (its missed pixels are semi-transparent outline fringe); idle / Tsuppari
  keep 60. Counter has no hand, so there is one pose per colour.
- Runtime: `src/game/presentation/productCounterArt.ts` mirrors the two sizes / pivots (checked by
  `tests/test_export_counter.py`, which also pins both pixels to the accepted gate textures). The pose is shown
  exactly while the visual pose is `counter`, and the body sprite turns `sin(pi * progress) * 35 deg` (red +,
  blue -) on top of the canonical facing.

History: ACTION-08A ran a first Counter candidate as a temporary `counter-gate` Visual Gate (rejected as too
similar to Tsuppari); ACTION-08A1 replaced it with the lateral-sweep pose and ACTION-08B added the body rotation.
`counter_gate_recipe.json` / `export_counter_gate.py` / `counter-gate/` were renamed to the Product files above
(git history keeps the gate stages).

## Idle mirror + mawashi recolor (ART-WRESTLER-04A, comparison / history)

The red-master branch of this experiment was accepted and promoted to the runtime
export above (ART-WRESTLER-04B). This preview remains as comparison evidence: it
rebuilds the two separately authored 03A idle sprites from `input.local/` and
derives each counterpart from the other (blue master and red master). The
red -> blue rule is read from `runtime_wrestler_recipe.json`;
`idle_mirror_recipe.json` keeps only the historical blue -> red rule.

```bash
PY tools/wrestler_art/preview_idle_mirror_workflow.py   # -> output-idle-mirror.local/ (git-ignored)
```

- Input: the local 03A sources `wrestler_blue.png` / `wrestler_red.png` with the
  `dual_rigid_recipe.json` normalization (fails closed when missing).
- Transform: reflection across the local X axis, `(x, y) -> (x, H - y)` (image
  top-bottom flip). FRONT stays local +X, the wrestler's left and right swap,
  pivot / body-core points map the same way (`assemble_wrestler.mirror_part`).
- Mawashi mask: hue band + saturation / value floors from the recipe, limited to
  the largest 4-connected component (tinted outline pixels elsewhere are dropped).
- Recolor (mask only, alpha kept): hue -> recipe target hue, saturation x gain,
  value -> value x gain + offset (gain / offset map the source p10 / p90 value to
  the authored counterpart's). Pixels outside the mask are unchanged.
- Outputs: `idle_mirror_comparison.png` (authored blue / red, derived red / blue),
  `derived_*_rotations.png` (0 / 45 / 90 / 180 / 270), `idle_mirror_faceoff_arena.png`
  (authored pair, blue-master pair, red-master pair at start 4R / near contact /
  oblique / side), `diagnostics_*_master.png` (source, mirror only, mask, mirror +
  recolor, pivot / body core / +X), the derived sprites, `idle_mirror.json` and
  `build_idle_mirror_manifest.json` (no timestamp).

Tests: `test_preview_idle_mirror_workflow.py`.
