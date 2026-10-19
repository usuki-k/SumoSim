Task-ID: ACTION-ART-01A-PRODUCT-BACKGROUND-CREATION
Status: READY
Task-Type: PRODUCT ART CREATION / BOUT BACKGROUND + DOHYO MASTER
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 1c5b033addbb1adfb7fd19fc3c51b28a8bd96ca6
Handoff-Mode: GITHUB

# ACTION-ART-01A — Product Background Creation

## Purpose

Create the first **Product-quality Bout background master** for SumoSim.

This is NOT a disposable Prototype-art task.

User direction:
- avoid repeatedly recreating image assets
- create art with the intent that it can remain in the Product version
- Product-art order is:
  1. Background / Dohyo
  2. HUD
  3. Wrestler character parts
- current Action-first development remains the priority

This Task should produce one controlled, approved Product background direction based on the accepted Background Spec.

Do NOT integrate it into Phaser yet.
Integration is ACTION-ART-01B after User visual approval.

## Accepted Decisions

These are now approved and should not be reopened inside this Task unless a hard contradiction is discovered.

### Art coordinate space

- Product runtime-art coordinate space: **1920×1080**
- Product master working space: **3840×2160**
- aspect ratio: **16:9 landscape**

Important:
- this does NOT permanently lock Phaser logical resolution to 1920×1080
- the later Integration Task will map art-space to logical-space explicitly

### Camera / perspective

Use **strict top-down orthographic** as the Product background basis.

Allowed:
- subtle depth through shading
- narrow visible platform edge / clay-bank side
- soft cast shadows

Not allowed:
- perspective that turns the playable circle into a visible ellipse
- oblique camera that makes future freely-rotating wrestler parts look pasted on

### Gameplay / tawara mapping

For the current Product-art direction:

- gameplay radius reference in art-space = **400 px**
- art-space center = **(960, 540)**
- the preferred visible boundary mapping is:
  **gameplay radius = outer edge of the tawara**

Therefore:
- tawara lies inward from the 400 px outer edge
- current preferred tawara width = approximately **0.12 m ≈ 21 px** at runtime-art scale
- the exact geometry remains a separable overlay so it can be changed without regenerating the full arena painting

This is a Product Presentation decision for the current center-based Ring-out rule.
The center-based Gameplay rule itself remains subject to later User Play Test with Product art.

### Venue richness

Product v1 should look like a finished game screen, but keep action readable.

Required:
- finished dohyo/clay platform
- surrounding floor
- clear clay / sand / tawara material separation
- enough Japanese/sumo venue atmosphere that the screen does not look like a technical demo

Allowed:
- static dark spectators outside the protected gameplay region
- static seated officials outside the protected gameplay region
- restrained architectural / cloth / wooden framing
- subtle salt box / water / corner details where they do not compete with play

Do NOT bake in:
- Gyoji
- wrestlers
- active FX
- HUD
- logos / text
- moving crowd
- large roof/foreground elements that occlude the ring

### Production method

Do NOT generate many unrelated full-background alternatives.

Workflow:
1. lock one composition
2. produce one Product direction
3. User reviews that direction
4. revisions should be targeted/local where possible
5. lock Product master
6. export/integrate in ACTION-ART-01B

## Critical Tool / Quality Rule

The User explicitly rejected throwaway primitive/prototype graphics.

If the execution environment does NOT have a credible image-generation / digital-painting capability that can produce the required Product-quality background:

**STOP / BLOCKED.**

Do NOT substitute:
- Python-painted placeholder art
- SVG primitive art
- Phaser Graphics art
- procedural debug textures
- low-quality mockups

and do not claim they are Product art.

In that case:
- prepare/verify the geometry guide and art-generation package only
- report the missing image-creation capability as BLOCKED
- do not create fake Product assets

If a genuine image-generation or digital-art tool is available, proceed.

## Art Direction

Target:
- polished stylized 2D game art
- hand-painted / illustrative finish
- traditional Japanese/sumo atmosphere
- warm, calm lighting
- high visual quality suitable for a shipped web game
- clear shapes and material separation
- not photorealistic
- not low-detail chibi
- no heavy black comic outline

The supplied User reference is a quality/mood/composition reference only.

Do NOT copy:
- exact artwork
- exact layout
- exact decorative motifs
- exact UI
- copyrighted text/logo elements

## Lighting

Use one consistent soft light:
- from upper-left in screen-space
- high-angle, approximately 60° feel
- soft shadows

This lighting direction must later be usable by:
- part-based wrestler art
- Gyoji art
- character shadows

Do NOT bake wrestler shadows into the background.

## Color / Contrast

Required:
- playable clay area must not visually merge with wrestler skin
- clay should be lower-saturation and/or meaningfully different in value from skin
- tawara must read against both clay and outer sand
- future mawashi colors must remain readable
- HUD-safe regions should be calmer/darker and less detailed
- central gameplay area should have restrained detail

Avoid:
- high-frequency noise under the wrestlers
- bright patterns competing with Push/Grip states
- marks that look like gameplay trails or footprints

## Product Geometry Guide

