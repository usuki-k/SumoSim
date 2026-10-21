# wrestler_art — Deterministic Wrestler Parts Assembly Preview

Offline asset-production tool for SumoSim Product wrestler art (ART-WRESTLER-02A).

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
