Task-ID: ART-WRESTLER-02B-SINGLE-SPRITE-EVALUATION
Status: READY
Task-Type: IMPLEMENTATION / OFFLINE PRODUCT ART PREVIEW / SINGLE-SPRITE VALIDATION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 9a3569ff376c4397daf1297083272af599300189
Handoff-Mode: GITHUB

# ART-WRESTLER-02B — Single Full-Body Wrestler Sprite Evaluation

## Purpose

Evaluate the newly generated **single full-body wrestler sprite** as the current Product-art candidate.

The previous parts-based assembly experiment is no longer the current visual direction.

This Task must answer only:

**Can this one-piece wrestler image be normalized to the accepted runtime body scale, rotated through the full top-down facing range, and placed on the Product arena without unacceptable camera/perspective/scale artifacts?**

Do NOT integrate it into Phaser yet.

Do NOT design the final action-pose system yet.

This is a focused visual-validation Task before any runtime commitment.

---

## User Decision / Previous Visual Gate

ART-WRESTLER-02A was a TECHNICAL PASS but the User visually rejected the assembled result.

User result:
- the deterministic parts assembly was visually far from the intended wrestler
- the body/limbs/mawashi did not read as one coherent authored character
- do not continue tuning that assembled result as the Product baseline.

Therefore:

### Current direction

Use a **single authored full-body sprite** for the current Product candidate.

The parts tool may remain in the repository as an experiment/reference, but:
- do not treat its assembled output as accepted Product art
- do not continue pivot/mawashi/forearm tuning in this Task
- do not delete it unless a later explicit cleanup Task requests removal.

This is a deliberate workflow correction based on User Visual Gate, not a technical rollback.

---

## Current Candidate Image

The User generated and reviewed a substantially improved one-piece wrestler.

Visual status:
- anime/game style: promising
- coherent upper/lower body direction: yes
- much closer to the desired Product wrestler than the assembled parts result
- top-down angle: usable candidate, but still slightly perspective-biased
- final Product acceptance: NOT YET.

The critical remaining risk is:

**Does the slight perspective still look acceptable when the entire sprite rotates continuously through 360° in the top-down game?**

### Required local input

The User must place the exact reviewed image at:

```
tools/wrestler_art/input.local/wrestler_single.png
```

Expected reviewed source:

- size: **1254×1254**
- mode: RGBA / transparent
- original encoded file SHA-256:
  `d806a24fdb4cd8fa90d53e86fbffabd3ae7c490b6c3221fa2000deb94472666d`
- canonical decoded RGBA pixel SHA-256:
  `b621d2f56efa80968b71dba1cc4e31bfcc3ad133968adcebb33864b89de5fdf3`

As in 02A:
- encoded file SHA is provenance only
- decoded RGBA pixel SHA is the blocking visual identity check.

Do not silently substitute another generation.

---

## Accepted Character / Arena Contract

Do Not Reopen:

- logical Product presentation: 1920×1080
- Product arena ring center: (960, 540)
- Product arena radius: 400 px
- gameplay bodyRadius: 0.35 m
- accepted wrestler body-scale baseline: approximately 123 px diameter
- root = participant center
- local +X = FRONT / facing
- local -X = BACK
- local +Y = wrestler RIGHT
- local -Y = wrestler LEFT
- facing remains continuous; do not quantize gameplay facing.

This Task is presentation-only.

Do NOT change:
- gameplay bodyRadius
- contact geometry
- movement
- Grip range
- Push / Counter / Drive
- Ring-out / Tokudawara.

---

## Candidate Orientation Contract

For the reviewed candidate:

- face/front = image right / +X
- mawashi rear knot = image left / -X
- the entire body is one authored sprite
- no independent limb transforms in this Task.

If the source requires a small whole-image rotation to put the intended back→front axis exactly on +X:
- allow only one explicit deterministic whole-sprite rotation
- record the angle in a checked-in recipe/config
- do not warp, shear, perspective-correct, repaint, or independently move body parts.

If a coherent +X axis cannot be assigned to the source, STOP.

---

## Required Reading / Inspection

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- reviewed `CURRENT_TASK.md`
- `CURRENT_COMPLETION_REPORT.md`
- `tools/wrestler_art/README.md`
- `tools/wrestler_art/assemble_wrestler.py` only to reuse small deterministic image-processing helpers if appropriate
- `src/game/scenes/WrestlerView.ts`
- `src/game/presentation/wrestlerVisualState.ts`
- `src/game/presentation/productArena.ts`.

Do not change `src/` in this Task.

---

## Scope

Create the smallest deterministic single-sprite preview path under the existing tool directory.

Recommended additions:

```
tools/wrestler_art/
  preview_single_wrestler.py
  single_sprite_recipe.json
```

Extend existing tests or add a focused test file.

Do not turn `wrestler_art` into a general art framework.

### The tool owns only

- input identity validation
- transparent crop/padding
- one optional whole-sprite orientation correction
- one explicit presentation pivot/root
- deterministic scale normalization
- deterministic runtime downscale
- rotation preview generation
- Product arena preview generation
- manifest / review metadata.

