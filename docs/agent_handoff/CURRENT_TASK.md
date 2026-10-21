Task-ID: ART-WRESTLER-03A-DUAL-SPRITE-RIGID-MOTION-VALIDATION
Status: READY
Task-Type: IMPLEMENTATION / OFFLINE PRODUCT ART VALIDATION / RIGID SPRITE MOTION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: a4ed20e05cd64e374692dc69a631063e4a80ed9a
Handoff-Mode: GITHUB

# ART-WRESTLER-03A — Dual Sprite 360° Rotation + Minimal Rigid Motion Validation

## Purpose

Validate the User's intended **minimal animation model** before creating more art.

The User's current hypothesis is:

- each wrestler can use one authored full-body image
- facing changes are represented by rotating the whole image
- movement / advance is represented by moving the whole image's position
- stagger / yoroke can be represented primarily by position displacement, optionally with a very small rigid whole-sprite rotation
- no limb animation, frame animation, skeletal animation, deformation, or sprite swapping is required unless this validation proves it necessary.

This Task exists to test that hypothesis visually.

Do NOT assume it is correct.
Do NOT assume it is wrong.
Generate review material that makes the tradeoff obvious.

The key User question is:

**If these two newly generated wrestler images are each used as rigid sprites, rotated through 360° and translated for minimal motion, does SumoSim still read as two wrestlers actually facing and fighting each other?**

---

## User Clarification — Important

The User explicitly rejected the previous visual result where one image was effectively mirrored / rotated and still did not read as two sumo wrestlers facing each other.

Do NOT use image mirroring in this Task.

The two current source images are separate authored images and must remain separate:

- blue-mawashi wrestler
- red-mawashi wrestler.

Allowed transforms:
- whole-sprite rotation
- whole-sprite translation
- optional tiny rigid whole-sprite rotation for stagger comparison
- uniform scale normalization.

Not allowed:
- horizontal flip
- vertical flip
- per-limb transform
- crop-and-reassemble
- skeletal deformation
- non-uniform warp
- perspective correction
- repaint
- generated in-between frames.

---

## Current Product Context

The earlier stages established:

- ART-WRESTLER-02A parts assembly:
  - technical tool PASS
  - User Visual Gate REJECTED
  - not Product baseline.

- ART-WRESTLER-02B one-piece single-sprite rotation:
  - validation tool PASS
  - source candidate REVISE IMAGE
  - one-piece strategy itself remained viable.

The User has now produced **two new authored wrestler images** intended to face one another more naturally.

This Task evaluates those two images before deciding whether additional direction-specific or action-specific art is necessary.

Do NOT start an 8-direction × pose production pipeline in this Task.

---

## Required Local Inputs

Before the Agent starts, the User places the exact reviewed images at:

```
tools/wrestler_art/input.local/
  wrestler_blue.png
  wrestler_red.png
```

### Reviewed blue source

Expected:
- filename: `wrestler_blue.png`
- size: **1254×1254**
- mode: RGBA / transparent
- original encoded file SHA-256:
  `ede9ffd2d3e010248b84c9a90a9942db48be4b1e547f73a2bb5347fe1781dbb4`
- canonical decoded RGBA pixel SHA-256:
  `0de729df419e8be1c63c812c55c2e6a7a5b07319614194a4b649a3dc9adf65dd`

### Reviewed red source

Expected:
- filename: `wrestler_red.png`
- size: **1254×1254**
- mode: RGBA / transparent
- original encoded file SHA-256:
  `98f9465a6306228e3c4e7757f73394b8baa5bb2f5f73a47be568edb5c9792fa9`
- canonical decoded RGBA pixel SHA-256:
  `a212dbfeab3da3ad4e42c352f1f7baea7f7b99fc901053bd05c4609df25dafe7`

As with prior art Tasks:
- encoded PNG SHA is provenance
- decoded RGBA pixel SHA is the blocking visual identity check.

Do not silently substitute another generation.

---

## Optional User Reference Video

The User also provided a real sumo reference video in the ChatGPT conversation.

Its purpose is conceptual only:
- wrestlers square up toward each other
- body/head/shoulder orientation should read as opponent-facing
- movement can be visually simple if the confrontation remains legible.

Do NOT make this video a required local input.
Do NOT attempt to replicate or trace it frame-for-frame.
Do NOT introduce video-processing dependencies.

The User Visual Gate remains the final authority on whether the preview reads as sumo.

---

## Accepted Arena / Gameplay Contract

Do Not Reopen:

