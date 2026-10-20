Task-ID: ACTION-ART-03-WRESTLER-PRODUCT-SPEC
Status: READY
Task-Type: DESIGN / PRODUCT ART SPEC / WRESTLER
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: c937db6931a830b79d6110077cb1b5e1cf0ce577
Handoff-Mode: GITHUB

# ACTION-ART-03 — Product Wrestler Art Specification

## Purpose

Define the first authoritative Product-art specification and production plan for the top-down wrestler visuals.

This Task is DESIGN / DOCUMENTATION ONLY.

Do NOT implement Product wrestler assets or replace WrestlerView in this Task.

The goal is to determine exactly what image parts, pivots, coordinate conventions, source/master sizes, runtime assets, animation/articulation changes, and production workflow are needed so that SumoSim can replace the current procedural placeholder wrestlers with Product-quality painted wrestlers without throwing away the accepted gameplay/presentation behavior.

## Current Accepted Product Baseline

### Product visual direction
Accepted:
- stylized painted 2D
- strict top-down Action presentation
- warm traditional sumo Product arena
- Product quality rather than disposable prototype art.

### Runtime canvas / mapping
Current Product Action presentation baseline:
- logical 1920×1080
- Simulation ring radius 2.275 m -> 400 px
- current wrestler body radius 0.35 m
- current displayed wrestler diameter ≈123 px.

The User visually accepted the current wrestler **scale**.

Therefore:
- preserve the current displayed wrestler scale as the baseline
- do NOT change bodyRadius or meter-to-pixel mapping to make new art fit.

### Current wrestler art quality
Current procedural wrestler visuals are explicitly temporary and below the Product background quality bar.

They must eventually be replaced by Product image assets.

### Product HUD / pre-bout
ACTION-ART-02A / 02A1:
- English Action HUD accepted.

ACTION-ART-02B:
- pre-bout comparison technically passes
- User Play Test reported no issues
- therefore its presentation flow is accepted.

Do not reopen HUD or pre-bout flow in this Task.

## User Product-art Direction — Accepted

The wrestler should use **part-based image composition** rather than runtime primitive shapes as the final Product direction.

The Product asset work should be usable for the real game, not a disposable visual prototype.

The desired production order has been:

1. Product background / dohyo
2. Product HUD
3. Product wrestler parts

We are now at step 3.

## Required Reading / Direct Source Inspection

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/ACTION_HUD_PRODUCT_SPEC.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `src/game/scenes/WrestlerView.ts`
- `src/game/presentation/wrestlerVisualState.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/presentation/productArena.ts`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- grapple orientation helpers relevant to wrestler facing / turning.

Current Source inspection is mandatory.

Do not rely on old VISUAL-01 handoff alone.

## Deliverable

Create:

`docs/WRESTLER_PRODUCT_ART_SPEC.md`

This becomes the authoritative current specification for Product wrestler asset production and later Phaser integration.

Update `docs/ARCHITECTURE.md` only if a small current/future presentation note is necessary.

Do NOT change Production Source.

## Core Architecture Constraint

Preserve:

```
BoutSimulation / BoutSnapshot
        ↓
wrestlerVisualState.ts
        ↓
Product Wrestler View / Animation
```

Product art must remain presentation.

Do NOT move:
- pose decisions
- visual animation timing
- sprite state
- asset state

into Simulation.

Do NOT duplicate gameplay formulas in Phaser.

Current `wrestlerVisualState.ts` semantics are the starting point and should only be changed later through an explicit implementation task if Product art requires a presentation-only mapping adjustment.

## Current Visual State Coverage

Inspect and document how the current visual system represents at minimum:

- idle
- move
- push
  - startup
  - active
  - recovery
- counter
- kuzushi
- grip
  - reach
  - recovery
- grapple
  - turning
  - neutral
  - morozashi holder
  - morozashi disadvantaged
- drive
- frozen/result state.

The Product art plan must explain how each of these will be represented.

Do not invent new gameplay actions.

## Critical Question 1 — Minimum Product Part Set

The current procedural view uses:
- shadow
- left/right feet
- torso
- mawashi
- left/right whole-arm sprites
- head.

This may be too coarse for painted Product art because the current arm sprites are non-uniformly stretched for reach.

Investigate and compare at least:

### Option A — current coarse segmentation
- torso
- head
- mawashi
- whole left arm
- whole right arm
- left foot
- right foot
- shadow.

Advantages:
- smallest implementation change.