It does NOT own gameplay.

---

## Explicit Body Scale Reference

Do NOT scale the full alpha bounding box to 123 px.

The full silhouette contains arms, legs, and mawashi and is much larger than the gameplay body diameter.

Instead define an explicit, reviewed-source-specific **body-core cross-section** in `single_sprite_recipe.json`.

Preferred definition:

- two explicit source points across the central torso/body mass
- perpendicular to the +X facing axis
- excludes arms, hands, feet, head, and mawashi knot.

Normalize that source distance to:

```
2R = approximately 123.0769 runtime px
```

where:

```
R_runtime = 0.35 * 400 / 2.275
```

The chosen source points are Provisional presentation metadata.

Report the exact points and source distance.

Do not use alpha-bbox heuristics as the Product scale source of truth.

---

## Pivot / Root

A one-piece sprite still needs one explicit runtime pivot.

Define an explicit `root_source_px` in the recipe representing the participant/body center.

Requirements:
- do not use the image center automatically unless inspection supports it
- preserve the accepted participant-center semantics
- keep the root stable for all rotations
- export the normalized/runtime pivot in metadata.

Generate a guide preview showing:
- root
- +X FRONT / -X BACK
- +Y RIGHT / -Y LEFT
- accepted gameplay body circle R
- body-core scale reference line.

---

## Master / Runtime

Keep the accepted art-production direction:

- deterministic master working image
- runtime preview at logical 1×
- no runtime asset commit yet.

Recommended:
- retain source detail at master size after crop/pad
- normalize/downscale deterministically with premultiplied alpha-safe resampling
- runtime scale derived from the explicit body-core reference.

Do not upscale low-information runtime pixels unnecessarily.

Report:
- source body-core px
- scale factor
- runtime body-core px
- full runtime alpha bbox.

---

## Required Local Outputs

Write only to ignored local output, recommended:

```
tools/wrestler_art/output-single.local/
```

Required:

### 1. Normalized sprite
- `single_master.png`
- `single_runtime.png`

Transparent background.

### 2. Orientation / pivot guide
- `single_pivot_guide.png`

Show:
- root
- body circle
- front/back axis
- right/left axis
- body-core scale line.

### 3. 16-angle rotation sheet
- `single_runtime_16angles.png`

Angles:

```
0, 22.5, 45, 67.5,
90, 112.5, 135, 157.5,
180, 202.5, 225, 247.5,
270, 292.5, 315, 337.5
```

Use the same normalized sprite and same root for every angle.

Purpose:
- expose perspective that appears to rotate with the body
- expose asymmetric foreshortening
- expose clipping / pivot wobble
- expose silhouette problems.

This is a preview of continuous rotation, not gameplay facing quantization.

### 4. Product arena preview
- `single_on_arena_1920.png`

Use the already committed Product arena assets, read-only.

Place two wrestlers at the current prototype start positions:
- x = center ± 0.7 m mapped with the accepted Product px/m
- y = arena center
- facing each other at 0° / 180°.

Keep the current approximate runtime scale.

No HUD required.

### 5. Arena rotation contact sheet
- `single_on_arena_8facings.png`

Show one wrestler on a consistent cropped section of the Product arena at:

```
0, 45, 90, 135, 180, 225, 270, 315
```

This exists specifically to judge whether the camera/perspective rotates unnaturally against the world.

### 6. Metadata
- `single_sprite.json`
- `build_single_manifest.json`

Include:
- source filename
- source file SHA
- decoded pixel SHA
- source dimensions
- orientation correction angle
- root source px
- body-core reference points
- source body-core distance
- normalized/runtime scale
- runtime pivot
- runtime alpha bbox
- output decoded pixel hashes
- Pillow/tool version
- no timestamps.

Do not commit generated PNG/JSON outputs.

---

## Shadow

The source candidate should remain visually reviewable without hiding its silhouette.

For transparent sprite previews:
- no external shadow.

For arena previews:
- a subtle procedural world-grounding shadow is allowed
- use the same accepted/current presentation direction as prior preview
- shadow must not rotate a strongly directional shape with the sprite.

Do not bake a new directional shadow into the candidate image.

---

## Visual Quality Constraints

Do NOT procedurally alter the candidate to make it pass.

Allowed:
- crop transparent margin
- add transparent padding
- whole-sprite rotation
- uniform scale
- deterministic resampling.

Not allowed:
- perspective correction
- non-uniform warp
- liquify
- repaint
- body-part movement
- limb extraction/reassembly
- recoloring skin
- changing mawashi shape
- generating missing anatomy.

If the source camera bias is unacceptable at rotated angles, that is a **User Visual FAIL of this candidate**, not something the tool should hide.

---

## SPEC Correction

Update `docs/WRESTLER_PRODUCT_ART_SPEC.md` minimally.

Record:

1. ART-WRESTLER-02A parts assembly:
   - technical tool PASS
   - User Visual Gate REJECTED
   - assembled output is NOT Product baseline.

2. Current production experiment:
   - return to one authored full-body sprite candidate
   - validate full 360° rotation before runtime integration.

