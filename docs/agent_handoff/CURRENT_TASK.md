Task-ID: ART-WRESTLER-02A-PARTS-ASSEMBLY-PREVIEW
Status: READY
Task-Type: IMPLEMENTATION / OFFLINE PRODUCT ART TOOL / WRESTLER PARTS PREVIEW
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 1f89765e94490dd22aeec0cfbc812d9d5247d4d7
Handoff-Mode: GITHUB

# ART-WRESTLER-02A — Wrestler Parts Extraction + Assembly Preview

## Purpose

Build the smallest deterministic offline wrestler-art tool needed to answer one question:

**Can the currently generated Product parts be cropped, given explicit pivots, and assembled into one coherent strict top-down right-facing wrestler at the accepted runtime scale?**

This Task does NOT integrate the wrestler into Phaser yet.

It does NOT create final runtime assets.

It creates deterministic local extraction/assembly previews so the User can approve:
- body orientation
- part compatibility
- torso/head/mawashi proportions
- shoulder/elbow/foot placement
- current art style at gameplay scale.

## Workflow Change — Accepted

The original Product wrestler spec recommended:

canonical full wrestler -> approved reference -> parts sheet -> deterministic extraction.

During actual ChatGPT image generation, repeated full-body / assembly-guide generations produced a material anatomical failure:

- upper body and lower body were interpreted with opposite body axes / approximately 180-degree disagreement.

The User therefore accepted a safer production workflow:

**AI draws isolated parts; deterministic tooling owns the human assembly.**

Current direction:

```
isolated Product parts
        ->
explicit regions / pivots / joints
        ->
deterministic Python assembly preview
        ->
User Visual Approval
        ->
later pose/variation preview
        ->
Phaser integration
```

Do NOT ask image generation to solve the whole-body anatomy again in this Task.

Update `docs/WRESTLER_PRODUCT_ART_SPEC.md` minimally so this workflow supersedes the canonical-full-body-first staging.

## User-approved / Candidate Source Art

Two local source images are required.

The User generated and reviewed:

### A. Parts sheet candidate

Contains usable candidate art for:
- head
- mawashi
- upper arm
- forearm + hand
- foot.

The torso contained in this original sheet is REJECTED and must NOT be used.

Expected source:
- filename: `parts_sheet.png`
- size: **1254×1254**
- mode: RGBA / transparent
- SHA-256:
  `3363eb77aeafb3a9ee298e23256218716e675eb7de63acf304d23357f27a44aa`

### B. Replacement torso candidate

The User generated a separate simpler rounded / anime-game torso and approved it as suitable to proceed to assembly testing.

It is a CANDIDATE for assembly preview, not yet final Product acceptance.

Expected source:
- filename: `torso.png`
- size: **1374×1145**
- mode: RGBA / transparent
- SHA-256:
  `8388ef8bb7ce44278426472aaf2af8eb751f82f2a8246e6ae86a03b92a71f734`

## Required Local Inputs

Before the Agent starts, the User must place the exact reviewed images at:

```
tools/wrestler_art/input.local/
  parts_sheet.png
  torso.png
```

The repository root already ignores `*.local`.

Do NOT commit these source images.

### Input validation

The tool must fail closed if:
- either input is missing
- dimensions do not match the expected reviewed source
- alpha channel is missing
- source SHA-256 does not match the reviewed input.

Do not silently proceed with another image.

## Accepted Character Coordinate Contract

Preserve the reviewed Product wrestler contract:

- root = participant center
- local +X = FRONT / facing
- local -X = BACK
- local +Y = wrestler's RIGHT
- local -Y = wrestler's LEFT.

For all extracted source parts:

- head face/front points +X
- upper arm axis: shoulder -> elbow = +X
- forearm axis: elbow -> hand = +X
- foot axis: ankle/heel -> toes = +X
- mawashi rear knot is on -X / back side
- torso should be treated as one rounded body mass whose front is +X.

The Python preview must own the assembly geometry.
Do not infer a contradictory body axis from the source image composition.

## Current Accepted Gameplay / Presentation Scale