Risk:
- stretching painted arms may look visibly distorted.

### Option B — articulated arms
At minimum:
- torso/body
- head/hair
- mawashi
- left upper arm
- left forearm/hand
- right upper arm
- right forearm/hand
- left foot
- right foot
- shadow.

Assess whether elbows / forearms provide enough articulation to avoid visible arm stretching across:
- Push
- Grip
- Grapple
- Morozashi.

### Option C — another small Product-quality segmentation suggested by Current Source

Do NOT propose full skeletal-animation middleware.

Recommend the smallest part set that is good enough for Product quality.

## Critical Question 2 — Feet / Legs

Current presentation uses only feet below the torso.

Investigate whether Product art should use:

- feet only
- lower legs + feet
- combined leg/foot sprites.

Evaluate readability from strict top-down view.

Do not add detailed leg IK unless necessary.

## Critical Question 3 — Torso / Head / Mawashi Layering

Define:

- torso body silhouette
- head / hair / mage layering
- mawashi layering
- front/back overlap behavior
- shoulder attachment areas
- whether any torso shading should be baked.

Requirements:
- top-down wrestler must read immediately as a sumo wrestler
- mawashi must remain clearly readable
- parts must tolerate rotation
- no arena/background baked into character parts.

## Critical Question 4 — Stretching vs Rotation

Product painted art should not be visibly rubber-stretched.

Inspect every current runtime transform:

- arm `setScale(reach, 1)`
- torso scale / crouch
- foot offsets
- torso rotation
- container facing rotation.

Classify each as:

- safe to preserve
- acceptable only within a limited range
- should be replaced by articulated rotation
- should be replaced by another presentation method.

The spec must explicitly identify any current Product-risk transform.

Do not change Source in this Task.

## Critical Question 5 — Canonical Coordinate / Pivot Contract

Define an exact local-space contract for future assets.

Current local convention:
- root / canonical body center at participant center
- local +X = facing / forward
- local +Y = wrestler's right side
- whole character root rotates to `participant.facing`.

Preserve this direction unless Current Source inspection reveals a material reason not to.

For every recommended part, define:

- local-space role
- pivot / origin
- expected attachment point
- front direction
- left/right convention
- recommended transparent padding.

The later implementation should not guess pivots from image dimensions.

## Critical Question 6 — Runtime Size / Master Size

Current accepted runtime wrestler scale:
- body diameter ≈123 px.

Define an art-production strategy that preserves quality.

Compare reasonable source/master options, for example:
- 2× runtime
- 4× runtime
- another explicit master scale.

Consider:
- browser runtime quality
- future minor scaling
- AI-generation consistency
- storage/download cost
- antialiasing.

Do not change Phaser logical resolution.

Recommend:
- source/master part scale
- runtime export scale
- whether runtime assets should be authored directly or downscaled deterministically.

Do not blindly adopt the arena's 2× master convention if a different character-part workflow is better; explain the choice.

## Critical Question 7 — AI Image Generation Workflow

The User intends to use Product-quality generated image assets.

Compare at least:

### Workflow A — separate generation per part
Risk:
- inconsistent anatomy / lighting / texture across parts.

### Workflow B — one canonical parts sheet
Generate all parts in one coherent source image, separated with room between them, then deterministically extract individual transparent assets.

### Workflow C — full canonical wrestler then edit/isolate parts
Generate one coherent top-down wrestler, then derive parts using image editing / masking.

Recommend the workflow most likely to preserve:
- anatomical consistency
- skin tone
- lighting
- line/paint style
- top-down perspective.

The recommendation must be practical for ChatGPT image generation + deterministic local processing.

Do not implement the generator in this Task.

## Critical Question 8 — Asset Extraction / Offline Tooling

Determine whether a small offline Python tool should be used later for:

- deterministic crop
- transparent padding
- pivot normalization
- runtime downscale
- optional atlas/sheet output
- manifest / hashes.

Use the existing `tools/dohyo_art` philosophy as a precedent:
AI/generated art source -> deterministic offline processing -> runtime assets.

Do NOT reuse dohyo-specific code directly.

Do NOT implement a new tool here.

Recommend whether the next production task should create a small:
`tools/wrestler_art/`
pipeline.

Avoid a generic art framework.

## Critical Question 9 — Runtime Asset Structure

Recommend future runtime paths, e.g.:

```
public/assets/action/wrestler/
```

and source/master paths, e.g.:

```
art-source/action/wrestler/
```