Create/retain an explicit non-destructive geometry guide for art production.

Runtime-art coordinates:

- canvas: 1920×1080
- center: (960, 540)
- gameplay radius: 400 px
- preferred tawara outer edge: radius 400 px
- preferred tawara inner edge: about radius 379 px
- current participant body diameter reference: about 123 px
- current initial participant centers: x ≈ 960 ± 123, y = 540
- shikiri reference x ≈ 960 ± 62
- shikiri reference vertical length ≈ 140 px
- protected gameplay/presentation region: center (960, 540), radius about 532 px

Master-space values are exactly ×2:
- 3840×2160
- center (1920, 1080)
- gameplay radius 800 px
- protected radius about 1064 px

The guide itself is NOT runtime game art.

## Layer Strategy

The Product background must be authored so these responsibilities remain separable.

### Layer 1 — arena_base

Master intent:
- opaque
- full 3840×2160
- venue/environment
- platform/base
- clay surface
- outer sand
- surrounding floor
- spectators/officials only outside protected gameplay region
- no exact gameplay-critical tawara geometry
- no exact shikiri geometry
- no characters/HUD/text/logo

The painted base may contain soft/non-critical hints under the exact overlay only if they can be fully hidden later.

### Layer 2 — dohyo_ring_overlay source

Exact geometry source for:
- tawara
- tawara shading
- shikiri lines

Must be geometrically aligned to the accepted guide.

Preferred:
- create the texture/painting needed for the tawara
- apply it through an exact circular mask/guide
- preserve the editable/separable overlay source

Do NOT rely on an AI-generated imperfect ring as the final gameplay boundary.

### Layer 3 — arena_ambient source (optional)

Subtle:
- vignette
- light falloff
- low-frequency atmosphere

Must sit behind future wrestlers.
Do not darken critical gameplay readability.

## Required Deliverables

If image creation capability is available, produce:

### D1 — Product master background

A Product-quality **3840×2160** master background image for `arena_base`.

Minimum:
- lossless PNG master
- no wrestler / Gyoji / HUD / text
- geometry-compatible composition
- transparent layers are not required for the opaque base

### D2 — Exact geometry guide

A lossless 3840×2160 guide or equivalent reproducible vector/mask data showing:
- center
- gameplay radius
- tawara outer/inner edges
- shikiri references
- protected gameplay radius
- optional HUD safe areas

This is a developer/art-production guide, not a runtime layer.

### D3 — Ring overlay master/source

Create a separable master/source for the exact tawara + shikiri layer.

Preferred:
- 3840×2160 transparent PNG master
or
- a smaller exact crop with documented placement if that materially reduces file size

Geometry must match the guide.

### D4 — Preview composite

Create a review preview at 1920×1080 combining:
- arena base
- exact ring overlay

Purpose:
User can judge the Product appearance before integration.

Do NOT bake the preview back into the master source.

### D5 — Production recipe

Save a small text/markdown record containing:
- accepted art brief version
- generation prompt(s), if AI generation is used
- negative prompt / exclusions if applicable
- geometry coordinates
- layer decomposition
- editing notes
- source image identifiers/filenames
- any manual corrections performed

Goal:
avoid needing to rediscover how the Product background was produced.

## Proposed Repository Paths

This Task explicitly permits creation of:

`art-source/action/background/`

for Product source/master assets and production recipe.

Do NOT create the runtime directory yet unless a runtime preview is explicitly needed for review.

Runtime assets will be exported in ACTION-ART-01B to:

`public/assets/action/background/`

after User visual approval.

Because AGENTS.md requires explicit new-directory permission:
- `art-source/action/background/` is explicitly authorized by this Task
- `public/assets/action/background/` is NOT yet authorized for Product runtime integration in this Task

## Master / File Format

For source/master:
- lossless PNG is the required interchange format
- retain original generated source image before destructive editing where practical
- if a native editable art format is actually used, retain it as additional source

Do NOT require a proprietary tool.

For later runtime export:
- arena_base may use lossy WebP
- exact ring overlay must use lossless PNG or lossless WebP

Runtime export is ACTION-ART-01B, not this Task.

## Composition Requirements

The main gameplay focus must remain central.

### Protected gameplay region

Within radius ≈ 532 px runtime equivalent:
- no baked characters
- no text
- no high-contrast spectators
- no foreground occluders
- no strong decorative pattern
- no architectural element that could be mistaken for a collision boundary

### HUD planning regions

Treat these as low-detail visual zones only.
Do NOT paint empty UI boxes.

- top-left: approx (0,0)-(560,200)
- top-right: approx (1360,0)-(1920,200)
- top-center: keep the first ~100 px relatively calm if possible
- lower corners: calmer than surrounding venue

These are guides for ACTION-ART-02, not final HUD geometry.

## Venue Content Guidance

Recommended composition:
- central dohyo/platform as the hero
- surrounding warm wooden/clay floor
- outer edges becoming darker
- limited spectators/official silhouettes beyond the protected region
- subtle Japanese architectural/cloth cues

Keep the environment believable and polished without turning it into a crowd-detail illustration.