- Product logical art space: 1920×1080
- arena center: (960, 540)
- arena ring radius: 400 px
- gameplay bodyRadius: 0.35 m
- accepted visual body-core scale target: ~123 px diameter
- gameplay facing remains continuous
- Simulation remains gameplay Source of Truth.

This Task is presentation-only.

Do NOT change:
- bodyRadius
- collision/contact
- movement
- Push / Counter / Grip / Drive
- Ring-out / Tokudawara
- fixed-step logic.

---

## Required Reading

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- reviewed previous `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `tools/wrestler_art/preview_single_wrestler.py`
- `tools/wrestler_art/README.md`
- `src/game/scenes/WrestlerView.ts`
- `src/game/presentation/wrestlerVisualState.ts`
- `src/game/presentation/productArena.ts`.

Do not modify `src/` in this Task.

---

## Core Validation Model

Treat each image as one rigid renderable object.

For each wrestler define explicit presentation metadata:

- source front axis
- optional small one-time whole-image axis correction
- explicit participant root / rotation pivot
- explicit body-core scale reference
- normalized runtime scale.

The blue and red images may require different source-specific recipe values.

Do not assume they are mirror images or identical anatomy.

---

# Scope

Create the smallest focused validation path under `tools/wrestler_art/`.

Recommended:

```
tools/wrestler_art/
  preview_dual_rigid_wrestlers.py
  dual_rigid_recipe.json
  tests/test_preview_dual_rigid_wrestlers.py