Do Not Reopen:

- gameplay bodyRadius = 0.35 m
- current meter-to-pixel mapping
- current accepted visible wrestler scale ≈123 px body diameter.

This tool is presentation-only.

Do NOT modify:
- bodyRadius
- contact
- Grip range
- Push / Counter / Drive
- Ring-out / Tokudawara.

## Required Reading / Source Inspection

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `docs/ARCHITECTURE.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `src/game/scenes/WrestlerView.ts`
- `src/game/presentation/wrestlerVisualState.ts`
- `src/game/presentation/productArena.ts`
- existing `tools/dohyo_art/` for workflow style only.

Do not import dohyo-specific implementation into the wrestler tool.

## Tool Directory

Create a small dedicated offline tool:

```
tools/wrestler_art/
  README.md
  requirements.txt
  assemble_wrestler.py
  tests/
    test_assemble_wrestler.py
  input.local/       # ignored / local
  output.local/      # ignored / local
```

A separate small recipe/config file may be checked in if useful, e.g.:

```
base_parts_recipe.json
```

It must describe only this accepted source layout / pivots / joints.

Do NOT create a generic asset-processing framework.

## Toolchain

Prefer the already-verified project-local offline art stack unless Current Environment gives a material reason otherwise:

- Python 3.9+
- Pillow
- NumPy only if genuinely needed.

Use a tool-local virtual environment and pinned requirements.

Do not add Node/package dependencies.

## Extraction Strategy

Do NOT use OCR.

Do NOT use AI segmentation.

Use deterministic explicit geometry.

For `parts_sheet.png`:

1. inspect the actual alpha/source layout
2. define explicit crop regions for:
   - head
   - mawashi
   - upper_arm
   - forearm_hand
   - foot
3. deliberately ignore/reject the original sheet torso region.

For `torso.png`:
- alpha-trim the standalone torso candidate
- add deterministic transparent padding.

### Region ownership

Preferred:
- a small checked-in recipe contains explicit source boxes / anchors
- recipe is tied to the expected source SHA-256.

Do not rely on “largest connected component = torso” style heuristics if a direct explicit region is clearer.

## Part Orientation / Mirroring

Use one source arm and one source foot for both sides.

Runtime/preview convention:
- right-side part = source orientation
- left-side part = deterministic mirror across local X axis / image vertical flip equivalent required by the +Y/-Y character convention.

Document the exact transform.

Do not generate independent left/right art.

## Pivot / Joint Recipe

The tool must use explicit pivot/joint metadata.

At minimum define for the assembly preview:

### Torso
- root/body center
- shoulder attachment points:
  - left shoulder at local (x, -y)
  - right shoulder at local (x, +y)
- head center/overlap point
- mawashi center.

### Upper arm
- shoulder pivot
- elbow joint point / effective source length.

### Forearm + hand
- elbow pivot
- hand/end joint / effective source length.

### Foot
- center or ankle/attachment pivot.

### Head
- center/pivot.

### Mawashi
- center/pivot matching torso.

Do NOT infer pivots from crop center alone.

The first numeric recipe is Provisional and must be reported for User tuning.

## Source Normalization

The source images are not guaranteed to have the correct relative scale.

Normalize them deterministically into one common character master scale.

Use the accepted wrestler Product scale as the target.

Recommended approach:

- define `R_master` as a tool constant / recipe value
- normalize torso to an explicit shoulder/body-width target
- normalize the other parts relative to torso using explicit recipe scale factors.

Do not pretend AI source pixel dimensions encode true anatomy.

### Master / runtime

Start with the accepted spec direction:
- master working scale ≈4× runtime
- deterministic downscale for runtime preview.

The exact master R may be chosen by the Agent if it cleanly supports the reviewed input sizes.

Report it.

Do NOT commit final runtime wrestler assets yet.

## Idle Assembly Preview

Build one deterministic neutral idle wrestler.

The preview must use the reviewed body-axis contract:

- FRONT = right
- BACK = left
- head toward front side
- mawashi rear knot on back side
- both shoulders perpendicular to the body axis
- both arms belong to the same right-facing torso
- both feet belong to the same body axis
- no upper/lower body inversion.

### Starting pose

Use current `WrestlerView` IDLE semantics only as a presentation reference:

- slight arm opening
- elbows comfortably bent
- stable foot stance
- neutral torso
- no action pose.

The preview does NOT need to reproduce every current PoseParams value yet.

Do not encode gameplay logic.

## Arm Assembly

Use the accepted two-part arm direction.

For 02A, implement enough articulation to produce a coherent idle pose:

- upper arm rotation around shoulder
- forearm rotation around elbow
- no painted-limb stretch.

A simple explicit idle elbow angle is acceptable for this Task.

Do NOT implement the complete reach IK solver unless it is genuinely simpler than a fixed idle assembly.

Full Push/Grip/Grapple pose preview belongs to the next focused step after idle assembly is visually approved.

## Layering

For the single-wrestler idle preview, use the spec baseline:

1. feet
2. torso
3. mawashi
4. upper arms
5. forearms/hands
6. head.

Shadow may be:
- omitted from the transparent character preview
- or generated procedurally as a separate preview layer.

Do not let shadow work block assembly validation.

## Required Outputs — Local Only

Write under an ignored directory, recommended:

```
tools/wrestler_art/output-assembly.local/
```

Required:

### Extracted / normalized parts
- `torso_master.png`
- `mawashi_master.png`
- `upper_arm_master.png`
- `forearm_hand_master.png`
- `head_master.png`
- `foot_master.png`

### Metadata
- `parts.json`
  - crop source
  - normalized size
  - pivot
  - relevant joints/length
  - master R
- `build_manifest.json`
  - source filenames
  - source SHA-256
  - tool/version schema
  - recipe values
  - output decoded-pixel hashes
  - NO timestamp.

### Previews
- `idle_master.png`
  - transparent background
  - right-facing assembled wrestler
- `idle_runtime.png`
  - downscaled to the accepted approximate gameplay scale
- `idle_runtime_4angles.png`
  - 0° / 45° / 90° / 180° rotations of the same correctly assembled character
- `idle_on_arena_1920.png`
  - current accepted Product arena
  - wrestler composited around the normal starting/center test area at actual runtime scale
- `pivot_guide.png`
  - developer-only enlarged assembly with root, shoulders, elbows, head pivot, foot pivots marked.

Do not commit these outputs.

## Runtime-scale Definition

The User needs to judge the actual gameplay-size appearance.

`idle_runtime.png` / arena composite must preserve the currently accepted scale approximately equivalent to the existing procedural wrestler:

- body diameter / primary torso silhouette around the current ~123 px baseline.

Do not use the huge source art at arbitrary display scale.

The Completion Report must state exactly how source/master pixels map to runtime pixels.

## Arena Composite

Use the already committed Product arena runtime asset(s) as the preview background.

Do NOT regenerate or modify the arena.

The purpose is only:
- judge art style compatibility
- judge wrestler size
- judge silhouette readability.

Do not alter HUD.

## Determinism

Same:
- reviewed source images
- checked-in recipe
- tool version/dependencies

must produce identical decoded output pixels / manifest.

No timestamps/randomness.

## Focused Tests

Verification Level:
**Standard + User Visual Gate**

Required tests at minimum:

1. missing source fails
2. wrong parts-sheet SHA fails
3. wrong torso SHA fails
4. wrong dimensions fail
5. missing alpha fails
6. each required crop is non-empty
7. rejected original torso crop is never used
8. normalized outputs have alpha
9. explicit pivots are inside or valid relative to padded images
10. upper-arm shoulder/elbow length > 0
11. forearm elbow/hand length > 0
12. mirrored left part is deterministic
13. output names all produced
14. runtime preview maps to accepted character scale
15. four-angle preview is generated
16. manifest has no timestamp
17. deterministic rerun produces identical pixel hashes
18. local outputs/source images remain ignored/untracked.

Run:
- tool-local Python tests
- `git diff --check`.

`pnpm test` / build are NOT required because Product Source must not change.

## User Visual Gate — REQUIRED

After technical completion, User must inspect:

1. `idle_master.png`
2. `idle_runtime.png`
3. `idle_runtime_4angles.png`
4. `idle_on_arena_1920.png`
5. `pivot_guide.png`.

Questions:

- Does the wrestler finally have one coherent body axis?
- Is FRONT clearly right?
- Does the head belong to the torso?
- Do shoulders/arms look attached rather than pasted on?
- Are elbows believable?
- Does the mawashi placement read correctly?
- Do feet belong to the same facing direction?
- At runtime scale, does it look like the intended anime/game art?
- Is the torso too large/small relative to head/arms/feet?
- Does it match the Product arena quality/style closely enough to continue?

Technical PASS != visual acceptance.

## Scope Out

Do NOT:

- change `src/`
- integrate assets into Phaser
- commit Product wrestler PNGs
- implement Push/Grip/Grapple pose previews
- implement full arm IK/reach solver unless absolutely necessary for idle
- implement bulk/stature appearance factors
- implement weight/height conversion
- change gameplay
- generate new AI images
- redesign HUD/arena
- add portraits
- create full localization work.

If the current source art is visually incompatible even after deterministic assembly, STOP at User Visual Gate; do not “fix” source art procedurally beyond crop/scale/placement.

## Documentation Sync

Update `docs/WRESTLER_PRODUCT_ART_SPEC.md` minimally:

- record that full-body/canonical AI generation was abandoned after repeated body-axis inversion
- record parts-first deterministic assembly as the current production workflow
- mark current parts sheet + replacement torso as candidate inputs pending assembly preview
- preserve all gameplay/appearance-factor decisions.

Do not rewrite the spec broadly.

Update `docs/ARCHITECTURE.md` only if a small note is needed.

## Completion Report

Include:

- Result
- Preflight
- verified source hashes/dimensions
- exact extracted regions
- exact source part chosen for each runtime concept
- rejected original torso evidence
- normalization/master scale
- pivot/joint recipe
- idle assembly geometry
- mirroring convention
- output paths
- pixel hashes
- determinism evidence
- runtime scale evidence
- arena composite evidence
- tests
- User Visual Check Required
- Design Deviations
- Unexpected Scope
- Git delivery.

## Design Deviations

Required.

If none:
`Design Deviations: NONE`

Material deviations requiring STOP:
- using a different input image
- using the rejected torso from the original sheet
- changing the accepted body axis
- changing gameplay geometry
- committing source/output images
- replacing explicit pivot geometry with opaque AI/heuristic assembly.

## Stop Conditions

STOP/BLOCKED if:

- required local inputs are missing
- hashes/dimensions do not match
- the candidate parts cannot be isolated cleanly
- the replacement torso cannot be assigned a coherent FRONT/BACK axis
- a coherent idle wrestler cannot be assembled without materially repainting/generated edits
- current source art style is too inconsistent across torso vs other parts to judge Product viability.

Do not silently substitute other images.

## Git Delivery

Follow `AGENTS.md`.

Expected committed files:

- `tools/wrestler_art/README.md`
- `tools/wrestler_art/requirements.txt`
- `tools/wrestler_art/assemble_wrestler.py`
- `tools/wrestler_art/tests/test_assemble_wrestler.py`
- optional explicit recipe/config
- `tools/wrestler_art/.gitignore` if needed
- minimal `docs/WRESTLER_PRODUCT_ART_SPEC.md` sync
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do NOT commit:
- `input.local/**`
- `output*.local/**`
- source PNGs
- preview PNGs.

Suggested commit:

`tools: add wrestler assembly preview`

Push `origin/develop`.
Do not modify `main`.

## Final Instruction

Stop after deterministic idle extraction/assembly previews and verification.

Do NOT begin Phaser integration.

After commit/push/report:

「ART-WRESTLER-02A-PARTS-ASSEMBLY-PREVIEW が完了し、ChatGPT ReviewとUser Visual Approval待ちです」