## Perspective Requirements

Strict top-down orthographic for gameplay geometry.

Allowed:
- soft side shading on platform edge
- slightly visible raised clay-bank side through light/shadow
- top-down material texture
- volumetric shading that does not distort geometry

The visible gameplay circle must remain circular.

## Geometry / Painted-Art Separation

Do not force the painted base to solve exact geometry.

The base must visually support a centered dohyo, but:
- exact tawara boundary belongs to the overlay
- exact shikiri geometry belongs to the overlay

If generation produces an inaccurate ring:
- remove/mask it
- do not distort Simulation geometry to match the painting

## Acceptance Criteria — Art Quality

The generated Product direction is acceptable only if:

- it looks materially closer to a shipped game than the current Graphics prototype
- it is not obviously a generic AI/stock scene
- dohyo is immediately recognizable
- exact overlay does not look pasted on top of an incompatible base
- style could support future wrestler parts in the same visual language
- central action area is readable
- lighting is coherent
- venue atmosphere is present but restrained
- no visible UI/text/wrestlers/Gyoji are baked in
- 1920×1080 preview still looks clean
- master has enough detail for later HUD/character integration

If quality is materially below Product intent:
- do not commit it as accepted Product art
- report the limitation and request revision/another creation pass

## Acceptance Criteria — Geometry

- master art composition uses the accepted center
- ring overlay outer edge matches master-space radius 800 px within 1 px
- shikiri references align with guide
- no scaling/stretching of overlay is required to fit the base
- preview composite uses exact 16:9 crop
- protected gameplay region remains unobstructed

## User Visual Approval — REQUIRED

This Task is not complete merely because files exist.

After generation, provide the User:
- 1920×1080 preview composite
- optionally a second preview with geometry guide overlay for validation

User must judge:
- overall composition
- Product-quality feel
- color/lighting
- environment richness
- dohyo prominence
- whether this is the visual direction to lock before HUD work

Do NOT proceed to ACTION-ART-01B integration until User approves the Product direction.

## Scope Out

Do NOT:

- integrate background into Phaser
- change logical resolution
- change Gameplay
- change Ring-out formula
- create HUD art
- create wrestler part art
- create Gyoji art
- install Aseprite/Tiled
- implement camera changes
- create moving spectators
- generate multiple unrelated complete backgrounds as a comparison set

## Stop Conditions

STOP and report if:

- no capable image-generation/digital-art tool is available
- only prototype/procedural-quality art can be produced
- exact circular geometry cannot be kept separable from the painted base
- Product art would require changing current Gameplay/camera before creation
- master file sizes exceed practical Git limits and no repository policy exists
- a proprietary source-art tool becomes mandatory
- Current Source materially conflicts with the accepted Product Art Spec

## Verification

Art creation / source-asset verification.

Required:
- expected deliverables exist
- dimensions verified
- alpha/transparency verified where applicable
- exact geometry guide measurements verified
- overlay alignment verified
- preview composite generated
- production recipe saved
- no Production TypeScript/source changes
- package/lockfile unchanged
- `git diff --check` for text files
- repository file-size sanity check
- only task-owned art/source files staged

Tests/build are NOT required if Production source is unchanged.

## Completion Report

Minimum:
- Result
- Preflight
- image-creation capability used
- source/master files created
- exact dimensions
- layer/file list
- generation/edit workflow
- production recipe path
- geometry verification
- preview path
- file-size summary
- art acceptance self-check
- User visual approval REQUIRED
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

If BLOCKED:
- explain exactly which capability is unavailable
- do not substitute low-quality placeholder art

## Git Delivery

Follow AGENTS.md.

Product source assets belong on `develop`.
Task-owned files only.

One successful creation Task ≈ one commit.

Suggested commit:
`art: add product bout background master`

Do not modify `main`.

## Final Instruction

Stop after Product background creation and preview.

Do NOT integrate into Phaser.

After commit/push/report:
「ACTION-ART-01A-PRODUCT-BACKGROUND-CREATION が完了し、ChatGPT ReviewとUser Visual Approval待ちです」


# User Visual Decision — Product Arena Base

User has visually approved the generated Product background direction as the accepted `arena_base` baseline.

Accepted:
- 16:9 top-down sumo venue direction
- warm painted/stylized Product-quality look
- central dohyo/platform composition
- surrounding wooden venue and restrained spectators
- no wrestlers / Gyoji / HUD baked into the background

Important follow-up:
- Do NOT preemptively repaint or erase the broad circular clay wear marks in the center.
- First composite the exact `dohyo_ring_overlay` against this background.
- Only if the wear marks materially compete with or visually contradict the exact gameplay boundary should they be softened with a targeted local edit.
- Preserve the original accepted arena-base source before any such edit.

Next visual step:
1. preserve accepted arena base unchanged
2. create exact tawara + shikiri overlay using the accepted art-space geometry
3. create 1920×1080 composite preview
4. User checks whether the center wear ring conflicts with the exact boundary
5. if necessary, apply only a local/non-destructive reduction of the wear ring
6. then lock the Product background before HUD work