or a better project-consistent equivalent.

Define:
- asset naming
- left/right naming
- baseline wrestler variant naming
- shadow naming
- whether mawashi is separate.

Do not add files/directories in this Task unless documentation needs examples.

## Critical Question 10 — Color / Mawashi Strategy

Current procedural view tints the mawashi using participant presentation color.

For Product art, compare:

### A. grayscale/tintable mawashi asset
Pros:
- cheap variation.

Risk:
- Phaser tint may flatten painted shading/color.

### B. pre-rendered mawashi color variants

### C. mask/overlay strategy

Do not decide the final wrestler color system.

Recommend the smallest Product-safe approach for the first baseline wrestler while leaving future variation open.

Important:
current debug/player blue/red colors are NOT necessarily final mawashi content rules.

## Critical Question 11 — Wrestler Variation

Management will eventually involve many wrestlers, but the first Product Art task must stay small.

Do NOT design:
- full procedural body generator
- face generator
- physique morph system
- age/ethnicity/nationality generator.

The spec should define only:

- one baseline Product wrestler asset set
- how a second opponent can reuse/variant that set for current prototype
- which future variation dimensions are explicitly Deferred.

Avoid locking every wrestler to identical final appearance if a small future-safe seam is obvious.

## Critical Question 12 — Portrait Separation

The Product HUD currently does not require face portraits.

Do not couple the top-down wrestler asset production to portrait generation.

Top-down head art may be produced.

Portrait/face close-up generation remains Deferred and separate.

## Critical Question 13 — Lighting / Shadow

The arena lighting baseline:
- soft high-angle light from upper-left
- future wrestler shadows toward lower-right.

Define:
- whether body lighting is baked consistently into parts
- whether a separate shadow sprite remains dynamic/presentation
- approximate shadow direction/softness
- how rotating a wrestler affects baked lighting.

This is important:
if every body part rotates with the wrestler, strongly directional baked highlights may rotate unnaturally with the body.

Evaluate the tradeoff between:
- world-consistent lighting
- body-relative painted lighting
- subtle neutral shading.

Recommend a Product-friendly compromise.

## Critical Question 14 — Facing / Rotation Readability

The entire wrestler currently rotates continuously to exact `participant.facing`.

Product art must remain readable at arbitrary angles.

Avoid:
- perspective that only works at one rotation
- asymmetric world-light baked effects that break when rotated
- anatomy that reads only at 0°.

The spec must define strict top-down rotational readability requirements.

## Critical Question 15 — Two-wrestler Overlap / Grapple

Product parts must remain readable when two wrestlers overlap during:

- contact
- grip
- grapple
- drive
- morozashi.

Investigate:
- layer order between two wrestler roots
- whether existing fixed body-depth ordering is acceptable
- whether dynamic pair ordering is needed later.

Do not implement dynamic depth unless clearly required.

If overlap ordering is a future risk, document it for the later integration task.

## Critical Question 16 — Product Pose Coverage

For each current visual pose, state whether the first Product set can rely on:

- part transforms only
- one alternate part asset
- one alternate whole pose
- later Deferred treatment.

Prefer reusing parts and transforms.

Do not create a sprite sheet of dozens of baked poses unless Current Source analysis proves it necessary.

## Critical Question 17 — Acceptance Images / Visual Gates

Define which Product wrestler preview images the User should approve before Phaser integration.

At minimum consider:

1. single idle wrestler on transparent background
2. idle wrestler composited over current Product arena at accepted runtime scale
3. Push active pose
4. Grip/Grapple pose
5. two-wrestler overlap / grapple test
6. rotation/facing samples.

Recommend the minimum useful set.

The user should approve the actual visuals before a large runtime integration rewrite.

## Critical Question 18 — Next Task Split

Recommend the safest next sequence.

Expected options:

### Sequence A
1. Product wrestler asset specification
2. Generate canonical Product source art
3. User approval
4. deterministic extraction tool
5. Phaser integration

### Sequence B
1. spec
2. extraction tool first
3. generate source art into known template
4. integration

### Sequence C
another small sequence.

Prefer minimizing redraw/rework.

Do not implement the next step in this Task.

## Product Art Prompt Guidance

The spec should include a concise prompt recipe for the future image-generation turn.

It should capture:

- strict top-down
- adult sumo wrestler
- stylized painted 2D game art
- Product-quality
- anatomy suitable for part extraction
- neutral transparent/simple background
- no text/logo/HUD
- consistent lighting
- no perspective camera
- no chibi
- no photorealism
- no ring/background baked in.