```

Reuse small deterministic helpers from the existing wrestler art tools when appropriate.

Do not create a generic animation framework.

---

# Required Preview Set

## A. Independent 360° rotation validation

For **blue** and **red** separately, generate 16-angle sheets:

```
0, 22.5, 45, 67.5,
90, 112.5, 135, 157.5,
180, 202.5, 225, 247.5,
270, 292.5, 315, 337.5
```

Outputs:

```
blue_runtime_16angles.png
red_runtime_16angles.png
```

Use:
- same sprite
- same pivot
- whole-sprite rotation only.

No flip.

Purpose:
- determine whether each authored pose survives free rotation
- expose camera-space bias
- expose head/torso/feet orientation issues
- expose pivot wobble.

---

## B. Face-to-face arena validation

Generate:

```
dual_faceoff_arena_1920.png
```

Use the accepted Product arena.

Place:
- blue on the left
- red on the right
- roots at the current prototype start spacing
- each facing the opponent using whole-sprite rotation only.

No mirroring.

The key visual question:

**Do they actually read as two sumo wrestlers facing one another?**

Also generate a contact sheet with representative encounter headings:

```
dual_faceoff_variants.png
```

Required cases:
1. normal start distance
2. closer pre-contact distance
3. near-contact / push distance
4. both rotated +30° around world facing while still looking toward each other
5. both rotated -30°
6. side-position case where the blue/red world positions are not purely horizontal.

For every case:
- each wrestler's facing must geometrically point toward the other root unless the case explicitly tests an offset
- no flip
- no per-limb adjustment.

---

# C. Minimal Rigid Motion Validation

This is the most important new part of the Task.

The User is NOT asking for authored frame animation yet.

The User wants to know whether minimal motion can be conveyed by rigid transforms.

Generate short deterministic animated review files.

Use GIF unless the existing verified environment already has a no-new-dependency path for another format.

Do NOT add ffmpeg or a video dependency.

## C1. Advance / charge

Output:

```
dual_advance.gif
```

Script:
- both wrestlers begin at a normal faceoff distance
- each moves toward the opponent along its current facing
- source sprite image does not change
- sprite facing may update only if required by path orientation
- no squash/stretch
- no limb animation.

Purpose:
- can forward motion read acceptably with translation only?

## C2. Stagger / yoroke — translation only

Output:

```
blue_stagger_translation_only.gif
red_stagger_translation_only.gif
```

Script:
- opponent-facing idle
- short backward displacement away from impact
- slight lateral drift allowed
- same source image, same facing
- NO sprite rotation in this version.

Purpose:
- directly test the User's hypothesis that yoroke may be readable from coordinate change only.

## C3. Stagger / yoroke — translation + tiny rigid rotation comparison

Output:

```
blue_stagger_translation_plus_rotation.gif
red_stagger_translation_plus_rotation.gif
```

Same path as C2, but allow a very small temporary rigid whole-sprite rotation.

Recommended maximum:
- ±3° to ±6°
- exact value must be explicit in the recipe / report.

Do NOT deform the body.

Purpose:
- compare whether tiny rigid rotation materially improves readability enough to justify it.

## C4. Contact / pushing without pose swap

Output:

```
dual_push_contact.gif
```

Script:
- approach
- touch/near-touch
- short forward/back root displacement representing pressure exchange
- no pose swap
- no limb animation.

This is NOT an attempt to implement gameplay Push.
It is a Product-art perception test only.

Key question:
**Can the same two sprites remain believable at close contact, or does contact immediately require a dedicated pose?**

---

# D. Static Motion Contact Sheet

Also output one easy-to-review static sheet:

```
rigid_motion_contact_sheet.png
```

Include labeled frames for:
- idle faceoff
- advance start
- advance mid
- near contact
- push displacement
- stagger start
- stagger peak
- recovery.

This ensures review is possible even if animated GIF display is inconvenient.

---

# Motion Rules

All preview motion must be deterministic.

No physics engine.
No gameplay formulas.

Use explicit preview-only paths defined in recipe/config.

Example categories only:
- advance distance in R
- stagger backward distance in R
- optional lateral offset in R
- optional small rigid rotation in degrees
- frame count / timing.

These values are Product-preview parameters only.

Do not claim they are accepted gameplay animation values.

---

# Scale / Root

Use an explicit root and body-core reference for each sprite.

Do NOT scale based on full alpha bbox.

Normalize both wrestlers so their central body masses are approximately comparable to the accepted:

```
2R ≈ 123.077 px runtime
```

If their authored body proportions differ, preserve those differences.

Do not force identical full silhouette dimensions.

---

# Required Guides

Generate:

```
blue_pivot_guide.png
red_pivot_guide.png
```

Show:
- root / rotation pivot
- +X FRONT
- -X BACK
- +Y RIGHT
- -Y LEFT
- gameplay body circle R
- source-specific body-core scale line.

This must make it possible to verify whether the selected pivot/facing axis is credible.

---

# Metadata / Determinism

Write under an ignored local output directory, recommended:

```
tools/wrestler_art/output-dual-rigid.local/
```

Metadata:

```
dual_rigid.json
build_dual_rigid_manifest.json
```

Include:
- source names
- file SHA / pixel SHA
- source dimensions
- orientation correction per sprite
- root per sprite
- body-core reference per sprite
- source->master/runtime scale per sprite
- runtime pivot
- runtime alpha bbox
- preview-only motion parameters
- output pixel hashes
- animated output hashes
- tool/Pillow version
- no timestamp.

---

# Visual Decision Matrix

The Agent does NOT decide final visual acceptance, but the Completion Report must organize evidence around these outcomes.

## Outcome A — rigid sprites are enough for current prototype

Likely if:
- 360° rotation is acceptable
- faceoff reads naturally
- advance reads naturally
- translation-only stagger is acceptable
- close contact is not badly broken.

Then later Product implementation can start from:
- rigid sprite rotation
- world translation
- minimal presentation offsets.

This still does NOT mean every future action can use one pose.

## Outcome B — hybrid minimal-pose strategy

Likely if:
- idle/movement/stagger work with rigid transforms
- but push/contact/grapple do not.

Then likely direction:
- idle/movement/stagger: same rigid sprite
- only selected contact/action states get dedicated authored pose image(s).

This is the main alternative to an 8-direction × many-animation explosion.

Do NOT estimate or lock final image counts in this Task.

## Outcome C — rigid 360° fails structurally

If:
- camera/perspective rotates badly
- faceoff repeatedly fails
- rotation does not read as opponent-facing.

Then another asset strategy is required.

Do not automatically choose 8-direction art.
Report the failure first.

---

# User Visual Gate — REQUIRED

Technical PASS != visual acceptance.

The User must inspect:

1. `blue_runtime_16angles.png`
2. `red_runtime_16angles.png`
3. `dual_faceoff_arena_1920.png`
4. `dual_faceoff_variants.png`
5. `rigid_motion_contact_sheet.png`
6. `dual_advance.gif`
7. both translation-only stagger GIFs
8. both translation+rotation stagger GIFs
9. `dual_push_contact.gif`
10. both pivot guides.

Questions:

- Do the two wrestlers genuinely look at / square toward each other?
- Is there an obvious authored-camera direction rotating with either sprite?
- Is one sprite significantly more rotation-safe than the other?
- Does pure translation create acceptable forward motion?
- Does pure translation create acceptable stagger?
- Does tiny rigid rotation improve stagger, or just look like the sprite is spinning?
- At near-contact, do they still read as sumo wrestlers pushing each other?
- Which state first becomes visually unacceptable?
- If dedicated art is required, is it only close-contact/action art rather than all movement?

The User makes the final Outcome A/B/C decision.

---

# Verification

Verification Level:
**Standard + User Visual Gate**

Required focused checks:

1. missing blue source fails closed
2. missing red source fails closed
3. wrong dimensions fail
4. wrong decoded pixel SHA fails
5. alpha validation fails correctly
6. same-pixel re-encode accepted
7. each sprite has explicit valid root
8. each body-core scale reference is non-zero
9. normalized body core is ~123.077 runtime px
10. no sprite preview clipping
11. all 16 rotation angles produced for both images
12. pivot remains stable through rotation
13. no mirroring operation is used anywhere in the dual-rigid path
14. faceoff roots/facing vectors actually point toward opponent
15. faceoff arena output = 1920×1080
16. required faceoff variants generated
17. required GIFs generated
18. GIF frames use only rigid rotation/translation/uniform-scale normalized source
19. translation-only stagger contains no per-frame rotation
20. translation+rotation stagger respects configured small max angle
21. static motion contact sheet generated
22. manifests contain no timestamp/randomness
23. deterministic rerun produces identical hashes
24. local inputs/outputs remain ignored/untracked
25. `git diff --check` PASS.

Run:
- focused Python tests
- actual reviewed-source build
- deterministic rerun
- `git diff --check`.

No `pnpm test` / `pnpm build` required because `src/` must remain untouched.

---

# SPEC Sync

Update `docs/WRESTLER_PRODUCT_ART_SPEC.md` minimally.

Record only:
- 02B current single source was rejected by User Visual Gate
- new experiment uses two separately authored opponent-facing sprites
- no mirroring
- rigid rotation + translation is being tested as the minimum animation model
- whether dedicated action/contact poses are required remains unresolved.

Do NOT record rigid-transform animation as accepted until User review.

Do NOT lock:
- 8-direction sprites
- final animation count
- pose count
- final rendering architecture.

---

# Scope Out

Do NOT:

- modify `src/`
- integrate into Phaser
- change gameplay
- add animation framework
- add tween library
- add ffmpeg dependency
- generate new artwork
- mirror images
- create 8-direction authored art
- create Push/Grip/Grapple production assets
- determine final sprite counts
- delete earlier wrestler-art tools.

---

# Completion Report

Include:

- Result
- Preflight
- verified source identities
- explicit axis/root/body-core metadata for blue and red
- exact normalization
- no-mirror evidence
- 16-angle evidence
- faceoff geometry evidence
- motion recipe values
- translation-only stagger evidence
- translation+rotation stagger comparison
- close-contact/push perception evidence
- output paths/hashes
- determinism
- tests
- SPEC sync
- User Visual Check Required
- Agent visual observations, clearly non-authoritative
- Design Deviations
- Unexpected Scope
- Git delivery.

The Completion Report may categorize technical evidence as:
- rigid rotation technically valid
- rigid translation technically valid
- visual acceptance pending.

Do NOT label the art visually accepted.

---

# Design Deviations

Required.

If none:

`Design Deviations: NONE`

Material deviations requiring STOP:
- using different source images
- mirroring either source
- repainting/warping/per-limb transforms
- modifying gameplay/runtime source
- adding unapproved production pose assets
- converting this into an 8-direction production Task.

---

# Stop Conditions

STOP/BLOCKED if:

- reviewed source image missing
- source pixel identity mismatches
- no coherent facing axis/root can be assigned to either source
- a preview requires mirroring to make the wrestlers face each other
- rigid motion preview cannot be generated without per-limb edits
- required deterministic GIF output is impossible with current verified Pillow setup without a new dependency.

If GIF export itself is the only blocker, STOP and report; do not add a dependency without approval.

---

# Git Delivery

Follow `AGENTS.md`.

Expected committed changes only:

- focused dual-rigid validation tool/config/tests under `tools/wrestler_art/`
- minimal `docs/WRESTLER_PRODUCT_ART_SPEC.md` sync
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do NOT commit:
- source wrestler PNGs
- generated preview PNG/GIF/JSON outputs
- venv/cache
- Product runtime assets.

Suggested commit:

`tools: validate dual rigid wrestler sprites`

Push `origin/develop`.
Do not modify `main`.

# Final Instruction

Stop after generating the dual-sprite rotation / faceoff / minimal-rigid-motion review set.

Do NOT begin Phaser integration or new pose production.

After commit/push/report:

「ART-WRESTLER-03A-DUAL-SPRITE-RIGID-MOTION-VALIDATION が完了し、ChatGPT ReviewとUser Visual Approval待ちです」