3. The current one-piece candidate is:
   - promising
   - NOT final accepted until this Task's User Visual Gate.

4. Do not claim the final action-pose strategy is decided.
   - whether Product uses multiple full-body pose sprites, animation frames, limited deformation, or another one-piece method remains unresolved after idle validation.

Do not broadly rewrite the old spec.

---

## Verification

Verification Level:
**Standard + User Visual Gate**

Required automated/focused checks:

1. missing source fails closed
2. wrong dimensions fail
3. wrong decoded pixel SHA fails
4. missing/meaningless alpha fails
5. same-pixel PNG re-encode is accepted
6. explicit root exists and maps inside padded normalized image
7. explicit body-core reference is non-zero
8. runtime body-core scale matches accepted ~123.08 px within a small deterministic tolerance
9. output alpha does not touch the sprite preview edges
10. runtime pivot stays identical across all 16 rotations
11. all 16 angles generated
12. no rotation tile is clipped
13. arena preview = 1920×1080
14. two prototype start roots map correctly
15. 8-facing arena sheet generated
16. manifest has no timestamp/randomness
17. deterministic rerun produces identical manifest and decoded pixel hashes
18. local input/output remain ignored/untracked.

Run:
- focused Python tests
- actual reviewed candidate build
- deterministic rerun comparison
- `git diff --check`.

No `pnpm test` / `pnpm build` required because `src/` is untouched.

---

## User Visual Gate — REQUIRED

Technical PASS is not Product acceptance.

The User must inspect at minimum:

1. `single_runtime.png`
2. `single_runtime_16angles.png`
3. `single_on_arena_1920.png`
4. `single_on_arena_8facings.png`
5. `single_pivot_guide.png`.

Visual questions:

- Does the wrestler still read as a true top-down sprite at every rotation?
- Does the apparent camera direction rotate with the wrestler?
- Do 90° / 180° / 270° look materially stranger than 0°?
- Does the pivot feel stable or does the body orbit/wobble?
- Does the sprite feel too large/small relative to the accepted arena baseline?
- Does the full body silhouette read clearly at runtime size?
- Does it visually belong in the accepted Product arena?
- Is the remaining face/chest visibility acceptable when freely rotated?

### Acceptance outcomes

A. **ACCEPT**
- candidate is suitable as the current one-piece Product idle baseline
- next Task may investigate action-pose strategy / additional one-piece poses.

B. **REVISE IMAGE**
- source camera/perspective/art needs another image-generation iteration
- do not integrate into Phaser.

C. **REJECT ONE-PIECE**
- only if the actual rotation test demonstrates a structural problem that cannot be solved with a better one-piece source image.

Do not let the Agent decide A/B/C alone.

---

## Scope Out

Do NOT:

- change `src/`
- integrate into Phaser
- commit the wrestler image into `public/`
- delete the old parts tool
- continue 02A parts tuning
- implement Push/Grip/Grapple image variants
- implement animations
- implement sprite-sheet/atlas packing
- implement mawashi color variants
- implement bulk/stature variants
- change gameplay
- change arena/HUD
- generate new AI art.

---

## Completion Report

Include:

- Result
- Preflight
- verified source identity
- explicit source body axis
- any whole-image orientation correction
- root source px
- body-core reference points / source distance
- normalization scale
- runtime body-core size
- runtime full alpha bbox
- output paths
- output pixel hashes
- 16-angle evidence
- arena-root mapping evidence
- determinism evidence
- tests
- SPEC sync
- User Visual Check Required
- Design Deviations
- Unexpected Scope
- Git delivery.

## Design Deviations

Required.

If none:
`Design Deviations: NONE`

Material deviations requiring STOP:
- different source image
- source repaint/warp
- changing accepted gameplay scale
- changing gameplay/source
- committing runtime wrestler assets
- returning to parts assembly instead of the one-piece candidate evaluation.

---

## Stop Conditions

STOP/BLOCKED if:

- required reviewed local input is missing
- decoded pixel hash/dimensions do not match
- source has no meaningful alpha
- no coherent +X front axis can be assigned
- no reasonable explicit participant root can be assigned without moving body parts
- body-core scale cannot be defined without ambiguous heuristic inference
- generating the required previews would require perspective warp/repaint.

---

## Git Delivery

Follow `AGENTS.md`.

Expected committed changes are limited to:

- focused single-sprite preview tool/config/tests under `tools/wrestler_art/`
- minimal `docs/WRESTLER_PRODUCT_ART_SPEC.md` correction
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not commit:
- `wrestler_single.png`
- local output PNG/JSON files
- venv/cache
- runtime Product wrestler assets.

Suggested commit:

`tools: add single wrestler sprite preview`

Push `origin/develop`.
Do not modify `main`.

## Final Instruction

Stop after generating and verifying the one-piece idle rotation / arena previews.

Do NOT begin Phaser integration or action-pose production.

After commit/push/report:

「ART-WRESTLER-02B-SINGLE-SPRITE-EVALUATION が完了し、ChatGPT ReviewとUser Visual Approval待ちです」