If a canonical parts-sheet workflow is recommended, specify how parts should be arranged in the prompt.

Do not generate an image in this Task.

## Product Quality Requirements

The final Product wrestler direction should:

- visually match the quality level of the accepted arena
- read immediately as a sumo wrestler
- remain readable at ~123 px body diameter
- preserve continuous facing
- preserve accepted Action silhouettes
- avoid obvious rubber stretching
- avoid high-frequency details that disappear at runtime scale
- maintain transparent clean edges
- preserve visual distinction between skin / hair / mawashi / limbs.

## Scope Out

Do NOT:

- modify `src/`
- modify gameplay
- modify Product arena
- modify HUD
- create image assets
- call image generation
- create wrestler art tooling
- add Phaser animation code
- create portraits
- create body variation system
- create final wrestler names/profiles
- design Simulation parameters
- change bodyRadius / collision.

## Documentation Sections Required

`docs/WRESTLER_PRODUCT_ART_SPEC.md` must include at minimum:

1. Purpose / accepted baseline
2. Current Source findings
3. Product visual goals
4. current visual-state coverage
5. recommended part list
6. rejected/alternative part segmentation
7. local coordinate / pivot convention
8. layering order
9. runtime/master sizing
10. source/master/runtime asset path plan
11. AI generation workflow
12. deterministic extraction/tooling recommendation
13. pose/articulation mapping table
14. transform risks
15. mawashi/color strategy
16. shadow/lighting strategy
17. two-wrestler overlap strategy/risk
18. future variation boundary
19. prompt recipe
20. User visual acceptance previews
21. implementation staging
22. Deferred / unresolved
23. explicit Do Not Reopen / preserved gameplay constraints.

## User Decisions

If the investigation reaches a genuinely important Product-art fork, report it rather than silently choosing.

Examples:
- whole-arm vs upper/forearm segmentation if both are viable with meaningful production-cost difference
- source master scale if tradeoff is material
- baseline mawashi color handling if it affects future asset count.

However, the Agent should still make a recommendation.

## Verification

Lean / Design Documentation.

Required:

- direct Current Source inspection
- cross-check all current visual poses/states
- source/spec consistency
- no Production Source changes
- no Product asset changes
- no package/lock changes
- `git diff --check` PASS.

No `pnpm test` / build required unless Source is accidentally touched; it must not be.

## Completion Report

Include:

- Result
- Preflight
- Current WrestlerView findings
- visual-state coverage
- Product part recommendation
- segmentation alternatives
- pivot/coordinate contract
- sizing recommendation
- AI generation workflow recommendation
- offline tool recommendation
- asset paths/naming
- pose mapping
- transform risks
- mawashi strategy
- lighting/shadow strategy
- overlap/layering risk
- future variation boundary
- prompt recipe summary
- User visual approval plan
- recommended next task split
- User Decisions Required
- Deferred
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery.

## Acceptance Criteria

PASS if:

1. current placeholder source is directly inspected
2. every existing visual pose/state is covered
3. minimum Product part set is recommended
4. arm-stretch risk is explicitly resolved/recommended
5. exact pivot/local coordinate convention is specified
6. current accepted wrestler scale is preserved
7. source/master/runtime sizing is recommended
8. AI generation workflow is concrete
9. deterministic extraction/tooling recommendation is concrete
10. asset naming/path plan is concrete
11. no gameplay/state ownership is moved into presentation
12. no final body/face/procedural variation system is invented
13. no images/source code/assets are changed
14. next production task is clear.

## Stop Conditions

STOP/BLOCKED if:

- Current Source contradicts the accepted part-based Product direction materially
- current motion semantics cannot be represented without changing gameplay state
- a Product-quality part set cannot be specified without first changing wrestler gameplay scale/body geometry
- a major skeletal-animation middleware/framework would be required.

Do not guess through a material conflict.

## Git Delivery

Documentation-only Task.

Expected changed files:

- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `docs/ARCHITECTURE.md` only if minimally needed
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Suggested commit:

`docs: specify product wrestler art`

Push `origin/develop`.

Do not modify `main`.

## Final Instruction

Stop after the Product wrestler art specification.

Do NOT:
- generate the wrestler image
- create extraction tooling
- integrate assets into Phaser.

After commit/push/report:

「ACTION-ART-03-WRESTLER-PRODUCT-SPEC が完了し、ChatGPT Review待ちです」
